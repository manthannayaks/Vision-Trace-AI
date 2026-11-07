import os
import re
import uuid
from pathlib import Path
from typing import Set

ALLOWED_VIDEO_EXTENSIONS: Set[str] = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
ALLOWED_IMAGE_EXTENSIONS: Set[str] = {".jpg", ".jpeg", ".png", ".webp", ".jfif", ".bmp", ".heic", ".tiff"}

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and remove unsafe chars."""
    basename = os.path.basename(filename)
    clean_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', basename)
    return clean_name

def generate_unique_filename(original_filename: str, prefix: str = "") -> str:
    """Generate a unique filename preserving the original extension."""
    ext = Path(original_filename).suffix.lower()
    unique_id = uuid.uuid4().hex[:8]
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '', Path(original_filename).stem)[:20]
    if prefix:
        return f"{prefix}_{sanitized}_{unique_id}{ext}"
    return f"{sanitized}_{unique_id}{ext}"

def is_valid_video_file(filename: str) -> bool:
    """Check if the file extension is an allowed video format."""
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_VIDEO_EXTENSIONS

def is_valid_image_file(filename: str) -> bool:
    """Check if the file extension is an allowed image format."""
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS

