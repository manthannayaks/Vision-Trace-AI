import cv2
import numpy as np
import sys
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.config import settings
from app.database.database import SessionLocal, init_db
from app.database import models
from app.processing.video_processor import VideoProcessor

def create_synthetic_cctv_video(output_path: Path, num_frames: int = 40):
    """Generates a synthetic surveillance test clip with moving pedestrian shapes."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fps = 20.0
    width, height = 640, 480
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    for i in range(num_frames):
        # Dark CCTV hallway background
        frame = np.full((height, width, 3), 40, dtype=np.uint8)
        cv2.line(frame, (0, 380), (width, 380), (70, 70, 70), 2)

        # Walking pedestrian 1: moving left to right
        x = int(60 + (i * 10))
        y = 200
        # Draw torso and head
        cv2.circle(frame, (x + 30, y - 20), 16, (200, 180, 160), -1)  # head
        cv2.rectangle(frame, (x + 10, y), (x + 50, y + 90), (30, 30, 30), -1)  # black hoodie
        cv2.rectangle(frame, (x + 15, y + 90), (x + 45, y + 170), (120, 70, 30), -1)  # blue jeans
        cv2.rectangle(frame, (x + 10, y + 170), (x + 48, y + 185), (240, 240, 240), -1)  # white sneakers

        # Timestamp watermark
        cv2.putText(frame, f"CAM-01 2026-11-08 01:00:{i//20:02d}.{int((i%20)*5):02d}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)

        out.write(frame)

    out.release()
    return output_path

def test_pipeline():
    init_db()
    db = SessionLocal()

    test_video_path = settings.UPLOAD_DIR / "synthetic_cctv_test.mp4"
    create_synthetic_cctv_video(test_video_path, num_frames=30)
    assert test_video_path.exists()

    # Create video record
    video = models.Video(
        filename="synthetic_cctv_test.mp4",
        original_filename="synthetic_cctv_test.mp4",
        duration=1.5,
        fps=20.0,
        width=640,
        height=480,
        total_frames=30,
        status="uploaded"
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    # Create search query
    query = models.SearchQuery(
        description="Person wearing a black hoodie and blue jeans with white sneakers",
        search_mode="text_only",
        image_weight=0.5,
        text_weight=0.5
    )
    db.add(query)
    db.commit()
    db.refresh(query)

    # Create analysis job
    job = models.AnalysisJob(
        video_id=video.id,
        query_id=query.id,
        sample_rate=1,
        status="queued"
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Process job
    processor = VideoProcessor(db)
    result = processor.process_video_job(job.id)
    assert result["status"] == "success"

    # Verify DB records
    db.refresh(video)
    assert video.status == "completed"
    assert video.processed_video_path is not None
    assert Path(video.processed_video_path).exists()

    db.close()
    print("Pipeline test completed successfully!")

if __name__ == "__main__":
    test_pipeline()

