from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# Base schemas
class VideoBase(BaseModel):
    filename: str
    original_filename: str

class VideoCreate(VideoBase):
    duration: float = 0.0
    fps: float = 0.0
    width: int = 0
    height: int = 0
    total_frames: int = 0

class VideoResponse(VideoBase):
    id: int
    duration: float
    fps: float
    width: int
    height: int
    total_frames: int
    uploaded_at: datetime
    status: str
    processed_video_path: Optional[str] = None
    total_detections: int = 0
    unique_tracks_count: int = 0
    total_sightings_count: int = 0
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# Search Query Schemas
class SearchQueryCreate(BaseModel):
    description: Optional[str] = None
    search_mode: str = Field(default="both", description="image_only, text_only, both")
    attribute_filters: Optional[Dict[str, Any]] = None
    image_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    text_weight: float = Field(default=0.5, ge=0.0, le=1.0)

class SearchQueryResponse(BaseModel):
    id: int
    reference_image_path: Optional[str] = None
    description: Optional[str] = None
    search_mode: str
    attribute_filters: Optional[str] = None
    image_weight: float
    text_weight: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Sighting Schemas
class SightingResponse(BaseModel):
    id: int
    track_id: int
    start_timestamp: float
    end_timestamp: float
    frame_count: int

    model_config = ConfigDict(from_attributes=True)

# Person Track Schemas
class PersonTrackResponse(BaseModel):
    id: int
    video_id: int
    track_id: int
    first_seen: float
    last_seen: float
    detection_count: int
    representative_image_path: str
    average_confidence: float
    detected_attributes: Optional[str] = None
    sightings: List[SightingResponse] = []

    model_config = ConfigDict(from_attributes=True)

# Match Result Schemas
class MatchResultResponse(BaseModel):
    id: int
    query_id: int
    track_id: int
    track_number: Optional[int] = None
    representative_image_url: Optional[str] = None
    first_seen: Optional[float] = None
    last_seen: Optional[float] = None
    detection_count: Optional[int] = None
    sightings_count: Optional[int] = None
    image_similarity: Optional[float] = None
    text_similarity: Optional[float] = None
    combined_score: float
    match_evidence: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Analysis Job Schemas
class AnalysisStartRequest(BaseModel):
    video_id: int
    query_id: Optional[int] = None
    sample_rate: int = Field(default=2, ge=1, le=10)
    confidence_threshold: float = Field(default=0.35, ge=0.1, le=1.0)
    image_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    text_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    auto_delete_raw: bool = Field(default=False, description="Auto-delete raw video after analysis to save disk space")
    skip_annotated_video: bool = Field(default=False, description="Only extract candidate screenshots without rendering full annotated video")

class AnalysisJobResponse(BaseModel):
    id: int
    video_id: int
    query_id: Optional[int] = None
    status: str
    progress: float
    current_step: str
    sample_rate: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Overall System Stats for Dashboard
class DashboardStatsResponse(BaseModel):
    total_videos_processed: int
    total_people_detected: int
    unique_candidate_tracks: int
    total_matching_sightings: int
    recent_videos: List[VideoResponse] = []
    recent_matches: List[MatchResultResponse] = []
    recent_jobs: List[AnalysisJobResponse] = []
