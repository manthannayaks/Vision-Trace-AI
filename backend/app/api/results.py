import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import models, schemas
from app.database.database import get_db

router = APIRouter(tags=["Results & Tracks"])

@router.get("/results/{analysis_id}")
def get_analysis_results(
    analysis_id: int,
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    tier: Optional[str] = Query(None, description="high, medium, low"),
    db: Session = Depends(get_db)
):
    """
    Get ranked candidate search results for an analysis job.
    Includes representative screenshot, component similarities, sighting intervals, and evidence breakdown.
    """
    job = db.query(models.AnalysisJob).filter(models.AnalysisJob.id == analysis_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")

    video = db.query(models.Video).filter(models.Video.id == job.video_id).first()
    query = db.query(models.SearchQuery).filter(models.SearchQuery.id == job.query_id).first() if job.query_id else None

    # Fetch match results associated with this query and video's tracks
    matches_query = db.query(models.MatchResult).join(models.PersonTrack).filter(
        models.PersonTrack.video_id == job.video_id
    )
    if job.query_id:
        matches_query = matches_query.filter(models.MatchResult.query_id == job.query_id)

    matches = matches_query.order_by(models.MatchResult.combined_score.desc()).all()

    # Resolve threshold and tier if called directly outside FastAPI injection
    threshold = float(min_score) if isinstance(min_score, (int, float)) else float(getattr(min_score, 'default', 0.0))
    tier_val = tier if isinstance(tier, str) else getattr(tier, 'default', None)

    # If no search query was attached to the job, retrieve all detected person tracks
    candidates = []
    if matches:
        for m in matches:
            if m.combined_score < threshold:
                continue

            track = m.track
            sightings = db.query(models.Sighting).filter(models.Sighting.track_id == track.id).all()
            evidence = json.loads(m.match_evidence) if m.match_evidence else {}
            attributes = json.loads(track.detected_attributes) if track.detected_attributes else {}

            # Filter by tier if specified
            if tier_val:
                t_lower = tier_val.lower()
                r_tier = evidence.get("ranking_tier", "").lower()
                if t_lower == "high" and "high" not in r_tier:
                    continue
                elif t_lower == "medium" and "moderate" not in r_tier:
                    continue
                elif t_lower == "low" and "low" not in r_tier:
                    continue

            # Candidate image web URL
            rep_img_path = Path(track.representative_image_path)
            rep_url = f"/api/files/candidates/{rep_img_path.name}" if rep_img_path.exists() else None

            is_match = bool(evidence.get("is_match", m.combined_score >= 0.50))
            candidates.append({
                "match_id": m.id,
                "track_db_id": track.id,
                "track_id": track.track_id,
                "representative_image_url": rep_url,
                "first_seen": track.first_seen,
                "last_seen": track.last_seen,
                "detection_count": track.detection_count,
                "sightings_count": len(sightings),
                "sightings": [
                    {
                        "start_timestamp": s.start_timestamp,
                        "end_timestamp": s.end_timestamp,
                        "frame_count": s.frame_count,
                        "duration": round(s.end_timestamp - s.start_timestamp, 2)
                    } for s in sightings
                ],
                "image_similarity": m.image_similarity,
                "text_similarity": m.text_similarity,
                "combined_score": m.combined_score,
                "is_match": is_match,
                "ranking_tier": evidence.get("ranking_tier", "Unranked"),
                "detected_attributes": attributes.get("summary", "N/A"),
                "attribute_details": attributes.get("attributes", {}),
                "match_evidence": evidence
            })
    else:
        # No search query - return raw person tracks
        tracks = db.query(models.PersonTrack).filter(models.PersonTrack.video_id == job.video_id).all()
        for track in tracks:
            sightings = db.query(models.Sighting).filter(models.Sighting.track_id == track.id).all()
            attributes = json.loads(track.detected_attributes) if track.detected_attributes else {}
            rep_img_path = Path(track.representative_image_path)
            rep_url = f"/api/files/candidates/{rep_img_path.name}" if rep_img_path.exists() else None

            candidates.append({
                "match_id": None,
                "track_db_id": track.id,
                "track_id": track.track_id,
                "representative_image_url": rep_url,
                "first_seen": track.first_seen,
                "last_seen": track.last_seen,
                "detection_count": track.detection_count,
                "sightings_count": len(sightings),
                "sightings": [
                    {
                        "start_timestamp": s.start_timestamp,
                        "end_timestamp": s.end_timestamp,
                        "frame_count": s.frame_count,
                        "duration": round(s.end_timestamp - s.start_timestamp, 2)
                    } for s in sightings
                ],
                "image_similarity": None,
                "text_similarity": None,
                "combined_score": 0.0,
                "is_match": False,
                "ranking_tier": "Raw Detection",
                "detected_attributes": attributes.get("summary", "N/A"),
                "attribute_details": attributes.get("attributes", {}),
                "match_evidence": {"disclaimer": "Track recorded without target appearance query."}
            })

    output_video_url = None
    if video and video.processed_video_path:
        out_name = Path(video.processed_video_path).name
        output_video_url = f"/api/files/outputs/{out_name}"

    original_video_url = None
    if video and video.filename:
        original_video_url = f"/api/files/uploads/{video.filename}"

    # Calculate actual potential matches that met the appearance criteria
    potential_matches_count = sum(
        1 for c in candidates
        if c.get("is_match") or c.get("combined_score", 0.0) >= 0.50
    ) if query else 0

    return {
        "analysis_id": job.id,
        "video": {
            "id": video.id if video else None,
            "filename": video.filename if video else None,
            "original_filename": video.original_filename if video else None,
            "duration": video.duration if video else 0.0,
            "fps": video.fps if video else 0.0,
            "total_detections": video.total_detections if video else 0,
            "unique_tracks_count": video.unique_tracks_count if video else 0,
            "total_sightings_count": video.total_sightings_count if video else 0,
            "original_video_url": original_video_url,
            "annotated_video_url": output_video_url
        },
        "query": {
            "id": query.id if query else None,
            "description": query.description if query else None,
            "search_mode": query.search_mode if query else None,
            "reference_image_url": f"/api/files/uploads/{Path(query.reference_image_path).name}" if query and query.reference_image_path else None
        } if query else None,
        "total_candidates": len(candidates),
        "potential_matches": potential_matches_count,
        "has_target_matches": potential_matches_count > 0,
        "candidates": candidates
    }

@router.get("/tracks/{track_id}")
def get_track_details(track_id: int, db: Session = Depends(get_db)):
    """Fetch complete telemetry, sightings timeline, and attributes for a track."""
    track = db.query(models.PersonTrack).filter(models.PersonTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    sightings = db.query(models.Sighting).filter(models.Sighting.track_id == track.id).all()
    rep_img_path = Path(track.representative_image_path)
    rep_url = f"/api/files/candidates/{rep_img_path.name}" if rep_img_path.exists() else None

    attributes = json.loads(track.detected_attributes) if track.detected_attributes else {}

    return {
        "id": track.id,
        "video_id": track.video_id,
        "track_id": track.track_id,
        "first_seen": track.first_seen,
        "last_seen": track.last_seen,
        "detection_count": track.detection_count,
        "average_confidence": track.average_confidence,
        "representative_image_url": rep_url,
        "detected_attributes": attributes,
        "sightings": [
            {
                "id": s.id,
                "start_timestamp": s.start_timestamp,
                "end_timestamp": s.end_timestamp,
                "frame_count": s.frame_count,
                "duration": round(s.end_timestamp - s.start_timestamp, 2)
            } for s in sightings
        ]
    }

