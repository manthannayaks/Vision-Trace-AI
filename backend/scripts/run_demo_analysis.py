import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.database.database import SessionLocal, init_db
from app.database import models
from app.processing.video_processor import VideoProcessor

def run_demo_analysis():
    init_db()
    db = SessionLocal()

    video = db.query(models.Video).filter(models.Video.filename == "cctv_hallway_demo.mp4").first()
    if not video:
        print("Demo video not found.")
        return

    # Check or create target query
    query = db.query(models.SearchQuery).filter(
        models.SearchQuery.description.like("%black hoodie%")
    ).first()

    if not query:
        query = models.SearchQuery(
            description="Person wearing a black hoodie, blue jeans, white sneakers and carrying a black backpack. Slim build.",
            search_mode="text_only",
            image_weight=0.50,
            text_weight=0.50,
            attribute_filters='{"upperClothing": "hoodie", "upperColor": "black", "lowerClothing": "jeans", "lowerColor": "blue", "headwear": "hood covering head", "bag": "backpack", "footwear": "white sneakers"}'
        )
        db.add(query)
        db.commit()
        db.refresh(query)
        print(f"Created demo query ID: {query.id}")

    # Create job
    job = models.AnalysisJob(
        video_id=video.id,
        query_id=query.id,
        sample_rate=2,
        status="queued"
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    print(f"Starting analysis for Job ID {job.id} on Video ID {video.id}...")
    processor = VideoProcessor(db)
    res = processor.process_video_job(job.id)
    print("Demo analysis completed successfully!")
    print(res)

    db.close()

if __name__ == "__main__":
    run_demo_analysis()

