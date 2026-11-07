# Public Dataset Preparation & Evaluation Guide

VisionTrack AI supports evaluation on standardized public computer vision benchmarks:
1. **MOT17**: Multi-Object Tracking Benchmark (Pedestrian Detection & Tracking)
2. **Market-1501**: Large-Scale Person Re-Identification Benchmark

> [!IMPORTANT]
> In compliance with privacy guidelines and academic dataset license terms, raw dataset images and videos are not redistributed directly in this repository. Follow the verified official download steps below.

---

## 1. MOT17 Dataset (Detection & Tracking)

Official Portal: [https://motchallenge.net/data/MOT17/](https://motchallenge.net/data/MOT17/)

### Download & Layout
1. Download the `MOT17.zip` archive (5.5 GB) from the MOTChallenge website.
2. Extract the archive into `datasets/mot17/`:

```
datasets/
└── mot17/
    ├── train/
    │   ├── MOT17-02-DPM/
    │   │   ├── img1/         # Frame images (000001.jpg, ...)
    │   │   ├── gt/gt.txt     # Ground-truth tracking annotations
    │   │   └── seqinfo.ini   # Sequence metadata (FPS, length, resolution)
    │   ├── MOT17-04-DPM/
    │   ├── MOT17-09-DPM/
    │   └── MOT17-10-DPM/
    └── test/
```

### Format Specification
Each row in `gt/gt.txt` follows the standard MOT format:
```
<frame>, <id>, <bb_left>, <bb_top>, <bb_width>, <bb_height>, <conf>, <class>, <visibility>
```
* Class `1` designates pedestrians.
* Evaluates: Precision, Recall, mAP@50, IDF1, HOTA, and ID Switches.

---

## 2. Market-1501 Dataset (Person Re-ID)

Official Source: [Market-1501 CVF Portal](https://cove.thecvf.com/datasets/87)

### Download & Layout
1. Download `Market-1501-v15.09.15.zip`.
2. Extract the archive into `datasets/market1501/`:

```
datasets/
└── market1501/
    ├── bounding_box_train/   # 12,936 training person crops (751 identities)
    ├── bounding_box_test/    # 19,732 gallery crops (750 identities)
    ├── query/                # 3,368 probe query crops (750 identities)
    └── gt_query/             # Evaluation ground truth
```

### Crop Naming Convention
Image filename structure: `[PersonID]_[CameraID]_[SequenceID]_[FrameNumber].jpg`
* Example: `0001_c1s1_001051_00.jpg` -> Identity `0001`, Camera `1`.

Evaluates:
* **Rank-1 Accuracy**: Probability that the highest-ranked gallery candidate matches probe identity.
* **mAP (mean Average Precision)**: Mean retrieval precision across query set.

---

## 3. Running Evaluations

Launch the evaluation Jupyter notebooks in `notebooks/`:
```bash
jupyter notebook notebooks/
```
Open:
* `01_person_detection.ipynb`
* `02_person_tracking.ipynb`
* `03_clip_matching.ipynb`
* `04_model_evaluation.ipynb`

