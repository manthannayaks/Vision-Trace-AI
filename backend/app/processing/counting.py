import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

class SightingInterval:
    """Represents a continuous period during which a track was visible."""
    def __init__(self, start_time: float, end_time: float, frame_count: int):
        self.start_timestamp = round(start_time, 2)
        self.end_timestamp = round(end_time, 2)
        self.frame_count = frame_count

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_timestamp": self.start_timestamp,
            "end_timestamp": self.end_timestamp,
            "frame_count": self.frame_count,
            "duration": round(self.end_timestamp - self.start_timestamp, 2)
        }

class CountingEngine:
    """
    Computes strict CCTV surveillance metrics:
    1. Unique Tracking Identities: Count of distinct ByteTrack IDs.
    2. Sighting Intervals: Distinct temporal appearances separated by a time gap threshold.
    3. Frame-Level Detections: Total number of bounding boxes detected across all video frames.
    """
    def __init__(self, sighting_gap_threshold_sec: float = 3.0):
        self.gap_threshold = sighting_gap_threshold_sec

    def extract_sightings(self, timestamps: List[float]) -> List[SightingInterval]:
        """
        Segments a sorted list of sighting timestamps into continuous sighting intervals.
        If the gap between consecutive sightings exceeds gap_threshold, a new sighting is created.
        """
        if not timestamps:
            return []

        sorted_times = sorted(timestamps)
        sightings: List[SightingInterval] = []

        cur_start = sorted_times[0]
        cur_end = sorted_times[0]
        cur_count = 1

        for t in sorted_times[1:]:
            if t - cur_end > self.gap_threshold:
                # Interval gap exceeded: conclude current sighting
                sightings.append(SightingInterval(cur_start, cur_end, cur_count))
                cur_start = t
                cur_end = t
                cur_count = 1
            else:
                cur_end = t
                cur_count += 1

        # Add the final sighting
        sightings.append(SightingInterval(cur_start, cur_end, cur_count))
        return sightings

    def compute_aggregate_metrics(self, tracks_data: Dict[int, Any]) -> Dict[str, Any]:
        """
        Aggregates metrics across all tracks in a video:
        - unique_tracks_count
        - total_sightings_count
        - total_frame_detections
        """
        unique_tracks_count = len(tracks_data)
        total_frame_detections = 0
        total_sightings_count = 0
        track_sightings: Dict[int, List[Dict[str, Any]]] = {}

        for t_id, track in tracks_data.items():
            timestamps = getattr(track, "sightings_timestamps", [])
            intervals = self.extract_sightings(timestamps)
            track_sightings[t_id] = [s.to_dict() for s in intervals]
            total_sightings_count += len(intervals)
            total_frame_detections += getattr(track, "detection_count", len(timestamps))

        return {
            "unique_tracks_count": unique_tracks_count,
            "total_sightings_count": total_sightings_count,
            "total_frame_detections": total_frame_detections,
            "sightings_by_track": track_sightings
        }

