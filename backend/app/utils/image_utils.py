import cv2
import numpy as np
from PIL import Image
from pathlib import Path
from typing import Tuple, Optional

def cv2_to_pil(cv2_img: np.ndarray) -> Image.Image:
    """Convert an OpenCV BGR image to a PIL RGB image."""
    rgb_img = cv2.cvtColor(cv2_img, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb_img)

def pil_to_cv2(pil_img: Image.Image) -> np.ndarray:
    """Convert a PIL image to OpenCV BGR format."""
    rgb_img = np.array(pil_img.convert("RGB"))
    return cv2.cvtColor(rgb_img, cv2.COLOR_RGB2BGR)

def crop_person(frame: np.ndarray, bbox: Tuple[int, int, int, int], padding_pct: float = 0.05) -> Optional[np.ndarray]:
    """
    Extract person crop from frame with optional safety padding.
    bbox: (x1, y1, x2, y2)
    """
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = bbox

    pad_w = int((x2 - x1) * padding_pct)
    pad_h = int((y2 - y1) * padding_pct)

    x1 = max(0, x1 - pad_w)
    y1 = max(0, y1 - pad_h)
    x2 = min(w, x2 + pad_w)
    y2 = min(h, y2 + pad_h)

    if x2 <= x1 or y2 <= y1:
        return None

    crop = frame[y1:y2, x1:x2]
    return crop

def save_image(img: np.ndarray, output_path: Path) -> bool:
    """Save an OpenCV image to the specified path."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return cv2.imwrite(str(output_path), img)

