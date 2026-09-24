"""
Convert HomeObjects-3K (Ultralytics layout) into the folder layout ImageAI expects.

By default it keeps only the classes that COCO does NOT have, so your custom model and the COCO model
never report the same kind of object:

    kept (custom model):   lamp, wardrobe, window, door, photo frame
    dropped (COCO owns):   bed, sofa (COCO: couch), chair, table (COCO: dining table), tv, laptop, potted plant

Images that contain none of the kept classes stay in the dataset as negative examples (no annotation file),
so the custom model learns that a sofa or chair is background, not a wardrobe.

Usage:
    python prepare_homeobjects.py --src homeobjects-3K --dst my-dataset
    python prepare_homeobjects.py --src homeobjects-3K --dst my-dataset --classes all
    python prepare_homeobjects.py --src homeobjects-3K --dst my-dataset --classes door,window --drop-empty

Input (unzipped homeobjects-3K.zip):
    <src>/images/{train,val}/*.jpg
    <src>/labels/{train,val}/*.txt

Output:
    <dst>/train/{images,annotations}
    <dst>/validation/{images,annotations}
    <dst>/classes.txt        (one class name per line, in index order = object_names_array)
"""
import argparse
import shutil
from pathlib import Path

# HomeObjects-3K's own class order (from HomeObjects-3K.yaml)
ALL_NAMES = ["bed", "sofa", "chair", "table", "lamp", "tv", "laptop",
             "wardrobe", "window", "door", "potted plant", "photo frame"]
# HomeObjects classes that also exist in COCO (COCO names: bed, couch, chair, dining table, tv, laptop, potted plant)
COCO_OVERLAP = {"bed", "sofa", "chair", "table", "tv", "laptop", "potted plant"}
NON_COCO = [n for n in ALL_NAMES if n not in COCO_OVERLAP]

SPLITS = {"train": "train", "val": "validation"}  # source split -> ImageAI split
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}


def build_mapping(classes_arg: str):
    """Return (names_in_new_order, {old_id: new_id})."""
    key = classes_arg.strip().lower()
    if key == "all":
        names = list(ALL_NAMES)
    elif key == "non-coco":
        names = list(NON_COCO)
    else:
        names = [c.strip() for c in classes_arg.split(",") if c.strip()]
        unknown = [n for n in names if n not in ALL_NAMES]
        if unknown:
            raise SystemExit(f"Unknown class(es) {unknown}. Choose from: {ALL_NAMES}")
    return names, {ALL_NAMES.index(n): i for i, n in enumerate(names)}


def convert_split(src, dst, src_split, dst_split, names, class_map, keep_empty):
    img_dir = src / "images" / src_split
    lbl_dir = src / "labels" / src_split
    out_img = dst / dst_split / "images"
    out_ann = dst / dst_split / "annotations"
    out_img.mkdir(parents=True, exist_ok=True)
    out_ann.mkdir(parents=True, exist_ok=True)

    labelled = negatives = skipped = 0
    boxes = {n: 0 for n in names}

    for img in sorted(img_dir.iterdir()):
        if img.suffix.lower() not in IMG_EXTS:
            continue
        lbl = lbl_dir / (img.stem + ".txt")
        new_lines = []
        if lbl.exists():
            for line in lbl.read_text().splitlines():  # splitlines() also handles CRLF
                parts = line.split()
                if len(parts) != 5:
                    continue
                old = int(float(parts[0]))
                if old in class_map:
                    new_lines.append(" ".join([str(class_map[old])] + parts[1:]))
                    boxes[names[class_map[old]]] += 1

        if not new_lines and not keep_empty:
            skipped += 1
            continue

        shutil.copy2(img, out_img / img.name)
        if new_lines:
            (out_ann / (img.stem + ".txt")).write_text("\n".join(new_lines) + "\n")
            labelled += 1
        else:
            # Negative example: ImageAI treats a missing annotation file as "no objects".
            negatives += 1

    return {"images_with_labels": labelled, "negative_images": negatives,
            "images_skipped": skipped, "boxes": boxes}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="unzipped homeobjects-3K folder")
    ap.add_argument("--dst", required=True, help="output dataset folder")
    ap.add_argument("--classes", default="non-coco",
                    help='"non-coco" (default), "all", or a comma-separated list such as "door,window"')
    ap.add_argument("--drop-empty", action="store_true",
                    help="leave out images that contain none of the chosen classes (default: keep them as negatives)")
    args = ap.parse_args()

    src, dst = Path(args.src), Path(args.dst)
    names, class_map = build_mapping(args.classes)
    for s, d in SPLITS.items():
        print(d, convert_split(src, dst, s, d, names, class_map, keep_empty=not args.drop_empty))
    dst.mkdir(parents=True, exist_ok=True)
    (dst / "classes.txt").write_text("\n".join(names) + "\n")
    print("object_names_array =", names)


if __name__ == "__main__":
    main()
