import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import torch
from app.config import settings

os.environ["YOLO_CONFIG_DIR"] = str(settings.MODEL_DIR)
from ultralytics import YOLO

logger = logging.getLogger(__name__)

class PersonDetector:
    """
    Modular YOLO-based Person Detector.
    Filters exclusively for the COCO 'person' class (class ID 0).
    Supports CPU, Apple Silicon MPS, and NVIDIA CUDA.
    """
    def __init__(self, model_name: Optional[str] = None, conf_threshold: Optional[float] = None):
        self.model_name = model_name or settings.YOLO_MODEL_NAME
        self.conf_threshold = conf_threshold or settings.DETECTION_CONFIDENCE
        self.device = settings.device
        self.model = None
        self._load_model()

    def _load_model(self):
        """Loads YOLO model with graceful fallback if specific weights are missing."""
        candidate_paths = [
            settings.BACKEND_DIR / "yolo11n.pt",
            settings.BASE_DIR / "yolo11n.pt",
            Path("yolo11n.pt"),
            Path("backend/yolo11n.pt"),
        ]
        target_model = self.model_name
        for p in candidate_paths:
            if p.exists():
                target_model = str(p)
                break
        try:
            logger.info(f"Loading YOLO model '{target_model}' on device '{self.device}'...")
            self.model = YOLO(target_model)
            logger.info(f"YOLO model '{target_model}' successfully loaded.")
        except Exception as e:
            logger.warning(f"Failed to load '{target_model}': {e}. Falling back to 'yolov8n.pt'...")
            try:
                self.model = YOLO("yolov8n.pt")
                self.model_name = "yolov8n.pt"
                logger.info("Fallback YOLO model 'yolov8n.pt' successfully loaded.")
            except Exception as ex:
                logger.error(f"Failed to load any YOLO model: {ex}")
                raise RuntimeError(f"Could not initialize YOLO detector: {ex}")

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect people in a single OpenCV BGR frame.
        Returns a list of dicts:
        [{
            'bbox': [x1, y1, x2, y2],
            'confidence': float,
            'class_id': 0,
            'class_name': 'person'
        }, ...]
        """
        if self.model is None:
            raise RuntimeError("YOLO model is not initialized.")

        # Run inference filtering for person class (class 0 in COCO)
        results = self.model.predict(
            source=frame,
            classes=[0],  # Person class only
            conf=self.conf_threshold,
            device=self.device,
            verbose=False
        )

        detections = []
        if not results or len(results) == 0:
            return detections

        r = results[0]
        if r.boxes is None or len(r.boxes) == 0:
            return detections

        boxes = r.boxes.xyxy.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
        classes = r.boxes.cls.cpu().numpy()

        for box, conf, cls in zip(boxes, confs, classes):
            if int(cls) == 0:  # COCO person
                x1, y1, x2, y2 = [int(v) for v in box]
                detections.append({
                    "bbox": [x1, y1, x2, y2],
                    "confidence": float(round(conf, 4)),
                    "class_id": 0,
                    "class_name": "person"
                })

        return detections
