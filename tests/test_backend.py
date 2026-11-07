import pytest
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.main import app
from app.ml.ranking import RankingEngine
from app.processing.counting import CountingEngine

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "device" in data
    assert "yolo_model" in data

def test_dashboard_stats_endpoint():
    response = client.get("/api/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_videos_processed" in data
    assert "unique_candidate_tracks" in data
    assert isinstance(data["recent_videos"], list)

def test_ranking_engine_multimodal():
    engine = RankingEngine(default_image_weight=0.5, default_text_weight=0.5)
    
    # Multimodal test
    res = engine.calculate_score(image_similarity=0.80, text_similarity=0.60)
    assert res["combined_score"] == 0.70
    assert "disclaimer" in res["evidence"]
    assert res["evidence"]["ranking_tier"] == "High Similarity Match"

    # Image only test
    res_img = engine.calculate_score(image_similarity=0.75, text_similarity=None)
    assert res_img["combined_score"] == 0.75
    assert res_img["evidence"]["mode"] == "image_only"

    # Text only test
    res_txt = engine.calculate_score(image_similarity=None, text_similarity=0.65)
    assert res_txt["combined_score"] == 0.65
    assert res_txt["evidence"]["mode"] == "text_only"

def test_counting_engine_sightings():
    counter = CountingEngine(sighting_gap_threshold_sec=3.0)
    
    # 2 distinct sighting intervals: [1.0, 1.5, 2.0] and [10.0, 10.5]
    timestamps = [1.0, 1.5, 2.0, 10.0, 10.5]
    sightings = counter.extract_sightings(timestamps)
    
    assert len(sightings) == 2
    assert sightings[0].start_timestamp == 1.0
    assert sightings[0].end_timestamp == 2.0
    assert sightings[0].frame_count == 3
    assert sightings[1].start_timestamp == 10.0
    assert sightings[1].end_timestamp == 10.5
    assert sightings[1].frame_count == 2

def test_search_query_creation():
    # Test text-only query creation
    response = client.post(
        "/api/search/create",
        data={
            "description": "Person in black hoodie and blue jeans",
            "search_mode": "text_only",
            "image_weight": 0.4,
            "text_weight": 0.6
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] is not None
    assert "black hoodie" in data["description"]
    assert data["search_mode"] == "text_only"

