import os
import shutil
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session

from app.config import settings
from app.database import models, schemas
from app.database.database import get_db
from app.utils.file_utils import is_valid_video_file, generate_unique_filename
from app.utils.video_utils import get_video_metadata

router = APIRouter(prefix="/videos", tags=["Videos"])

@router.post("/upload", response_model=schemas.VideoResponse)
async def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload CCTV surveillance video file.
    Validates file extension, extracts metadata (duration, FPS, resolution), and stores record.
    """
    if not is_valid_video_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail="Invalid video format. Allowed extensions: .mp4, .avi, .mov, .mkv, .webm"
        )

    unique_filename = generate_unique_filename(file.filename, prefix="cctv")
    save_path = settings.UPLOAD_DIR / unique_filename

    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {e}")

    try:
        meta = get_video_metadata(save_path)
    except Exception as e:
        # If metadata extraction fails, remove file and return error
        if save_path.exists():
            os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"Failed to read video metadata: {e}")

    video_record = models.Video(
        filename=unique_filename,
        original_filename=file.filename,
        duration=meta["duration"],
        fps=meta["fps"],
        width=meta["width"],
        height=meta["height"],
        total_frames=meta["total_frames"],
        status="uploaded"
    )
    db.add(video_record)
    db.commit()
    db.refresh(video_record)

    return video_record

@router.get("/", response_model=List[schemas.VideoResponse])
def list_videos(db: Session = Depends(get_db)):
    """List all uploaded CCTV surveillance videos."""
    return db.query(models.Video).order_by(models.Video.uploaded_at.desc()).all()

@router.get("/{video_id}", response_model=schemas.VideoResponse)
def get_video(video_id: int, db: Session = Depends(get_db)):
    """Fetch video metadata and processing state."""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@router.delete("/{video_id}")
def delete_video(video_id: int, db: Session = Depends(get_db)):
    """
    Delete video and associated large files to free up disk space.
    Removes the raw uploaded video and annotated output video from disk.
    """
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # 1. Delete raw upload file if exists
    raw_path = settings.UPLOAD_DIR / video.filename
    if raw_path.exists():
        try:
            os.remove(raw_path)
        except Exception as e:
            pass

    # 2. Delete annotated output video if exists
    if video.processed_video_path:
        out_path = Path(video.processed_video_path)
        if out_path.exists():
            try:
                os.remove(out_path)
            except Exception as e:
                pass

    # 3. Remove DB record and cascades
    db.delete(video)
    db.commit()

    return {"status": "deleted", "video_id": video_id, "message": "Video files safely deleted from disk."}

@router.post("/purge-storage")
def purge_large_videos(db: Session = Depends(get_db)):
    """
    Lightweight mode maintenance:
    Deletes all raw uploaded videos from disk, preserving candidate crops and database metrics.
    """
    deleted_files = 0
    for f in settings.UPLOAD_DIR.glob("*"):
        if f.is_file() and f.suffix.lower() in [".mp4", ".avi", ".mov", ".mkv", ".webm"]:
            try:
                os.remove(f)
                deleted_files += 1
            except Exception:
                pass

    return {
        "status": "success",
        "purged_count": deleted_files,
        "message": f"Successfully purged {deleted_files} raw video files to free up disk space."
    }

