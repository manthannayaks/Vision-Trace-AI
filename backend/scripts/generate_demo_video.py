import cv2
import numpy as np
import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.database.database import SessionLocal, init_db
from app.database import models

def generate_realistic_cctv_demo(output_path: Path, num_frames: int = 120, fps: float = 25.0):
    """
    Synthesizes a realistic surveillance video clip:
    - CCTV hallway background with floor perspective, lighting vignette, and timestamp overlay
    - Person 1 (Target): Wears black hoodie, dark blue jeans, white sneakers, carrying a black backpack.
      Walks from left to right across the scene (Frames 0 to 65).
    - Person 2 (Distractor): Wears bright red jacket, khaki pants, dark shoes.
      Walks from right to left (Frames 20 to 95).
    - Person 3 (Re-appearance/Second Target sighting):
      Person 1 walks back across the camera from right to left (Frames 75 to 118).
    This creates:
    - 2 unique tracks
    - Multiple sighting intervals (proving the Counting Engine's gap detection!)
    - Clear visual distinction for CLIP and ranking engine!
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 720, 480
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    print(f"Generating realistic CCTV demonstration video ({num_frames} frames)...")

    for f in range(num_frames):
        # 1. Base CCTV Hallway Scene (Top-down angled surveillance view)
        frame = np.full((height, width, 3), 42, dtype=np.uint8)

        # Floor grid and perspective lines
        cv2.line(frame, (0, 360), (width, 360), (60, 60, 65), 2)
        cv2.line(frame, (100, 360), (0, 480), (55, 55, 60), 1)
        cv2.line(frame, (360, 360), (250, 480), (55, 55, 60), 1)
        cv2.line(frame, (620, 360), (520, 480), (55, 55, 60), 1)

        # Wall doors / architectural elements
        cv2.rectangle(frame, (80, 160), (160, 360), (32, 32, 38), -1)
        cv2.rectangle(frame, (520, 160), (600, 360), (32, 32, 38), -1)

        # Subtle CCTV noise & vignette
        noise = np.random.normal(0, 3, frame.shape).astype(np.int16)
        frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        # 2. Render Person 1 (Target Match: Black hoodie, blue jeans, white sneakers, backpack)
        # Sighting 1: f from 5 to 60
        if 5 <= f <= 60:
            progress = (f - 5) / 55.0
            x = int(60 + progress * 520)
            y = int(220 + np.sin(progress * 12) * 4)  # Natural walking bob

            # Head with hood
            cv2.circle(frame, (x + 24, y - 22), 16, (30, 30, 30), -1)  # Hood
            cv2.circle(frame, (x + 24, y - 20), 10, (190, 170, 150), -1)  # Face shadow

            # Backpack on back
            cv2.rectangle(frame, (x - 6, y + 5), (x + 8, y + 60), (20, 20, 25), -1)

            # Torso: Black hoodie
            cv2.rectangle(frame, (x + 6, y), (x + 42, y + 80), (28, 28, 32), -1)

            # Legs: Blue jeans
            leg_swing = int(np.sin(progress * 25) * 6)
            cv2.rectangle(frame, (x + 10 + leg_swing, y + 80), (x + 22 + leg_swing, y + 160), (115, 65, 25), -1)
            cv2.rectangle(frame, (x + 26 - leg_swing, y + 80), (x + 38 - leg_swing, y + 160), (110, 60, 20), -1)

            # Footwear: White sneakers
            cv2.rectangle(frame, (x + 8 + leg_swing, y + 160), (x + 24 + leg_swing, y + 172), (235, 235, 240), -1)
            cv2.rectangle(frame, (x + 24 - leg_swing, y + 160), (x + 40 - leg_swing, y + 172), (230, 230, 235), -1)

        # 3. Render Person 2 (Distractor: Red jacket, khaki pants)
        # Sighting: f from 25 to 90
        if 25 <= f <= 90:
            p2 = (f - 25) / 65.0
            x2 = int(620 - p2 * 540)
            y2 = int(210 + np.sin(p2 * 14) * 4)

            # Head
            cv2.circle(frame, (x2 + 24, y2 - 22), 14, (180, 160, 140), -1)

            # Torso: Red jacket
            cv2.rectangle(frame, (x2 + 6, y2), (x2 + 42, y2 + 75), (40, 45, 195), -1)

            # Legs: Khaki pants
            l_swing = int(np.sin(p2 * 25) * 6)
            cv2.rectangle(frame, (x2 + 10 + l_swing, y2 + 75), (x2 + 22 + l_swing, y2 + 155), (100, 150, 175), -1)
            cv2.rectangle(frame, (x2 + 26 - l_swing, y2 + 75), (x2 + 38 - l_swing, y2 + 155), (95, 145, 170), -1)

            # Footwear: Dark shoes
            cv2.rectangle(frame, (x2 + 8 + l_swing, y2 + 155), (x2 + 24 + l_swing, y2 + 167), (35, 35, 40), -1)
            cv2.rectangle(frame, (x2 + 24 - l_swing, y2 + 155), (x2 + 40 - l_swing, y2 + 167), (35, 35, 40), -1)

        # 4. Render Person 1 Returning (Sighting 2: Gap from 60 to 75 frames = 0.6s gap)
        if 75 <= f <= 118:
            p3 = (f - 75) / 43.0
            x3 = int(580 - p3 * 480)
            y3 = int(220 + np.sin(p3 * 12) * 4)

            # Head with hood
            cv2.circle(frame, (x3 + 24, y3 - 22), 16, (30, 30, 30), -1)
            cv2.circle(frame, (x3 + 24, y3 - 20), 10, (190, 170, 150), -1)

            # Backpack
            cv2.rectangle(frame, (x3 + 40, y3 + 5), (x3 + 54, y3 + 60), (20, 20, 25), -1)

            # Torso: Black hoodie
            cv2.rectangle(frame, (x3 + 6, y3), (x3 + 42, y3 + 80), (28, 28, 32), -1)

            # Legs: Blue jeans
            leg_swing = int(np.sin(p3 * 25) * 6)
            cv2.rectangle(frame, (x3 + 10 + leg_swing, y3 + 80), (x3 + 22 + leg_swing, y3 + 160), (115, 65, 25), -1)
            cv2.rectangle(frame, (x3 + 26 - leg_swing, y3 + 80), (x3 + 38 - leg_swing, y3 + 160), (110, 60, 20), -1)

            # Footwear: White sneakers
            cv2.rectangle(frame, (x3 + 8 + leg_swing, y3 + 160), (x3 + 24 + leg_swing, y3 + 172), (235, 235, 240), -1)
            cv2.rectangle(frame, (x3 + 24 - leg_swing, y3 + 160), (x3 + 40 - leg_swing, y3 + 172), (230, 230, 235), -1)

        # 5. Surveillance OSD Telemetry
        time_sec = f / fps
        osd_text = f"CAM-03 WEST WING  2026-11-08  01:15:{int(time_sec):02d}.{int((time_sec%1)*10):01d}  REC"
        cv2.rectangle(frame, (0, 0), (width, 28), (15, 18, 22), -1)
        cv2.circle(frame, (width - 20, 14), 5, (0, 0, 220), -1)  # Red recording dot
        cv2.putText(frame, osd_text, (15, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 225, 230), 1, cv2.LINE_AA)

        writer.write(frame)

    writer.release()
    print(f"Surveillance video demo saved to {output_path}")

    # Register in database
    init_db()
    db = SessionLocal()
    filename = output_path.name
    existing = db.query(models.Video).filter(models.Video.filename == filename).first()
    if not existing:
        duration = round(num_frames / fps, 2)
        vid = models.Video(
            filename=filename,
            original_filename="cctv_hallway_demo.mp4",
            duration=duration,
            fps=fps,
            width=width,
            height=height,
            total_frames=num_frames,
            status="uploaded"
        )
        db.add(vid)
        db.commit()
        db.refresh(vid)
        print(f"Video registered in database with ID: {vid.id}")
    else:
        print(f"Video already registered with ID: {existing.id}")
    db.close()

if __name__ == "__main__":
    out_file = settings.UPLOAD_DIR / "cctv_hallway_demo.mp4"
    generate_realistic_cctv_demo(out_file)

