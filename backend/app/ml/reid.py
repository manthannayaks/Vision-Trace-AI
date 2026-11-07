import logging
from typing import Optional, List, Tuple
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from app.config import settings
from app.utils.image_utils import cv2_to_pil

logger = logging.getLogger(__name__)

class PersonReIDExtractor:
    """
    Person Re-identification (Re-ID) feature extractor.
    Designed with graceful degradation: utilizes torchvision feature backbone or torchreid if installed,
    providing tracklet-level visual embedding comparison.
    If external OSNet weights are absent, system logs status and defaults safely to visual backbone.
    """
    def __init__(self, model_name: str = "osnet_x0_25"):
        self.model_name = model_name
        self.device = settings.device
        self.is_available = False
        self.model: Optional[nn.Module] = None
        self.transform = transforms.Compose([
            transforms.Resize((256, 128)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        self._init_model()

    def _init_model(self):
        try:
            # Check if torchreid is available
            import torchreid
            self.model = torchreid.models.build_model(
                name=self.model_name,
                num_classes=1000,
                pretrained=True
            ).to(self.device)
            self.model.eval()
            self.is_available = True
            logger.info(f"Re-ID OSNet model '{self.model_name}' loaded successfully.")
        except Exception as e:
            logger.info(f"Optional torchreid/OSNet not initialized ({e}). Re-ID fallback enabled via torchvision backbone.")
            try:
                from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
                weights = MobileNet_V3_Small_Weights.DEFAULT
                backbone = mobilenet_v3_small(weights=weights)
                backbone.classifier = nn.Identity()  # 576-d feature vector
                self.model = backbone.to(self.device)
                self.model.eval()
                self.is_available = True
                logger.info("Re-ID feature extractor initialized using lightweight torchvision backbone.")
            except Exception as ex:
                logger.warning(f"Re-ID module unavailable: {ex}. System will rely fully on CLIP appearance matching.")
                self.is_available = False

    def extract_feature(self, crop: np.ndarray) -> Optional[np.ndarray]:
        """Extract L2-normalized Re-ID feature vector from OpenCV BGR person crop."""
        if not self.is_available or self.model is None or crop is None:
            return None

        try:
            pil_img = cv2_to_pil(crop)
            tensor = self.transform(pil_img).unsqueeze(0).to(self.device)
            with torch.no_grad():
                feat = self.model(tensor)
                feat = feat / feat.norm(dim=-1, keepdim=True)
                return feat.cpu().numpy()[0]
        except Exception as err:
            logger.warning(f"Re-ID feature extraction failed: {err}")
            return None

    @staticmethod
    def compute_similarity(feat1: np.ndarray, feat2: np.ndarray) -> float:
        """Compute cosine similarity between two normalized Re-ID feature vectors."""
        if feat1 is None or feat2 is None:
            return 0.0
        dot = float(np.dot(feat1, feat2))
        return float(np.clip(dot, 0.0, 1.0))

