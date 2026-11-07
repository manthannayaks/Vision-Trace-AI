import os
import torch
from pathlib import Path
from ultralytics import YOLO
from transformers import CLIPProcessor, CLIPModel

# Set directories
backend_dir = Path(__file__).resolve().parent.parent
models_dir = backend_dir / "models"
models_dir.mkdir(parents=True, exist_ok=True)
os.environ["YOLO_CONFIG_DIR"] = str(models_dir)

print("--- 1. Downloading YOLO model weights ---")
try:
    yolo = YOLO("yolo11n.pt")
    print("YOLO11n weights downloaded successfully.")
except Exception as e:
    print(f"YOLO11n failed: {e}. Downloading YOLOv8n...")
    yolo = YOLO("yolov8n.pt")
    print("YOLOv8n weights downloaded successfully.")

print("--- 2. Downloading CLIP ViT-B/32 model weights ---")
clip_name = "openai/clip-vit-base-patch32"
processor = CLIPProcessor.from_pretrained(clip_name)
model = CLIPModel.from_pretrained(clip_name)
print("CLIP model & processor cached successfully.")

print("--- All model weights prepared and cached! ---")

