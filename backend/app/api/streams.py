import cv2
import time
import json
import asyncio
import logging
import threading
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.config import settings
from app.ml.detector import PersonDetector
from app.ml.tracker import PersonTracker
from app.ml.clip_matcher import ClipMatcher
from app.ml.ranking import RankingEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/streams", tags=["Live Streams"])

class StreamStartRequest(BaseModel):
    stream_url: str  # RTSP URL or local video path for simulated live CCTV
    description_query: Optional[str] = None
    confidence_threshold: float = 0.35
    is_simulation: bool = False

class ActiveStreamSession:
    def __init__(self, stream_url: str, description_query: Optional[str] = None):
        self.stream_url = stream_url
        self.description_query = description_query
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.latest_event: Dict[str, Any] = {"status": "initialized", "active_tracks": 0}
        self.detector = PersonDetector()
        self.tracker = PersonTracker()
        self.clip_matcher = ClipMatcher()
        self.ranking_engine = RankingEngine()
        self.query_emb = None
        if description_query:
            try:
                self.query_emb = self.clip_matcher.get_text_embedding(description_query)
            except Exception as e:
                logger.warning(f"Failed to embed stream query: {e}")

    def start(self):
        self.is_running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)

    def _run_loop(self):
        cap = cv2.VideoCapture(self.stream_url)
        if not cap.isOpened():
            self.latest_event = {"status": "error", "message": f"Could not connect to stream: {self.stream_url}"}
            self.is_running = False
            return

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_idx = 0
        start_time = time.time()

        while self.is_running and cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame is None:
                # If simulated stream reached end, loop back
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                time.sleep(0.1)
                continue

            frame_idx += 1
            if frame_idx % 3 != 0:  # Sample 1 out of 3 frames for live throughput
                continue

            timestamp = time.time() - start_time
            tracks = self.tracker.track_frame(frame, timestamp, frame_idx)

            # Check matches against query
            matching_tracks = []
            for trk in tracks:
                crop = trk.get("crop")
                score = 0.0
                if crop is not None and self.query_emb is not None:
                    c_emb = self.clip_matcher.get_image_embedding(crop)
                    score = self.clip_matcher.cosine_similarity(self.query_emb, c_emb)
                
                if score >= 0.50:
                    matching_tracks.append({
                        "track_id": trk["track_id"],
                        "score": round(score, 4),
                        "timestamp": round(timestamp, 2)
                    })

            self.latest_event = {
                "status": "active",
                "timestamp": round(timestamp, 2),
                "active_tracks_count": len(tracks),
                "matching_candidates": matching_tracks,
                "fps": round(fps, 1)
            }

            time.sleep(1.0 / (fps * 1.5))

        cap.release()
        self.latest_event = {"status": "stopped"}

active_sessions: Dict[str, ActiveStreamSession] = {}

@router.post("/start")
def start_stream(req: StreamStartRequest):
    """
    Connect to an authorized RTSP CCTV feed or launch simulated live surveillance.
    """
    stream_id = f"stream_{int(time.time())}"
    target_url = req.stream_url

    # Check if local file path for simulation
    if req.is_simulation:
        local_path = settings.UPLOAD_DIR / req.stream_url
        if local_path.exists():
            target_url = str(local_path)

    session = ActiveStreamSession(stream_url=target_url, description_query=req.description_query)
    session.start()
    active_sessions[stream_id] = session

    return {
        "status": "started",
        "stream_id": stream_id,
        "stream_url": req.stream_url,
        "is_simulation": req.is_simulation
    }

@router.post("/stop")
def stop_stream(stream_id: str):
    """Stop active CCTV streaming session."""
    if stream_id in active_sessions:
        session = active_sessions.pop(stream_id)
        session.stop()
        return {"status": "stopped", "stream_id": stream_id}
    return {"status": "not_found", "stream_id": stream_id}

@router.get("/{stream_id}/status")
def get_stream_status(stream_id: str):
    """Get latest live event from CCTV stream."""
    if stream_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Stream session not found")
    session = active_sessions[stream_id]
    return {
        "stream_id": stream_id,
        "is_running": session.is_running,
        "latest_event": session.latest_event
    }

