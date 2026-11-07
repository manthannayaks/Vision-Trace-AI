import base64
import json
import shutil
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import models, schemas
from app.database.database import get_db
from app.utils.file_utils import is_valid_image_file, generate_unique_filename

router = APIRouter(prefix="/search", tags=["Search"])

class SearchQueryJSONRequest(BaseModel):
    description: Optional[str] = None
    search_mode: str = "both"
    image_weight: float = 0.50
    text_weight: float = 0.50
    attribute_filters: Optional[str] = None
    reference_image_base64: Optional[str] = None
    reference_image_filename: Optional[str] = "reference.jpg"

@router.post("/create-json", response_model=schemas.SearchQueryResponse)
def create_search_query_json(
    req: SearchQueryJSONRequest,
    db: Session = Depends(get_db)
):
    """
    Create a person search profile via pure JSON.
    Accepts base64 encoded reference photograph to eliminate HTTP/2 multipart proxy issues.
    """
    ref_image_path = None
    if req.reference_image_base64 and len(req.reference_image_base64) > 10:
        try:
            b64_data = req.reference_image_base64
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_data)

            ext = ".jpg"
            if req.reference_image_filename and "." in req.reference_image_filename:
                ext = Path(req.reference_image_filename).suffix.lower()

            unique_name = generate_unique_filename(f"reference{ext}", prefix="ref")
            save_path = settings.UPLOAD_DIR / unique_name
            with open(save_path, "wb") as buffer:
                buffer.write(img_bytes)
            ref_image_path = str(save_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process reference image: {e}")

    query_obj = models.SearchQuery(
        reference_image_path=ref_image_path,
        description=req.description.strip() if req.description else None,
        search_mode=req.search_mode,
        attribute_filters=req.attribute_filters,
        image_weight=req.image_weight,
        text_weight=req.text_weight
    )
    db.add(query_obj)
    db.commit()
    db.refresh(query_obj)
    return query_obj

@router.post("/create", response_model=schemas.SearchQueryResponse)
async def create_search_query(
    reference_image: Optional[UploadFile] = File(None),
    description: Optional[str] = Form(None),
    search_mode: str = Form("both"),  # "image_only", "text_only", "both"
    image_weight: float = Form(0.50),
    text_weight: float = Form(0.50),
    attribute_filters: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Create a person search profile.
    Supports reference photograph upload, natural-language visual description, or both.
    """
    ref_image_path = None
    if reference_image is not None and reference_image.filename:
        if not is_valid_image_file(reference_image.filename):
            raise HTTPException(
                status_code=400,
                detail="Invalid image format. Allowed: .jpg, .jpeg, .png, .webp"
            )
        unique_img_name = generate_unique_filename(reference_image.filename, prefix="ref")
        save_path = settings.UPLOAD_DIR / unique_img_name
        try:
            contents = await reference_image.read()
            with open(save_path, "wb") as buffer:
                buffer.write(contents)
            ref_image_path = str(save_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to store reference photograph: {e}")

    # Validate search mode inputs
    if search_mode == "image_only" and not ref_image_path:
        raise HTTPException(status_code=400, detail="Search mode 'image_only' requires a reference photograph.")
    elif search_mode == "text_only" and (not description or not description.strip()):
        raise HTTPException(status_code=400, detail="Search mode 'text_only' requires a natural-language description.")
    elif search_mode == "both" and not ref_image_path and (not description or not description.strip()):
        raise HTTPException(status_code=400, detail="Search mode 'both' requires either reference image or description.")

    query_obj = models.SearchQuery(
        reference_image_path=ref_image_path,
        description=description.strip() if description else None,
        search_mode=search_mode,
        attribute_filters=attribute_filters,
        image_weight=image_weight,
        text_weight=text_weight
    )
    db.add(query_obj)
    db.commit()
    db.refresh(query_obj)

    return query_obj

@router.get("/{query_id}", response_model=schemas.SearchQueryResponse)
def get_search_query(query_id: int, db: Session = Depends(get_db)):
    """Fetch search query details."""
    q = db.query(models.SearchQuery).filter(models.SearchQuery.id == query_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Search query not found")
    return q

@router.get("/", response_model=List[schemas.SearchQueryResponse])
def list_search_queries(db: Session = Depends(get_db)):
    """List recent search queries."""
    return db.query(models.SearchQuery).order_by(models.SearchQuery.created_at.desc()).limit(20).all()

