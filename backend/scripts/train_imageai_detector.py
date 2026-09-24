"""Train the custom ImageAI detector from HomeObjects-3K, then put the result where the API looks for it.

The custom model learns only the classes that COCO does not have:  lamp, wardrobe, window, door, photo frame.
(bed, sofa, chair, table, tv, laptop and potted plant are left to the pretrained COCO model, so the two
models never answer for the same kind of object.)

    python scripts/train_imageai_detector.py --epochs 60

What it does:
  1. downloads HomeObjects-3K (about 390 MB) and ImageAI's pretrained weights (yolov3.pt, about 250 MB),
  2. converts the dataset to the layout ImageAI trains on (scripts/prepare_homeobjects.py),
  3. trains with transfer learning from the pretrained weights (needs a GPU to be practical, e.g. a Colab T4),
  4. copies the best model and its JSON to weights/imageai/custom.pt and weights/imageai/custom.json.

While it trains, ImageAI prints precision, recall and mAP@0.5 after every epoch and keeps the best-mAP model.
If you see "pretrained weight loading failed" at the start, the base weights were not read and training starts
from scratch: fix the path before spending hours on it.

Check the licence of the data before commercial use: HomeObjects-3K is AGPL-3.0.
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_homeobjects as prep  # noqa: E402

HOMEOBJECTS_URL = "https://github.com/ultralytics/assets/releases/download/v0.0.0/homeobjects-3K.zip"
WEIGHTS_URL = "https://github.com/OlafenwaMoses/ImageAI/releases/download/3.0.0-pretrained/{name}"


def download(url: str, target: Path) -> Path:
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}\n  -> {target}")

    def progress(blocks, block_size, total):
        if total > 0 and blocks % 400 == 0:
            print(f"  {min(100, blocks * block_size * 100 // total)}%", end="\r", flush=True)

    urllib.request.urlretrieve(url, target, progress)
    print("  done      ")
    return target


def prepare_dataset(workdir: Path, classes: str, keep_empty: bool, rebuild: bool) -> tuple[Path, list[str]]:
    raw = workdir / "homeobjects-3K"
    if not (raw / "images").exists():
        import zipfile

        archive = download(HOMEOBJECTS_URL, workdir / "homeobjects-3K.zip")
        with zipfile.ZipFile(archive) as z:
            z.extractall(raw)
    dataset = workdir / "imageai-dataset"
    names, class_map = prep.build_mapping(classes)
    if rebuild or not (dataset / "train").exists():
        for split in ("train", "validation"):  # only the data; models/ and json/ from earlier runs are kept
            shutil.rmtree(dataset / split, ignore_errors=True)
        for src_split, dst_split in prep.SPLITS.items():
            print(dst_split, prep.convert_split(raw, dataset, src_split, dst_split, names, class_map, keep_empty))
    else:
        print(f"Using the dataset already in {dataset} (use --rebuild to redo it).")
    return dataset, names


def pick_outputs(dataset: Path, model_type: str) -> tuple[Path, Path]:
    models = dataset / "models"

    def map_of(p: Path) -> float:
        m = re.search(r"mAP-([0-9.]+)_epoch", p.name)
        return float(m.group(1)) if m else -1.0

    best = sorted(models.glob(f"{model_type}_*_mAP-*_epoch-*.pt"), key=map_of)
    if best:
        model = best[-1]
        print(f"Best model: {model.name}")
    else:  # mAP never rose above zero, so ImageAI saved no "best" file
        last = sorted(models.glob(f"{model_type}_*_last.pt"))
        if not last:
            raise SystemExit(f"No trained model found in {models}.")
        model = last[-1]
        print("WARNING: validation mAP stayed at 0, so this is only the last epoch. Check your labels and class order.")
    jsons = sorted((dataset / "json").glob("*_detection_config.json"), key=lambda p: p.stat().st_mtime)
    if not jsons:
        raise SystemExit(f"No detection config JSON found in {dataset / 'json'}.")
    return model, jsons[-1]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workdir", default="data/imageai", help="where the dataset and training outputs go")
    ap.add_argument("--weights-dir", default="weights/imageai", help="where the API looks for the models")
    ap.add_argument("--classes", default="non-coco", help='"non-coco" (default), "all", or e.g. "door,window"')
    ap.add_argument("--model-type", default="yolov3", choices=["yolov3", "tiny-yolov3"])
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch", type=int, default=8, help="lower it if the GPU runs out of memory (minimum 2)")
    ap.add_argument("--drop-empty", action="store_true", help="leave out images without any chosen class")
    ap.add_argument("--rebuild", action="store_true", help="convert the dataset again")
    ap.add_argument("--resume", action="store_true",
                    help="start from the best checkpoint already in <workdir>/imageai-dataset/models "
                         "instead of the plain pretrained yolov3.pt. Use after a disconnect or to keep "
                         "improving an earlier run. Epoch numbers still start at 1 each time you run this "
                         "script, so an earlier best (e.g. epoch 40) can be overwritten by a worse epoch 1 "
                         "of this run if a fresh run's mAP does not beat it; the file only updates when a "
                         "run's own mAP improves on its own best, so watch the first few 'mAP@0.5' lines "
                         "and Ctrl+C if they never approach what you had before.")
    args = ap.parse_args()

    workdir, weights_dir = Path(args.workdir), Path(args.weights_dir)
    dataset, names = prepare_dataset(workdir, args.classes, not args.drop_empty, args.rebuild)

    base = download(WEIGHTS_URL.format(name=f"{args.model_type}.pt"), weights_dir / f"{args.model_type}.pt")
    if args.model_type != "yolov3":  # the API's COCO model is yolov3.pt by default
        download(WEIGHTS_URL.format(name="yolov3.pt"), weights_dir / "yolov3.pt")

    if args.resume:
        try:
            base, _ = pick_outputs(dataset, args.model_type)
            print(f"Resuming from {base.name}")
        except SystemExit:
            print("No earlier checkpoint found in this workdir; starting from the plain pretrained weights instead.")

    from imageai.Detection.Custom import DetectionModelTrainer

    trainer = DetectionModelTrainer()
    trainer.setModelTypeAsYOLOv3() if args.model_type == "yolov3" else trainer.setModelTypeAsTinyYOLOv3()
    trainer.setDataDirectory(data_directory=str(dataset))
    trainer.setTrainConfig(object_names_array=names, batch_size=args.batch, num_experiments=args.epochs,
                           train_from_pretrained_model=str(base))
    trainer.trainModel()

    model, config = pick_outputs(dataset, args.model_type)
    weights_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(model, weights_dir / "custom.pt")
    shutil.copy(config, weights_dir / "custom.json")
    print(f"\nSaved {weights_dir / 'custom.pt'} and {weights_dir / 'custom.json'}.")
    print("Start the API with:  DETECTOR_BACKEND=imageai uvicorn app.main:app --host 0.0.0.0 --port 8000")
    if args.model_type != "yolov3":
        print(f"and set IMAGEAI_CUSTOM_TYPE={args.model_type}")


if __name__ == "__main__":
    main()