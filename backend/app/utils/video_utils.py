import cv2
from pathlib import Path
from typing import Dict, Any, Tuple

def get_video_metadata(video_path: Path) -> Dict[str, Any]:
    """Extract metadata (duration, fps, width, height, total_frames) from a video."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Unable to open video file at {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0.0

    cap.release()

    return {
        "fps": round(fps, 2),
        "total_frames": total_frames,
        "width": width,
        "height": height,
        "duration": round(duration, 2)
    }

def create_video_writer(output_path: Path, fps: float, frame_size: Tuple[int, int]) -> cv2.VideoWriter:
    """Create cv2.VideoWriter using web-compatible H.264 (avc1) with mp4v fallback."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Prefer avc1 for native browser playback
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    writer = cv2.VideoWriter(str(output_path), fourcc, fps, frame_size)
    if not writer.isOpened():
        # Fallback to mp4v if avc1 is unsupported
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(str(output_path), fourcc, fps, frame_size)
    return writer
