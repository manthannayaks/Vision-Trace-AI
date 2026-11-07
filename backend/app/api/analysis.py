import logging
import multiprocessing
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import models, schemas
from app.database.database import get_db, SessionLocal
from app.processing.video_processor import VideoProcessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["Analysis"])

def run_analysis_worker(job_id: int, auto_delete_raw: bool = False, skip_annotated_video: bool = False):
    """Background worker that opens an independent DB session and processes video."""
    db = SessionLocal()
    try:
        # Immediately transition job to processing so frontend polling sees progress
        job = db.query(models.AnalysisJob).filter(models.AnalysisJob.id == job_id).first()
        if job:
            job.status = "processing"
            job.progress = 5.0
            job.current_step = "Initializing surveillance detection models..."
            db.commit()

        processor = VideoProcessor(db)
        processor.process_video_job(
            job_id=job_id,
            auto_delete_raw=auto_delete_raw,
            skip_annotated_video=skip_annotated_video
        )
    except Exception as e:
        logger.error(f"Background worker failed for job {job_id}: {e}", exc_info=True)
        try:
            job = db.query(models.AnalysisJob).filter(models.AnalysisJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                video = db.query(models.Video).filter(models.Video.id == job.video_id).first()
                if video:
                    video.status = "failed"
                    video.error_message = str(e)
                db.commit()
        except Exception as db_err:
            logger.error(f"Failed to record failure state for job {job_id}: {db_err}")
    finally:
        db.close()

@router.post("/start", response_model=schemas.AnalysisJobResponse)
def start_analysis(
    req: schemas.AnalysisStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Queue background CCTV video analysis job.
    Processes person detection, ByteTrack tracking, appearance matching, and video annotation asynchronously.
    """
    video = db.query(models.Video).filter(models.Video.id == req.video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if req.query_id:
        query = db.query(models.SearchQuery).filter(models.SearchQuery.id == req.query_id).first()
        if not query:
            raise HTTPException(status_code=404, detail="Search query not found")
        # Update weights if passed
        query.image_weight = req.image_weight
        query.text_weight = req.text_weight
        db.commit()

    job = models.AnalysisJob(
        video_id=req.video_id,
        query_id=req.query_id,
        status="queued",
        progress=0.0,
        current_step="Queued for analysis",
        sample_rate=req.sample_rate
    )
    db.add(job)
    video.status = "queued"
    db.commit()
    db.refresh(job)

    # Launch dedicated worker process so CPU inference never blocks the Uvicorn web server
    ctx = multiprocessing.get_context("spawn")
    proc = ctx.Process(
        target=run_analysis_worker,
        args=(job.id, req.auto_delete_raw, req.skip_annotated_video),
        daemon=True
    )
    proc.start()

    return job

@router.get("/{analysis_id}", response_model=schemas.AnalysisJobResponse)
def get_analysis_status(analysis_id: int, db: Session = Depends(get_db)):
    """Fetch status and current step of an analysis job."""
    job = db.query(models.AnalysisJob).filter(models.AnalysisJob.id == analysis_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job

@router.get("/{analysis_id}/progress")
def get_analysis_progress(analysis_id: int, db: Session = Depends(get_db)):
    """Lightweight polling endpoint returning progress percentage and current step."""
    job = db.query(models.AnalysisJob).filter(models.AnalysisJob.id == analysis_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")

    return {
        "id": job.id,
        "video_id": job.video_id,
        "query_id": job.query_id,
        "status": job.status,
        "progress": job.progress,
        "current_step": job.current_step,
        "error_message": job.error_message
    }

@router.get("/", response_model=List[schemas.AnalysisJobResponse])
def list_analysis_jobs(db: Session = Depends(get_db)):
    """List recent analysis jobs."""
    return db.query(models.AnalysisJob).order_by(models.AnalysisJob.created_at.desc()).limit(20).all()

@router.delete("/{analysis_id}")
def delete_analysis_job(analysis_id: int, db: Session = Depends(get_db)):
    """Cancel or delete an analysis job record."""
    job = db.query(models.AnalysisJob).filter(models.AnalysisJob.id == analysis_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    db.delete(job)
    db.commit()
    return {"status": "deleted", "id": analysis_id}

