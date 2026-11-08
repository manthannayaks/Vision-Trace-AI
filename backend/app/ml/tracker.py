import os
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from pathlib import Path
from app.config import settings, BACKEND_DIR, BASE_DIR

os.environ["YOLO_CONFIG_DIR"] = str(settings.MODEL_DIR)
from ultralytics import YOLO
from app.utils.image_utils import crop_person

logger = logging.getLogger(__name__)

class TrackInfo:
    """Stores track lifetime metrics and representative appearance."""
    def __init__(self, track_id: int, initial_timestamp: float, frame_idx: int, crop: Optional[np.ndarray], conf: float, bbox: List[int]):
        self.track_id = track_id
        self.first_seen = initial_timestamp
        self.last_seen = initial_timestamp
        self.detection_count = 1
        self.confidence_sum = conf
        self.max_conf = conf
        self.representative_crop = crop
        self.representative_bbox = bbox
        self.representative_timestamp = initial_timestamp
        self.representative_frame_idx = frame_idx
        self.sightings_timestamps: List[float] = [initial_timestamp]

    def update(self, timestamp: float, frame_idx: int, crop: Optional[np.ndarray], conf: float, bbox: List[int]):
        self.last_seen = timestamp
        self.detection_count += 1
        self.confidence_sum += conf
        self.sightings_timestamps.append(timestamp)

        # Update representative crop if confidence is significantly higher or current crop is None
        if (self.representative_crop is None) or (conf > self.max_conf and crop is not None):
            self.max_conf = conf
            self.representative_crop = crop
            self.representative_bbox = bbox
            self.representative_timestamp = timestamp
            self.representative_frame_idx = frame_idx

    @property
    def average_confidence(self) -> float:
        return self.confidence_sum / self.detection_count if self.detection_count > 0 else 0.0


class PersonTracker:
    """
    ByteTrack-based multi-person tracker using Ultralytics tracking API.
    Maintains track identity continuity, timestamps, and representative crops.
    """
    def __init__(self, model_name: Optional[str] = None, conf_threshold: Optional[float] = None):
        self.model_name = model_name or settings.YOLO_MODEL_NAME
        self.conf_threshold = conf_threshold or settings.DETECTION_CONFIDENCE
        self.device = settings.device
        self.model = None
        self.active_tracks: Dict[int, TrackInfo] = {}
        self._load_model()

    def _load_model(self):
        candidate_paths = [
            BACKEND_DIR / "yolo11n.pt",
            BASE_DIR / "yolo11n.pt",
            Path("yolo11n.pt"),
            Path("backend/yolo11n.pt"),
        ]
        target_model = self.model_name
        for p in candidate_paths:
            if p.exists():
                target_model = str(p)
                break
        logger.info(f"Loading YOLO tracking model from: {target_model}")
        try:
            self.model = YOLO(target_model)
        except Exception as e:
            logger.warning(f"Failed to load '{target_model}': {e}. Falling back to 'yolov8n.pt'...")
            self.model = YOLO("yolov8n.pt")

    def reset(self):
        """Reset internal track registry for a new video analysis."""
        self.active_tracks.clear()

    def unload(self):
        """Releases model from memory to keep RAM minimal on cloud containers."""
        if self.model is not None:
            del self.model
            self.model = None

    def track_frame(self, frame: np.ndarray, timestamp: float, frame_idx: int) -> List[Dict[str, Any]]:
        """
        Processes a single video frame with ByteTrack.
        Returns list of track detections:
        [{
            'track_id': int,
            'bbox': [x1, y1, x2, y2],
            'confidence': float,
            'crop': np.ndarray (person crop)
        }, ...]
        """
        if self.model is None:
            raise RuntimeError("Tracking model is not loaded.")

        results = self.model.track(
            source=frame,
            persist=True,
            tracker="bytetrack.yaml",
            classes=[0],  # Person class only
            conf=self.conf_threshold,
            device=self.device,
            verbose=False
        )

        frame_tracks = []
        if not results or len(results) == 0:
            return frame_tracks

        r = results[0]
        if r.boxes is None or len(r.boxes) == 0:
            return frame_tracks

        boxes = r.boxes.xyxy.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
        track_ids = r.boxes.id.cpu().numpy() if r.boxes.id is not None else None

        for i, box in enumerate(boxes):
            conf = float(confs[i])
            # If tracker hasn't assigned an ID yet, skip or assign temporary
            if track_ids is None or track_ids[i] is None or np.isnan(track_ids[i]):
                continue

            t_id = int(track_ids[i])
            bbox = [int(v) for v in box]
            crop = crop_person(frame, bbox)

            if t_id not in self.active_tracks:
                self.active_tracks[t_id] = TrackInfo(
                    track_id=t_id,
                    initial_timestamp=timestamp,
                    frame_idx=frame_idx,
                    crop=crop,
                    conf=conf,
                    bbox=bbox
                )
            else:
                self.active_tracks[t_id].update(
                    timestamp=timestamp,
                    frame_idx=frame_idx,
                    crop=crop,
                    conf=conf,
                    bbox=bbox
                )

            frame_tracks.append({
                "track_id": t_id,
                "bbox": bbox,
                "confidence": round(conf, 4),
                "crop": crop
            })

        return frame_tracks
