import os
import shutil
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import torch

from app.config import settings
from app.database.database import init_db, get_db
from app.database import models, schemas
from app.api import videos, search, analysis, results, streams

# Ensure local storage directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
settings.CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
settings.MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Set Ultralytics config dir to avoid non-writable warnings
os.environ["YOLO_CONFIG_DIR"] = str(settings.MODEL_DIR)

# Initialize SQLite database schema
init_db()

app = FastAPI(
    title="VisionTrack AI API",
    description="AI-Powered Person Retrieval and Appearance Matching System for CCTV Surveillance",
    version="1.0.0"
)

# CORS configuration - dynamically allows Vercel and local origins with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for media assets
app.mount("/api/files/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/api/files/outputs", StaticFiles(directory=str(settings.OUTPUT_DIR)), name="outputs")
app.mount("/api/files/candidates", StaticFiles(directory=str(settings.CANDIDATE_DIR)), name="candidates")

# Include Routers
app.include_router(videos.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(analysis.router, prefix=settings.API_V1_STR)
app.include_router(results.router, prefix=settings.API_V1_STR)
app.include_router(streams.router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check():
    """System health check and hardware acceleration telemetry."""
    device_name = "CPU"
    if torch.cuda.is_available():
        device_name = f"CUDA ({torch.cuda.get_device_name(0)})"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device_name = "Apple Silicon MPS (Metal Performance Shaders)"

    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "device": settings.device,
        "device_description": device_name,
        "yolo_model": settings.YOLO_MODEL_NAME,
        "clip_model": settings.CLIP_MODEL_NAME,
        "reid_enabled": settings.ENABLE_REID,
        "directories": {
            "uploads": str(settings.UPLOAD_DIR),
            "outputs": str(settings.OUTPUT_DIR),
            "candidates": str(settings.CANDIDATE_DIR)
        }
    }

@app.get("/api/dashboard/stats", response_model=schemas.DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Computes real aggregate metrics directly from database.
    Distinguishes unique tracks, separate sightings, and frame-level detections.
    """
    completed_videos = db.query(models.Video).filter(models.Video.status == "completed").all()
    total_videos = len(completed_videos)

    total_people_detected = sum(v.total_detections for v in completed_videos)
    unique_tracks = sum(v.unique_tracks_count for v in completed_videos)
    matching_sightings = sum(v.total_sightings_count for v in completed_videos)

    recent_videos = db.query(models.Video).order_by(models.Video.uploaded_at.desc()).limit(5).all()
    recent_jobs = db.query(models.AnalysisJob).order_by(models.AnalysisJob.created_at.desc()).limit(5).all()
    recent_matches = db.query(models.MatchResult).order_by(models.MatchResult.created_at.desc()).limit(8).all()

    # Format recent matches with representative images
    formatted_matches = []
    for m in recent_matches:
        track = m.track
        rep_img_path = Path(track.representative_image_path) if track else None
        rep_url = f"/api/files/candidates/{rep_img_path.name}" if rep_img_path and rep_img_path.exists() else None
        
        formatted_matches.append(schemas.MatchResultResponse(
            id=m.id,
            query_id=m.query_id,
            track_id=m.track_id,
            track_number=track.track_id if track else None,
            representative_image_url=rep_url,
            first_seen=track.first_seen if track else None,
            last_seen=track.last_seen if track else None,
            detection_count=track.detection_count if track else None,
            image_similarity=m.image_similarity,
            text_similarity=m.text_similarity,
            combined_score=m.combined_score,
            match_evidence=None,
            created_at=m.created_at
        ))

    return schemas.DashboardStatsResponse(
        total_videos_processed=total_videos,
        total_people_detected=total_people_detected,
        unique_candidate_tracks=unique_tracks,
        total_matching_sightings=matching_sightings,
        recent_videos=[schemas.VideoResponse.model_validate(v) for v in recent_videos],
        recent_matches=formatted_matches,
        recent_jobs=[schemas.AnalysisJobResponse.model_validate(j) for j in recent_jobs]
    )

@app.get("/")
def root():
    return {
        "message": "VisionTrack AI Backend API",
        "docs": "/docs",
        "health": "/api/health"
    }
