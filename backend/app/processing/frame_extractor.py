import cv2
import logging
from pathlib import Path
from typing import Generator, Tuple, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)

class FrameExtractor:
    """
    Video Frame Extractor with uniform temporal sampling and timestamp tracking.
    """
    def __init__(self, video_path: Path, sample_rate: int = 2):
        self.video_path = video_path
        self.sample_rate = max(1, sample_rate)
        self.cap = cv2.VideoCapture(str(video_path))
        if not self.cap.isOpened():
            raise ValueError(f"Unable to open video: {video_path}")

        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 25.0
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.duration = self.total_frames / self.fps if self.fps > 0 else 0.0

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "fps": round(self.fps, 2),
            "total_frames": self.total_frames,
            "width": self.width,
            "height": self.height,
            "duration": round(self.duration, 2)
        }

    def iterate_frames(self) -> Generator[Tuple[int, float, np.ndarray], None, None]:
        """
        Yields (frame_idx, timestamp_in_seconds, frame_bgr) for sampled frames.
        Original timestamps are preserved accurately according to video fps.
        """
        frame_idx = 0
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret or frame is None:
                break

            if frame_idx % self.sample_rate == 0:
                timestamp = frame_idx / self.fps
                yield frame_idx, round(timestamp, 2), frame

            frame_idx += 1

    def release(self):
        if self.cap and self.cap.isOpened():
            self.cap.release()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()

