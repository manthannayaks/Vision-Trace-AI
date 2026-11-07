from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.database import Base

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    duration = Column(Float, default=0.0)
    fps = Column(Float, default=0.0)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    total_frames = Column(Integer, default=0)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="uploaded")  # uploaded, queued, processing, completed, failed
    processed_video_path = Column(String(512), nullable=True)
    total_detections = Column(Integer, default=0)
    unique_tracks_count = Column(Integer, default=0)
    total_sightings_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

    tracks = relationship("PersonTrack", back_populates="video", cascade="all, delete-orphan")
    analysis_jobs = relationship("AnalysisJob", back_populates="video", cascade="all, delete-orphan")

class SearchQuery(Base):
    __tablename__ = "search_queries"

    id = Column(Integer, primary_key=True, index=True)
    reference_image_path = Column(String(512), nullable=True)
    description = Column(Text, nullable=True)
    search_mode = Column(String(50), default="both")  # image_only, text_only, both
    attribute_filters = Column(Text, nullable=True)  # JSON string of attributes
    image_weight = Column(Float, default=0.5)
    text_weight = Column(Float, default=0.5)
    created_at = Column(DateTime, default=datetime.utcnow)

    matches = relationship("MatchResult", back_populates="query", cascade="all, delete-orphan")
    analysis_jobs = relationship("AnalysisJob", back_populates="query")

class PersonTrack(Base):
    __tablename__ = "person_tracks"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    track_id = Column(Integer, nullable=False, index=True)  # ByteTrack ID
    first_seen = Column(Float, default=0.0)  # timestamp in seconds
    last_seen = Column(Float, default=0.0)   # timestamp in seconds
    detection_count = Column(Integer, default=0)
    representative_image_path = Column(String(512), nullable=False)
    average_confidence = Column(Float, default=0.0)
    detected_attributes = Column(Text, nullable=True)  # JSON string of extracted attributes

    video = relationship("Video", back_populates="tracks")
    sightings = relationship("Sighting", back_populates="track", cascade="all, delete-orphan")
    matches = relationship("MatchResult", back_populates="track", cascade="all, delete-orphan")

class Sighting(Base):
    __tablename__ = "sightings"

    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("person_tracks.id"), nullable=False, index=True)
    start_timestamp = Column(Float, default=0.0)
    end_timestamp = Column(Float, default=0.0)
    frame_count = Column(Integer, default=0)

    track = relationship("PersonTrack", back_populates="sightings")

class MatchResult(Base):
    __tablename__ = "match_results"

    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey("search_queries.id"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("person_tracks.id"), nullable=False, index=True)
    image_similarity = Column(Float, nullable=True)
    text_similarity = Column(Float, nullable=True)
    combined_score = Column(Float, nullable=False)
    match_evidence = Column(Text, nullable=True)  # JSON string with component breakdown
    created_at = Column(DateTime, default=datetime.utcnow)

    query = relationship("SearchQuery", back_populates="matches")
    track = relationship("PersonTrack", back_populates="matches")

class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    query_id = Column(Integer, ForeignKey("search_queries.id"), nullable=True, index=True)
    status = Column(String(50), default="queued")  # queued, processing, matching, completed, failed
    progress = Column(Float, default=0.0)  # 0 to 100
    current_step = Column(String(255), default="Initializing")
    sample_rate = Column(Integer, default=2)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    video = relationship("Video", back_populates="analysis_jobs")
    query = relationship("SearchQuery", back_populates="analysis_jobs")

