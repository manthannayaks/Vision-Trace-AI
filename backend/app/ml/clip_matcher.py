import logging
from typing import List, Dict, Any, Optional, Union
import numpy as np
import torch
from PIL import Image
from transformers import CLIPTokenizer, CLIPImageProcessor, CLIPProcessor, CLIPModel
from app.config import settings
from app.utils.image_utils import cv2_to_pil

logger = logging.getLogger(__name__)

class ClipMatcher:
    """
    CLIP Appearance Matcher using openai/clip-vit-base-patch32.
    Extracts L2-normalized embeddings for images and texts and computes cosine similarity.
    Supports embedding caching for high-efficiency candidate screening.
    """
    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.CLIP_MODEL_NAME
        self.device = settings.device
        self.model: Optional[CLIPModel] = None
        self.processor: Optional[CLIPProcessor] = None
        self._embedding_cache: Dict[str, np.ndarray] = {}
        self._load_model()

    def _load_model(self):
        try:
            logger.info(f"Loading CLIP model '{self.model_name}' on device '{self.device}'...")
            try:
                # First attempt local cache only to avoid network timeout and Hugging Face retry loops
                tokenizer = CLIPTokenizer.from_pretrained(self.model_name, local_files_only=True)
                image_processor = CLIPImageProcessor.from_pretrained(self.model_name, local_files_only=True)
                self.processor = CLIPProcessor(image_processor=image_processor, tokenizer=tokenizer)
                self.model = CLIPModel.from_pretrained(self.model_name, local_files_only=True).to(self.device)
            except Exception as local_err:
                logger.info(f"Local files not found ({local_err}), downloading from hub...")
                tokenizer = CLIPTokenizer.from_pretrained(self.model_name)
                image_processor = CLIPImageProcessor.from_pretrained(self.model_name)
                self.processor = CLIPProcessor(image_processor=image_processor, tokenizer=tokenizer)
                self.model = CLIPModel.from_pretrained(self.model_name).to(self.device)
            self.model.eval()
            logger.info("CLIP model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load CLIP model: {e}")
            raise RuntimeError(f"Could not initialize CLIP: {e}")

    def unload(self):
        """Releases model from memory to keep RAM minimal on cloud containers."""
        if self.model is not None:
            del self.model
            self.model = None
        if self.processor is not None:
            del self.processor
            self.processor = None
        self._embedding_cache.clear()

    def get_image_embedding(self, image_input: Union[Image.Image, np.ndarray, str], cache_key: Optional[str] = None) -> np.ndarray:
        """
        Extract L2-normalized 512-d feature vector for an image (PIL Image, OpenCV BGR, or path).
        """
        if cache_key and cache_key in self._embedding_cache:
            return self._embedding_cache[cache_key]

        if isinstance(image_input, str):
            image = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, np.ndarray):
            image = cv2_to_pil(image_input)
        elif isinstance(image_input, Image.Image):
            image = image_input.convert("RGB")
        else:
            raise ValueError(f"Unsupported image type: {type(image_input)}")

        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            image_features = self.model.get_image_features(**inputs)
            if hasattr(image_features, "pooler_output") and image_features.pooler_output is not None:
                image_features = image_features.pooler_output
            # L2 Normalize
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            embedding = image_features.cpu().numpy()[0]

        if cache_key:
            self._embedding_cache[cache_key] = embedding

        return embedding

    @staticmethod
    def calibrate_text_similarity(raw_sim: float) -> float:
        """
        Calibrates raw CLIP text-to-image cosine similarity (typically 0.18 - 0.35)
        into an interpretable [0.0, 1.0] visual confidence scale:
        - Below 0.22: Unrelated appearance / non-match (0% - 35%)
        - 0.22 - 0.255: Baseline pedestrian / weak alignment (35% - 49%)
        - 0.255 - 0.29: Positive visual match (50% - 75%)
        - Above 0.29: Strong appearance match (75% - 98%)
        """
        if raw_sim is None:
            return 0.0
        s = float(raw_sim)
        if s <= 0.18:
            score = max(0.0, (s / 0.18) * 0.15)
        elif s <= 0.22:
            score = 0.15 + ((s - 0.18) / 0.04) * 0.20  # 0.15 -> 0.35
        elif s <= 0.255:
            score = 0.35 + ((s - 0.22) / 0.035) * 0.14  # 0.35 -> 0.49
        elif s <= 0.29:
            score = 0.50 + ((s - 0.255) / 0.035) * 0.25  # 0.50 -> 0.75
        elif s <= 0.34:
            score = 0.75 + ((s - 0.29) / 0.05) * 0.18   # 0.75 -> 0.93
        else:
            score = min(0.99, 0.93 + ((s - 0.34) / 0.10) * 0.06)
        return round(float(score), 4)

    @staticmethod
    def calibrate_image_similarity(raw_sim: float) -> float:
        """
        Calibrates raw CLIP image-to-image cosine similarity (typically 0.40 - 0.90)
        into an interpretable [0.0, 1.0] visual confidence scale:
        - Below 0.55: Low appearance alignment / different person (0% - 48%)
        - 0.55 - 0.70: Moderate visual alignment (50% - 68%)
        - Above 0.70: High similarity appearance match (70% - 98%)
        """
        if raw_sim is None:
            return 0.0
        s = float(raw_sim)
        if s <= 0.40:
            score = max(0.0, (s / 0.40) * 0.20)
        elif s <= 0.55:
            score = 0.20 + ((s - 0.40) / 0.15) * 0.28  # 0.20 -> 0.48
        elif s <= 0.70:
            score = 0.50 + ((s - 0.55) / 0.15) * 0.20  # 0.50 -> 0.70
        elif s <= 0.85:
            score = 0.70 + ((s - 0.70) / 0.15) * 0.20  # 0.70 -> 0.90
        else:
            score = min(0.99, 0.90 + ((s - 0.85) / 0.15) * 0.09)
        return round(float(score), 4)

    def get_text_embedding(self, text: str) -> np.ndarray:
        """
        Extract L2-normalized 512-d feature vector for a natural language description.
        Applies surveillance and person-centric prompt ensembling to maximize zero-shot discrimination.
        """
        if not text or not text.strip():
            raise ValueError("Text query cannot be empty.")

        clean_text = text.strip()
        lower = clean_text.lower()
        if any(w in lower for w in ["photo", "picture", "surveillance", "footage", "camera"]):
            prompts = [clean_text]
        else:
            prompts = [
                f"a photo of a person wearing {clean_text}",
                f"a surveillance camera photo of a person wearing {clean_text}",
                f"a photo of a person with {clean_text}",
                f"a security camera image of a person wearing {clean_text}",
                clean_text
            ]

        inputs = self.processor(text=prompts, return_tensors="pt", padding=True, truncation=True).to(self.device)
        with torch.no_grad():
            text_features = self.model.get_text_features(**inputs)
            if hasattr(text_features, "pooler_output") and text_features.pooler_output is not None:
                text_features = text_features.pooler_output
            # L2 Normalize
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
            # Average across templates & re-normalize
            avg_features = text_features.mean(dim=0, keepdim=True)
            avg_features = avg_features / avg_features.norm(dim=-1, keepdim=True)
            embedding = avg_features.cpu().numpy()[0]

        return embedding

    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two L2-normalized embeddings.
        Scaled to range [0.0, 1.0] for intuitive interpretation: (cos + 1) / 2 or max(0, cos).
        We use raw cosine dot product clamped to [0.0, 1.0].
        """
        dot = float(np.dot(emb1, emb2))
        return float(np.clip(dot, 0.0, 1.0))

    def match_candidate(
        self,
        candidate_crop: Union[Image.Image, np.ndarray],
        ref_image_emb: Optional[np.ndarray] = None,
        ref_text_emb: Optional[np.ndarray] = None
    ) -> Dict[str, Optional[float]]:
        """
        Match a single person crop against the reference image and/or text embeddings.
        Returns calibrated visual appearance match scores [0.0, 1.0].
        """
        candidate_emb = self.get_image_embedding(candidate_crop)

        img_sim = None
        txt_sim = None

        if ref_image_emb is not None:
            raw_img = self.cosine_similarity(ref_image_emb, candidate_emb)
            img_sim = self.calibrate_image_similarity(raw_img)

        if ref_text_emb is not None:
            raw_txt = self.cosine_similarity(ref_text_emb, candidate_emb)
            txt_sim = self.calibrate_text_similarity(raw_txt)

        return {
            "image_similarity": img_sim,
            "text_similarity": txt_sim
        }
