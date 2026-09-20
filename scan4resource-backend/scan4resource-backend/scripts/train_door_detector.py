"""Fine-tune a YOLO model to detect doors, using the public DoorDetect dataset.

DoorDetect: 1,213 images with boxes for door, handle, cabinet door and refrigerator door.
Training on all four classes (not just "door") teaches the model what is NOT a room door, which cuts
false positives on cupboards and fridges. The API only uses the "door" class.

    python scripts/train_door_detector.py --epochs 60
    DETECTOR_WEIGHTS=weights/door.pt uvicorn app.main:app

Needs a GPU to be quick (about 25 minutes for 60 epochs on a Colab T4). Check the dataset's licence before using the
resulting model commercially: its images come from Open Images and MCIndoor20000.
"""
from __future__ import annotations

import argparse
import random
import shutil
import subprocess
from pathlib import Path

DATASET_URL = "https://github.com/MiguelARD/DoorDetect-Dataset.git"
NAMES = {0: "door", 1: "handle", 2: "cabinet door", 3: "refrigerator door"}  # the dataset's own class ids


def make_splits(dataset_dir: Path, out_dir: Path, val_fraction: float = 0.1, seed: int = 0) -> Path:
    """Write train.txt / val.txt (absolute image paths) and the YOLO data file. Returns the data file."""
    images = sorted(p for p in (dataset_dir / "images").iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    images = [p for p in images if (dataset_dir / "labels" / f"{p.stem}.txt").exists()]
    if not images:
        raise SystemExit(f"No labelled images found in {dataset_dir}")

    random.Random(seed).shuffle(images)
    n_val = max(1, int(len(images) * val_fraction))
    val, train = images[:n_val], images[n_val:]

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "train.txt").write_text("\n".join(str(p.resolve()) for p in train) + "\n")
    (out_dir / "val.txt").write_text("\n".join(str(p.resolve()) for p in val) + "\n")

    data_file = out_dir / "door.yaml"
    names = "\n".join(f"  {i}: {name}" for i, name in NAMES.items())
    data_file.write_text(f"path: {out_dir.resolve()}\ntrain: train.txt\nval: val.txt\nnames:\n{names}\n")
    print(f"{len(train)} training images, {len(val)} validation images -> {data_file}")
    return data_file


def find_best_weights(model) -> Path:
    """Where Ultralytics saved best.pt. It chooses the folder (newer versions put a relative `project` under
    runs/detect/), so ask the trainer instead of guessing the path."""
    trainer = getattr(model, "trainer", None)
    best = Path(trainer.best) if trainer is not None and getattr(trainer, "best", None) else None
    if best is not None and best.exists():
        return best
    found = sorted(Path("runs").rglob("weights/best.pt"), key=lambda p: p.stat().st_mtime)
    if found:
        return found[-1]
    raise SystemExit("Training finished, but best.pt was not found under runs/.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dataset", default="data/DoorDetect-Dataset", help="where to clone / find the dataset")
    parser.add_argument("--base", default="yolov8s.pt", help="pretrained model to start from")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--output", default="weights/door.pt")
    args = parser.parse_args()

    dataset = Path(args.dataset)
    if not (dataset / "images").exists():
        dataset.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", DATASET_URL, str(dataset)], check=True)

    data_file = make_splits(dataset, Path("data/door_splits"))

    from ultralytics import YOLO

    model = YOLO(args.base)
    model.train(data=str(data_file), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
                project="runs", name="door", exist_ok=True)

    best = find_best_weights(model)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(best, out)
    print(f"\nSaved {out} (copied from {best}). Use it with:  DETECTOR_WEIGHTS={out}")


if __name__ == "__main__":
    main()