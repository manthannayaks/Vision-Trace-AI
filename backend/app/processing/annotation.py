import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional, Union

# Pure vivid RED in BGR format for detected target person
MATCH_RED_COLOR = (20, 20, 240)       # Bright vivid red
MATCH_RED_BG = (15, 15, 200)          # Darker red for badge header
NEUTRAL_TRACK_COLOR = (140, 140, 140) # Low-contrast neutral gray for non-targets

class VideoAnnotator:
    """
    Renders professional CCTV surveillance overlay graphics onto video frames:
    - High-visibility RED bounding box and corner brackets for target person appearance
    - Clear match badge with Track ID and match score percentage
    - Subtle neutral bounding box for non-matching pedestrians
    - Live CCTV timestamp and telemetry bar with active target alert
    """

    @classmethod
    def annotate_frame(
        cls,
        frame: np.ndarray,
        tracks: List[Dict[str, Any]],
        timestamp: float,
        matching_track_scores: Optional[Dict[int, float]] = None
    ) -> np.ndarray:
        annotated = frame.copy()
        h, w = annotated.shape[:2]

        if matching_track_scores is None:
            matching_track_scores = {}

        # Check if any matching target is active in this frame
        active_target_in_frame = any(trk["track_id"] in matching_track_scores for trk in tracks)

        # 1. Top CCTV Telemetry Bar (Surveillance OSD)
        bar_h = 36
        bar_color = (15, 18, 25)
        cv2.rectangle(annotated, (0, 0), (w, bar_h), bar_color, -1)
        cv2.line(annotated, (0, bar_h), (w, bar_h), (50, 55, 65), 1)

        time_str = f"TIME: {int(timestamp // 60):02d}:{int(timestamp % 60):02d}.{int((timestamp % 1) * 10):01d}"
        active_str = f"TRACKS: {len(tracks)}"
        left_text = f"VISIONTRACK AI  |  {time_str}  |  {active_str}"
        cv2.putText(annotated, left_text, (12, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 225, 230), 1, cv2.LINE_AA)

        if active_target_in_frame:
            # Highlight alert in top bar
            alert_text = "● TARGET DETECTED (MATCH)"
            cv2.putText(annotated, alert_text, (w - 260, 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, MATCH_RED_COLOR, 2, cv2.LINE_AA)

        # 2. Render each detected person track
        for trk in tracks:
            t_id = trk["track_id"]
            bbox = trk["bbox"]
            conf = trk.get("confidence", 0.0)
            x1, y1, x2, y2 = [int(v) for v in bbox]

            # Clamp coordinates to frame boundary
            x1 = max(0, min(w - 1, x1))
            y1 = max(0, min(h - 1, y1))
            x2 = max(0, min(w - 1, x2))
            y2 = max(0, min(h - 1, y2))

            is_match = t_id in matching_track_scores

            if is_match:
                match_score = matching_track_scores[t_id]
                score_pct = int(round(match_score * 100))

                # --- VIBRANT RED BOUNDING BOX FOR TARGET ---
                box_thickness = 3
                cv2.rectangle(annotated, (x1, y1), (x2, y2), MATCH_RED_COLOR, box_thickness)

                # Draw corner brackets to make detection pop out clearly
                corner_len = max(12, min(30, (x2 - x1) // 4, (y2 - y1) // 4))
                c_thick = 4
                # Top-left
                cv2.line(annotated, (x1, y1), (x1 + corner_len, y1), MATCH_RED_COLOR, c_thick)
                cv2.line(annotated, (x1, y1), (x1, y1 + corner_len), MATCH_RED_COLOR, c_thick)
                # Top-right
                cv2.line(annotated, (x2, y1), (x2 - corner_len, y1), MATCH_RED_COLOR, c_thick)
                cv2.line(annotated, (x2, y1), (x2, y1 + corner_len), MATCH_RED_COLOR, c_thick)
                # Bottom-left
                cv2.line(annotated, (x1, y2), (x1 + corner_len, y2), MATCH_RED_COLOR, c_thick)
                cv2.line(annotated, (x1, y2), (x1, y2 - corner_len), MATCH_RED_COLOR, c_thick)
                # Bottom-right
                cv2.line(annotated, (x2, y2), (x2 - corner_len, y2), MATCH_RED_COLOR, c_thick)
                cv2.line(annotated, (x2, y2), (x2, y2 - corner_len), MATCH_RED_COLOR, c_thick)

                # Target Badge (Red background with clean white bold text)
                badge_text = f"TARGET MATCH #{t_id} | {score_pct}%"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.5
                font_thickness = 2
                (tw, th), baseline = cv2.getTextSize(badge_text, font, font_scale, font_thickness)

                badge_h = th + 10
                badge_w = tw + 12
                badge_y1 = max(bar_h, y1 - badge_h)
                badge_y2 = badge_y1 + badge_h
                badge_x2 = min(w, x1 + badge_w)

                # Filled Red Header Badge
                cv2.rectangle(annotated, (x1, badge_y1), (badge_x2, badge_y2), MATCH_RED_BG, -1)
                cv2.rectangle(annotated, (x1, badge_y1), (badge_x2, badge_y2), MATCH_RED_COLOR, 1)

                # White label text
                cv2.putText(
                    annotated,
                    badge_text,
                    (x1 + 6, badge_y2 - 6),
                    font,
                    font_scale,
                    (255, 255, 255),
                    font_thickness,
                    cv2.LINE_AA
                )
            else:
                # Subtle neutral indicator for non-target detections
                cv2.rectangle(annotated, (x1, y1), (x2, y2), NEUTRAL_TRACK_COLOR, 1)
                lbl = f"ID #{t_id}"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.38
                (tw, th), _ = cv2.getTextSize(lbl, font, font_scale, 1)
                by1 = max(bar_h, y1 - th - 4)
                cv2.rectangle(annotated, (x1, by1), (x1 + tw + 6, y1), (40, 44, 52), -1)
                cv2.putText(annotated, lbl, (x1 + 3, y1 - 3), font, font_scale, (200, 200, 200), 1, cv2.LINE_AA)

        return annotated
