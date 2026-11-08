import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import torch

# Base directories
BACKEND_DIR = Path(__file__).resolve().parent.parent
BASE_DIR = BACKEND_DIR.parent

class Settings(BaseSettings):
    APP_NAME: str = "VisionTrack AI"
    API_V1_STR: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # Base directories exposed as attributes
    BACKEND_DIR: Path = BACKEND_DIR
    BASE_DIR: Path = BASE_DIR

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

    # Directories
    UPLOAD_DIR: Path = BACKEND_DIR / "uploads"
    OUTPUT_DIR: Path = BACKEND_DIR / "outputs"
    CANDIDATE_DIR: Path = BACKEND_DIR / "candidate_images"
    MODEL_DIR: Path = BACKEND_DIR / "models"
    DATABASE_URL: str = f"sqlite:///{BACKEND_DIR / 'visiontrack.db'}"

    # ML Configuration
    DEVICE_OVERRIDE: str = "auto"
    YOLO_MODEL_NAME: str = "yolo11n.pt"  # Will fallback to yolov8n.pt if needed
    CLIP_MODEL_NAME: str = "openai/clip-vit-base-patch32"
    ENABLE_REID: bool = True
    
    # Video Processing & Storage Management Defaults
    DEFAULT_FRAME_SAMPLE_RATE: int = 2
    DETECTION_CONFIDENCE: float = 0.35
    TRACKER_IOU_THRESHOLD: float = 0.5
    DEFAULT_IMAGE_WEIGHT: float = 0.50
    DEFAULT_TEXT_WEIGHT: float = 0.50
    
    # Lightweight storage settings (avoids storing large videos)
    AUTO_DELETE_UPLOADED_VIDEO: bool = False  # If True, removes raw video after processing
    KEEP_ONLY_CANDIDATE_CROPS: bool = False   # If True, skips saving full annotated video

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    @property
    def device(self) -> str:
        """Auto-detect optimal hardware acceleration (CUDA, MPS for Apple Silicon, or CPU)."""
        if self.DEVICE_OVERRIDE and self.DEVICE_OVERRIDE != "auto":
            return self.DEVICE_OVERRIDE
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
settings.CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
settings.MODEL_DIR.mkdir(parents=True, exist_ok=True)
