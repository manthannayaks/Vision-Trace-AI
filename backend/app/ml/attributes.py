import logging
from typing import Dict, Any, List, Optional
import numpy as np
from PIL import Image
import torch
from app.ml.clip_matcher import ClipMatcher
from app.utils.image_utils import cv2_to_pil

logger = logging.getLogger(__name__)

ATTRIBUTE_CATEGORIES = {
    "upper_clothing": [
        "hoodie", "jacket", "shirt", "t-shirt", "coat", "sweater"
    ],
    "upper_color": [
        "black", "white", "blue", "red", "gray", "green", "yellow", "brown"
    ],
    "lower_clothing": [
        "jeans", "pants", "shorts", "sweatpants"
    ],
    "lower_color": [
        "blue", "black", "gray", "white", "brown", "beige"
    ],
    "headwear": [
        "hood covering head", "cap or hat", "no headwear"
    ],
    "bag": [
        "backpack", "handbag or shoulder bag", "no bag"
    ],
    "footwear": [
        "white sneakers", "black shoes", "sneakers", "boots"
    ]
}

class AttributeExtractor:
    """
    Zero-Shot Appearance Attribute Classifier using CLIP text-image prompt alignment.
    Evaluates pedestrian crops against distinct attribute prompts and assigns confidence.
    If image resolution is too low or match confidence is below threshold, marks as 'not_visible/unknown'.
    """
    def __init__(self, clip_matcher: Optional[ClipMatcher] = None):
        self.clip_matcher = clip_matcher or ClipMatcher()
        self._cached_prompt_embeddings: Dict[str, Dict[str, np.ndarray]] = {}

    def _ensure_attribute_embeddings(self):
        """Lazy precomputes text embeddings for attribute candidate prompts."""
        if self._cached_prompt_embeddings:
            return
        for category, options in ATTRIBUTE_CATEGORIES.items():
            self._cached_prompt_embeddings[category] = {}
            for opt in options:
                prompt = f"a photo of a person wearing {opt}" if "no " not in opt else f"a photo of a person with {opt}"
                try:
                    emb = self.clip_matcher.get_text_embedding(prompt)
                    self._cached_prompt_embeddings[category][opt] = emb
                except Exception as e:
                    logger.warning(f"Failed to embed attribute prompt '{prompt}': {e}")

    def extract_attributes(self, crop: np.ndarray, min_crop_size: int = 40) -> Dict[str, Any]:
        """
        Extract attributes from person crop.
        Returns dictionary of detected attributes with confidence scores and visibility flag.
        """
        self._ensure_attribute_embeddings()
        if crop is None or crop.shape[0] < min_crop_size or crop.shape[1] < min_crop_size:
            return {
                "status": "insufficient_resolution",
                "attributes": {},
                "summary": "Resolution too low for reliable attribute extraction"
            }

        try:
            crop_emb = self.clip_matcher.get_image_embedding(crop)
        except Exception as e:
            logger.warning(f"Failed to generate embedding for crop: {e}")
            return {"status": "error", "attributes": {}, "summary": str(e)}

        extracted = {}

        for category, options in self._cached_prompt_embeddings.items():
            best_opt = "unknown"
            highest_sim = -1.0
            scores = {}

            for opt, prompt_emb in options.items():
                sim = self.clip_matcher.cosine_similarity(crop_emb, prompt_emb)
                scores[opt] = round(sim, 4)
                if sim > highest_sim:
                    highest_sim = sim
                    best_opt = opt

            # Confidence threshold: if highest score is too weak, categorize as not clearly visible
            is_visible = highest_sim >= 0.18
            extracted[category] = {
                "value": best_opt if is_visible else "not_clearly_visible",
                "confidence": round(highest_sim, 4),
                "is_visible": is_visible,
                "alternatives": scores
            }

        summary_parts = []
        if extracted.get("upper_color", {}).get("is_visible") and extracted.get("upper_clothing", {}).get("is_visible"):
            summary_parts.append(f"{extracted['upper_color']['value']} {extracted['upper_clothing']['value']}")
        if extracted.get("lower_color", {}).get("is_visible") and extracted.get("lower_clothing", {}).get("is_visible"):
            summary_parts.append(f"{extracted['lower_color']['value']} {extracted['lower_clothing']['value']}")
        if extracted.get("bag", {}).get("is_visible") and "no " not in extracted["bag"]["value"]:
            summary_parts.append(f"with {extracted['bag']['value']}")
        if extracted.get("headwear", {}).get("is_visible") and "no " not in extracted["headwear"]["value"]:
            summary_parts.append(f"with {extracted['headwear']['value']}")

        return {
            "status": "success",
            "attributes": extracted,
            "summary": ", ".join(summary_parts) if summary_parts else "General pedestrian appearance"
        }

