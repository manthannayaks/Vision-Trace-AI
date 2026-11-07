# VisionTrack AI
## AI-Powered Person Retrieval and Appearance Matching System for CCTV Surveillance

[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.1+-EE4C2C.svg?logo=pytorch&logoColor=white)](https://pytorch.org)
[![YOLO11](https://img.shields.io/badge/Ultralytics-YOLO11n-00599C.svg)](https://ultralytics.com)
[![CLIP](https://img.shields.io/badge/OpenAI-CLIP%20ViT--B%2F32-412991.svg)](https://github.com/openai/CLIP)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB.svg?logo=react&logoColor=black)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. Project Overview

**VisionTrack AI** is an appearance-based person retrieval and multi-object tracking system engineered for CCTV surveillance analytics. Given a reference photograph of a person, a natural-language description of visible appearance attributes (e.g. clothing colors, silhouette, headwear, footwear, bag), or both, VisionTrack AI analyzes recorded CCTV footage or live surveillance streams.

The system detects pedestrians, establishes continuous tracking IDs across frames, extracts appearance feature embeddings, and ranks potential candidate matches with a transparent component evidence breakdown.

> [!IMPORTANT]
> **Ethical AI Surveillance Notice:**  
> VisionTrack AI is strictly an **appearance-matching and visual retrieval system**. It does **not** perform facial recognition, biometric identity identification, or automated criminal categorization. Similarity scores represent mathematical visual alignment (clothing, silhouette, colors, accessories) and are labelled as potential visual matches requiring human operator verification.

---

## 2. Problem Statement & Objectives

Manual review of hours of multi-camera CCTV footage during search operations is labor-intensive, error-prone, and slow. Traditional computer vision tools either rely on intrusive facial recognition (frequently ineffective in low-resolution, top-down surveillance angles) or basic motion detection lacking semantic awareness.

### System Objectives:
1. **Multimodal Appearance Search:** Allow operators to search by reference image, text description, or both.
2. **Temporal Continuity & Tracking:** Assign persistent tracking IDs to avoid treating every detection as a new person.
3. **Distinct Surveillance Metrics:** Accurately separate unique tracking identities, continuous sighting intervals, and frame detections.
4. **Transparent Component Ranking:** Score candidates without claiming probabilistic certainty or automated identity proof.
5. **Full-Stack Local Execution:** Run entirely locally on edge hardware (including Apple Silicon Mac MPS) with zero dependence on paid cloud APIs.

---

## 3. System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   VisionTrack AI UI                    │
                    │        (React 18 + Vite + Tailwind CSS + Recharts)     │
                    └──────────────────────────┬─────────────────────────────┘
                                               │ HTTP / REST / WebSocket
                                               ▼
                    ┌────────────────────────────────────────────────────────┐
                    │                  FastAPI Backend Server                │
                    │  (Pydantic V2, Background Tasks, SQLite / SQLAlchemy)  │
                    └──────┬──────────────┬──────────────┬────────────┬──────┘
                           │              │              │            │
             ┌─────────────▼────┐  ┌──────▼───────┐  ┌───▼───┐  ┌─────▼──────────┐
             │  PersonDetector  │  │PersonTracker │  │ CLIP  │  │ RankingEngine  │
             │     (YOLO11n)    │  │ (ByteTrack)  │  │Matcher│  │& CountingEngine│
             └──────────────────┘  └──────────────┘  └───────┘  └────────────────┘
```

### Processing Workflow:
1. **Upload & Ingestion:** CCTV video uploaded and validated; resolution, FPS, and frame count extracted.
2. **Detection & Tracking:** YOLO detects pedestrians (COCO class `0`); ByteTrack associates detections across consecutive frames.
3. **Crop & Attribute Extraction:** Representative person crops are extracted and evaluated for appearance attributes (hoodie, jeans, sneakers, bag, colors).
4. **Embedding Generation:** OpenAI CLIP ViT-B/32 produces normalized 512-dimensional visual and textual embeddings.
5. **Multimodal Ranking:** Cosine similarity combines image similarity and text description similarity according to operator weights.
6. **Annotation & Telemetry:** Output video is rendered with bounding boxes, track IDs, and match badges.
7. **Database Persistence:** SQLite stores videos, tracks, sightings, and match evidence.

---

## 4. Technology Stack

### Computer Vision & Machine Learning:
- **Python 3.11**
- **PyTorch 2.1+** (Auto-detects Apple Silicon MPS, NVIDIA CUDA, or CPU)
- **Ultralytics YOLO** (Pretrained `yolo11n.pt` / `yolov8n.pt`)
- **ByteTrack** (`lapx`) for multi-pedestrian tracking
- **OpenAI CLIP (ViT-B/32)** via HuggingFace `transformers` for multimodal embeddings
- **OSNet / MobileNetV3** for tracklet feature extraction
- **OpenCV** for video decoding, frame extraction, and video annotation
- **Scikit-Learn** & **NumPy** for vector normalization and cosine similarity

### Backend:
- **FastAPI** (High-throughput async API)
- **SQLAlchemy 2.0** + **SQLite**
- **Pydantic V2** for schema validation
- **Uvicorn** ASGI server

### Frontend:
- **React 18** with **Vite**
- **Tailwind CSS** (Dark surveillance midnight palette)
- **React Router 6**
- **Recharts** for metric visualization
- **Lucide React** for icons
- **Axios** with automatic proxying to backend

---

## 5. Machine Learning Modules

| Module | File | Responsibilities |
|---|---|---|
| **Person Detector** | `backend/app/ml/detector.py` | Loads lightweight YOLO model; filters exclusively for person class (COCO 0); extracts bounding boxes, confidence, and person crops. |
| **Person Tracker** | `backend/app/ml/tracker.py` | ByteTrack multi-person association; maintains first-seen / last-seen timestamps, detection counts, and representative high-confidence appearance crops. |
| **CLIP Matcher** | `backend/app/ml/clip_matcher.py` | Extracts L2-normalized 512-d feature vectors for reference images, text descriptions, and candidate crops; computes cosine similarity with embedding caching. |
| **Re-ID Extractor** | `backend/app/ml/reid.py` | Optional visual feature backbone comparing person tracklets across cameras or re-entry intervals. |
| **Attribute Recognizer** | `backend/app/ml/attributes.py` | Zero-shot CLIP prompt alignment for visible garments, colors, headwear, footwear, and bags; flags low-confidence attributes as `not_clearly_visible`. |
| **Ranking Engine** | `backend/app/ml/ranking.py` | Weighted fusion: `Final Score = (w_img * ImgSim) + (w_txt * TxtSim)`; generates structured match evidence explaining component scores. |
| **Counting Engine** | `backend/app/processing/counting.py` | Strictly separates unique tracking identities, continuous sighting intervals, and frame-level detections. |

---

## 6. Project Structure

```
VisionTrack-AI/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI application entry point
│   │   ├── config.py                # Hardware & environment settings
│   │   ├── api/                     # REST API routers
│   │   │   ├── videos.py            # Video ingestion & metadata
│   │   │   ├── search.py            # Search query creation
│   │   │   ├── analysis.py          # Background analysis jobs
│   │   │   ├── results.py           # Candidate retrieval & gallery
│   │   │   └── streams.py           # Live RTSP / simulated CCTV feeds
│   │   ├── ml/                      # Machine learning modules
│   │   │   ├── detector.py          # YOLO person detector
│   │   │   ├── tracker.py           # ByteTrack tracking engine
│   │   │   ├── clip_matcher.py      # OpenAI CLIP ViT-B/32 matcher
│   │   │   ├── reid.py              # Person Re-ID module
│   │   │   ├── attributes.py        # Appearance attribute extractor
│   │   │   └── ranking.py           # Multimodal ranking engine
│   │   ├── processing/              # Video processing pipeline
│   │   │   ├── video_processor.py   # Master pipeline orchestrator
│   │   │   ├── frame_extractor.py   # Uniform temporal sampling
│   │   │   ├── counting.py          # Strict metric distinction
│   │   │   └── annotation.py        # CCTV telemetry & bounding boxes
│   │   ├── database/                # SQLite database persistence
│   │   │   ├── database.py          # Engine & session setup
│   │   │   ├── models.py            # SQLAlchemy database models
│   │   │   └── schemas.py           # Pydantic schemas
│   │   └── utils/                   # File, image, video utilities
│   ├── models/                      # Cached pretrained weights
│   ├── uploads/                     # Ingested CCTV footage
│   ├── outputs/                     # Annotated output videos
│   ├── candidate_images/            # Representative person crops
│   ├── requirements.txt             # Backend dependencies
│   └── .env.example                 # Configuration template
├── frontend/
│   ├── src/
│   │   ├── components/              # StatCard, CandidateCard, ProgressBar, etc.
│   │   ├── pages/                   # Dashboard, Search, Analysis, Results, Player, Live, Settings
│   │   ├── layouts/                 # MainLayout console shell
│   │   ├── services/                # Axios API client
│   │   ├── App.jsx                  # Route definitions
│   │   └── main.jsx                 # React root mount
│   ├── package.json                 # Node dependencies
│   └── vite.config.js               # Vite config with backend proxy
├── datasets/
│   ├── README.md                    # MOT17 & Market-1501 download guide
│   ├── mot17/                       # MOT17 tracking benchmark
│   └── market1501/                  # Market-1501 Re-ID benchmark
├── notebooks/
│   ├── 01_person_detection.ipynb    # YOLO detection evaluation
│   ├── 02_person_tracking.ipynb     # ByteTrack tracking evaluation
│   ├── 03_clip_matching.ipynb       # Multimodal CLIP retrieval
│   └── 04_model_evaluation.ipynb    # End-to-end benchmarking
├── tests/
│   ├── test_backend.py              # Unit tests for API & ranking
│   └── test_pipeline.py             # End-to-end pipeline integration test
├── README.md
├── .gitignore
└── LICENSE
```

---

## 7. Installation & Execution Guide

### Prerequisites
- Python 3.11
- Node.js (v18+) and npm

### Step 1: Clone Repository
```bash
git clone https://github.com/your-username/VisionTrack-AI.git
cd VisionTrack-AI
```

### Step 2: Backend Setup
```bash
cd backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
* Backend API Documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)
* Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Step 3: Frontend Setup
In a new terminal:
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev
```
* Open your browser at: [http://localhost:5173](http://localhost:5173)

---

## 8. API Documentation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Hardware telemetry (MPS / CUDA / CPU), model status, and storage directories. |
| `GET` | `/api/dashboard/stats` | Real aggregate metrics (videos, detections, unique tracks, sightings). |
| `POST` | `/api/videos/upload` | Upload surveillance video, extract FPS/resolution, store record. |
| `GET` | `/api/videos/` | List all ingested CCTV videos. |
| `GET` | `/api/videos/{id}` | Get video metadata and processing state. |
| `POST` | `/api/search/create` | Create target search profile (reference image and/or text description). |
| `GET` | `/api/search/` | List recent search profiles. |
| `POST` | `/api/analysis/start` | Queue background video tracking & multimodal appearance retrieval. |
| `GET` | `/api/analysis/{id}/progress` | Lightweight polling endpoint for progress percentage & current step. |
| `GET` | `/api/results/{analysis_id}` | Full candidate retrieval gallery with scores, screenshots, and evidence. |
| `GET` | `/api/tracks/{id}` | Detailed track telemetry, sightings timeline, and attributes. |
| `POST` | `/api/streams/start` | Connect authorized RTSP feed or simulated live CCTV loop. |
| `POST` | `/api/streams/stop` | Disconnect active live surveillance feed. |

---

## 9. Running Automated Tests

Run backend unit and integration tests:
```bash
# Run unit tests
PYTHONPATH=backend backend/venv/bin/pytest tests/test_backend.py

# Run end-to-end pipeline test with synthetic CCTV footage
PYTHONPATH=backend backend/venv/bin/python tests/test_pipeline.py
```

---

## 10. Known Limitations & Future Enhancements

### Known Limitations:
1. **Severe Occlusion:** Heavy crowds or prolonged occlusion (>3 seconds) may cause a pedestrian to be assigned a new track ID upon reappearance.
2. **Extreme Low Resolution:** Extreme distance (>50 meters from camera) reduces fine-grained attribute classification accuracy (e.g. distinguishing shoe models).
3. **Monochrome Night CCTV:** Infrared night-vision feeds lack color information; text queries relying on color descriptions will have lower cosine similarity.

### Future Enhancements:
- Multi-camera Re-ID graph associating tracks across disconnected surveillance camera angles.
- Zero-shot spatial heatmaps overlaying movement trajectories onto a physical floor plan.
- Support for on-device TensorRT / CoreML compilation for 60+ FPS edge throughput.

