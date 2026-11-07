import os
import cv2
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from sqlalchemy.orm import Session

from app.config import settings
from app.database import models
from app.utils.video_utils import create_video_writer
from app.utils.image_utils import save_image
from app.ml.detector import PersonDetector
from app.ml.tracker import PersonTracker
from app.ml.clip_matcher import ClipMatcher
from app.ml.attributes import AttributeExtractor
from app.ml.ranking import RankingEngine
from app.processing.frame_extractor import FrameExtractor
from app.processing.counting import CountingEngine
from app.processing.annotation import VideoAnnotator

logger = logging.getLogger(__name__)

class VideoProcessor:
    """
    Complete CCTV Person Tracking & Multimodal Appearance Retrieval Pipeline.
    Processes video, extracts tracks, computes sightings, evaluates against search query,
    annotates footage, and writes structured records to database.
    """
    def __init__(self, db: Session):
        self.db = db
        self.detector = PersonDetector()
        self.tracker = PersonTracker()
        self.clip_matcher = ClipMatcher()
        self.attribute_extractor = AttributeExtractor(clip_matcher=self.clip_matcher)
        self.ranking_engine = RankingEngine()
        self.counting_engine = CountingEngine()

    def process_video_job(
        self,
        job_id: int,
        progress_callback: Optional[Callable[[float, str], None]] = None,
        auto_delete_raw: bool = False,
        skip_annotated_video: bool = False
    ) -> Dict[str, Any]:
        """
        Executes end-to-end processing for an AnalysisJob.
        Supports lightweight storage mode (skips large video files, preserving only candidate crops & metrics).
        """
        job = self.db.query(models.AnalysisJob).filter(models.AnalysisJob.id == job_id).first()
        if not job:
            raise ValueError(f"Job {job_id} not found.")

        video = self.db.query(models.Video).filter(models.Video.id == job.video_id).first()
        if not video:
            raise ValueError(f"Video {job.video_id} not found.")

        query = None
        if job.query_id:
            query = self.db.query(models.SearchQuery).filter(models.SearchQuery.id == job.query_id).first()

        video_path = settings.UPLOAD_DIR / video.filename
        if not video_path.exists():
            raise FileNotFoundError(f"Video file missing at {video_path}")

        should_skip_annotated = skip_annotated_video or settings.KEEP_ONLY_CANDIDATE_CROPS
        should_delete_raw = auto_delete_raw or settings.AUTO_DELETE_UPLOADED_VIDEO

        def update_progress(percent: float, step: str):
            job.progress = round(percent, 1)
            job.current_step = step
            self.db.commit()
            if progress_callback:
                progress_callback(percent, step)

        try:
            # 1. Initialization
            job.status = "processing"
            update_progress(5.0, "Reading video telemetry and metadata")
            
            with FrameExtractor(video_path, sample_rate=job.sample_rate) as extractor:
                meta = extractor.get_metadata()
                video.duration = meta["duration"]
                video.fps = meta["fps"]
                video.width = meta["width"]
                video.height = meta["height"]
                video.total_frames = meta["total_frames"]
                self.db.commit()

                # Setup output video writer if not skipped
                output_video_path = None
                writer = None
                if not should_skip_annotated:
                    output_filename = f"annotated_{video.filename}"
                    output_video_path = settings.OUTPUT_DIR / output_filename
                    annotated_fps = meta["fps"] / job.sample_rate
                    writer = create_video_writer(output_video_path, annotated_fps, (meta["width"], meta["height"]))

                # Prepare search query embeddings
                ref_img_emb = None
                ref_txt_emb = None
                if query:
                    update_progress(10.0, "Pre-computing target query embeddings")
                    if query.reference_image_path:
                        img_path = Path(query.reference_image_path)
                        if img_path.exists():
                            ref_img_emb = self.clip_matcher.get_image_embedding(str(img_path))
                    if query.description and query.description.strip():
                        ref_txt_emb = self.clip_matcher.get_text_embedding(query.description.strip())

                # 2. Tracking and Frame Analysis
                self.tracker.reset()
                total_sampled_frames = meta["total_frames"] // job.sample_rate
                frame_count = 0
                all_frame_tracks = []  # List of (timestamp, tracks) for annotation pass

                update_progress(15.0, "Tracking persons across frames")

                for frame_idx, timestamp, frame in extractor.iterate_frames():
                    frame_count += 1
                    tracks = self.tracker.track_frame(frame, timestamp, frame_idx)
                    all_frame_tracks.append((timestamp, tracks, frame))

                    # Periodic progress reporting
                    if total_sampled_frames > 0 and frame_count % 10 == 0:
                        pct = 15.0 + min(55.0, (frame_count / total_sampled_frames) * 55.0)
                        update_progress(pct, f"Analyzing frame {frame_count}/{total_sampled_frames}")

            # 3. Aggregating Tracks and Sighting Metrics
            update_progress(72.0, "Synthesizing sighting metrics and representative appearances")
            metrics = self.counting_engine.compute_aggregate_metrics(self.tracker.active_tracks)

            video.unique_tracks_count = metrics["unique_tracks_count"]
            video.total_sightings_count = metrics["total_sightings_count"]
            video.total_detections = metrics["total_frame_detections"]
            self.db.commit()

            # 4. Multimodal Matching & Ranking
            update_progress(80.0, "Matching candidates against target profile")
            matching_track_scores: Dict[int, float] = {}
            candidates_for_ranking = []
            db_tracks = {}

            for t_id, track_info in self.tracker.active_tracks.items():
                # Save representative image crop
                rep_crop_filename = f"track_{video.id}_{t_id}_{int(track_info.representative_timestamp)}.jpg"
                rep_crop_path = settings.CANDIDATE_DIR / rep_crop_filename

                if track_info.representative_crop is not None:
                    save_image(track_info.representative_crop, rep_crop_path)
                else:
                    # Fallback blank crop if crop was null
                    blank = np.zeros((100, 50, 3), dtype=np.uint8)
                    save_image(blank, rep_crop_path)

                # Extract attributes
                attributes = self.attribute_extractor.extract_attributes(track_info.representative_crop)

                # Persist PersonTrack
                db_track = models.PersonTrack(
                    video_id=video.id,
                    track_id=t_id,
                    first_seen=track_info.first_seen,
                    last_seen=track_info.last_seen,
                    detection_count=track_info.detection_count,
                    representative_image_path=str(rep_crop_path),
                    average_confidence=round(track_info.average_confidence, 4),
                    detected_attributes=json.dumps(attributes)
                )
                self.db.add(db_track)
                self.db.flush()  # populate db_track.id
                db_tracks[t_id] = db_track

                # Persist Sightings
                sightings_list = metrics["sightings_by_track"].get(t_id, [])
                for s in sightings_list:
                    sighting_obj = models.Sighting(
                        track_id=db_track.id,
                        start_timestamp=s["start_timestamp"],
                        end_timestamp=s["end_timestamp"],
                        frame_count=s["frame_count"]
                    )
                    self.db.add(sighting_obj)

                # Candidate similarity comparison
                if query and track_info.representative_crop is not None:
                    match_scores = self.clip_matcher.match_candidate(
                        candidate_crop=track_info.representative_crop,
                        ref_image_emb=ref_img_emb,
                        ref_text_emb=ref_txt_emb
                    )
                    candidates_for_ranking.append({
                        "track_db_id": db_track.id,
                        "track_id": t_id,
                        "image_similarity": match_scores["image_similarity"],
                        "text_similarity": match_scores["text_similarity"],
                        "attributes": attributes
                    })

            self.db.commit()

            # 5. Ranking Engine Execution
            if query and candidates_for_ranking:
                update_progress(88.0, "Ranking candidates by visual similarity")
                ranked = self.ranking_engine.rank_candidates(
                    candidates=candidates_for_ranking,
                    image_weight=query.image_weight,
                    text_weight=query.text_weight
                )

                for idx, r in enumerate(ranked):
                    # Highlight matches in vivid RED on CCTV footage (tier matches or top candidates)
                    if r["combined_score"] >= 0.35 or (idx < 2 and r["combined_score"] >= 0.25):
                        matching_track_scores[r["track_id"]] = r["combined_score"]

                    match_obj = models.MatchResult(
                        query_id=query.id,
                        track_id=r["track_db_id"],
                        image_similarity=r.get("image_similarity"),
                        text_similarity=r.get("text_similarity"),
                        combined_score=r["combined_score"],
                        match_evidence=json.dumps(r["match_evidence"])
                    )
                    self.db.add(match_obj)
                self.db.commit()

            # 6. Render Annotated Video Output (if not skipped for lightweight storage)
            if writer is not None:
                update_progress(92.0, "Rendering annotated video output with detections")
                for timestamp, tracks, frame in all_frame_tracks:
                    annotated = VideoAnnotator.annotate_frame(
                        frame=frame,
                        tracks=tracks,
                        timestamp=timestamp,
                        matching_track_scores=matching_track_scores
                    )
                    writer.write(annotated)
                writer.release()
                video.processed_video_path = str(output_video_path)
            else:
                video.processed_video_path = None

            # 7. Auto-cleanup raw uploaded video if lightweight mode enabled
            if should_delete_raw:
                try:
                    if video_path.exists():
                        os.remove(video_path)
                        logger.info(f"Lightweight mode: auto-deleted raw video file {video_path}")
                except Exception as del_err:
                    logger.warning(f"Failed to auto-delete raw video: {del_err}")

            # 8. Finalize
            video.status = "completed"
            job.status = "completed"
            update_progress(100.0, "Video analysis and candidate retrieval completed")
            self.db.commit()

            return {
                "status": "success",
                "video_id": video.id,
                "unique_tracks": video.unique_tracks_count,
                "total_sightings": video.total_sightings_count,
                "matches_found": len(matching_track_ids),
                "output_video": str(output_video_path) if output_video_path else None,
                "raw_video_retained": not should_delete_raw
            }

        except Exception as e:
            logger.error(f"Analysis job {job_id} failed: {e}", exc_info=True)
            job.status = "failed"
            job.error_message = str(e)
            video.status = "failed"
            video.error_message = str(e)
            self.db.commit()
            raise e

