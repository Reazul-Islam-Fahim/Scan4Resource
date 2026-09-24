# Scan4Resource API

FastAPI backend for the Scan4Resource door-scanner app (the merged frontend). The phone sends camera frames;
the API finds the doors, gives each physical door one stable id (so it is counted once), estimates its width
and height in centimetres, guesses the material, and stores saved scans.

The API has one contract, the one described in the frontend's README. The two earlier frontend versions used
different routes (`POST /scan/frame`) and field names (`name`); those are gone, so use the merged frontend.

## Run it

```bash
pip install -r requirements.txt          # Python 3.10 is the safe choice for ImageAI; also: apt install python3-tk
python scripts/train_imageai_detector.py # once: trains the custom model, downloads the COCO model (see below)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The first start downloads the models (a few hundred MB). Then set `VITE_API_URL` in the frontend to this API's
**HTTPS** address (a page served over HTTPS cannot call a plain-HTTP API) and redeploy or restart it.

To try the connection before the models are ready: `PIPELINE=fake uvicorn app.main:app` returns simulated doors
(check `GET /health`, which says which pipeline is running).

On Google Colab, use `Scan4Resource_Backend_Colab.ipynb`: it installs everything, starts the API and opens an
HTTPS tunnel.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/detect` | multipart `frame` (JPEG), `scan_id`, `frame_index`. Returns the doors in the frame |
| POST | `/scans` | JSON `{ id, site, started_at, finished_at, doors }`. Saving the same `id` again replaces the earlier save |
| GET | `/scans` | newest first, each with `created_at` |
| DELETE | `/scans/{id}` | 204, or 404 |
| GET | `/health` | which pipeline and models are running |

Detection response:

```json
{ "doors": [ { "id": "door-3", "box": { "x": 0.31, "y": 0.12, "w": 0.34, "h": 0.74 },
               "width_cm": 91.2, "height_cm": 203.8, "material": "wood", "confidence": 0.93 } ],
  "objects": [ { "id": "window-1", "label": "window", "box": { "x": 0.05, "y": 0.10, "w": 0.20, "h": 0.30 },
                 "width_cm": 118.0, "height_cm": 121.5, "material": null, "confidence": 0.88 },
               { "id": "chair-2", "label": "chair", "box": { "x": 0.70, "y": 0.55, "w": 0.20, "h": 0.35 },
                 "width_cm": null, "height_cm": null, "material": null, "confidence": 0.81 } ] }
```

`doors` is unchanged. `objects` holds everything else that was detected, each with a `label`. Only labels listed in
`MEASURE_LABELS` (door, window) get a size, and only `MATERIAL_LABELS` (door) get a material. For all other objects
`confidence` is the detector's own confidence.

`material` is `wood`, `metal`, `glass`, `pvc`, `composite` or `unknown`; the frontend turns it into a label.
`width_cm` / `height_cm` are `null` until a usable reading exists. A door is only reported once it has been seen in `MIN_HITS` frames, which
keeps one-frame false alarms out of the count.

## How it works

1. **Detect.** ImageAI (`DETECTOR_BACKEND=imageai`) runs two models on every frame. Your **custom model** (trained
   by `scripts/train_imageai_detector.py` on HomeObjects-3K) finds the classes COCO does not have: lamp, wardrobe,
   window, door, photo frame. ImageAI's pretrained **COCO model** finds everyday objects (chair, sofa, bed,
   tvmonitor, laptop, pottedplant, sink, ...). The classes do not overlap, and if the two models ever box the same
   object (`OVERLAP_IOU`), only the more confident answer is kept. COCO names are ImageAI's spelling, e.g. `sofa`,
   `diningtable`, `tvmonitor`, `pottedplant`. The earlier Ultralytics detector is still available with
   `DETECTOR_BACKEND=ultralytics` (`scripts/train_door_detector.py`).
2. **Track.** Frames arrive ~every 600 ms while the phone moves, so a door is matched to the previous frame's
   door by overlap, or by being close, similarly sized and similarly coloured. The same door keeps the same id.
3. **Measure.** Depth Anything V2 (metric, indoor) gives the distance to the door; with the camera's focal
   length the door's edges become real-world points. A door seen at an angle is measured correctly, and a door
   cut off by the frame edge is skipped. Readings from many frames are combined (weighted median), so the numbers
   settle as you look at the door for longer.
4. **Material.** CLIP zero-shot on the cropped door, averaged over a few frames.

## Accuracy: read this

- **Sizes are estimates, not survey measurements.** The geometry is tested (tests/test_measure.py recovers
  synthetic doors to within about 2%), but the accuracy in a real house depends on the depth model, which can be
  off by several percent, and on the camera's field of view. **Calibrate:** measure one real door with a tape,
  compare with what the app reports, and set `DEPTH_SCALE = tape / reported`. If your phone's main camera is not
  a typical 26 mm-equivalent, adjust `FOCAL_RATIO` too. Check a handful of doors before trusting the numbers.
- **Frame the whole door.** Doors touching the edge of the frame are ignored, because they would be measured
  too small. Step back until the door fits.
- **Counting each door once has limits.** A door that leaves the view for more than `MAX_GAP_S` seconds and comes
  back is counted again, because a phone camera alone cannot tell "the same white door" from "another identical
  white door". `REID=true` matches returning doors by colour, but then two identical doors may be merged
  into one. Users can fix the count in the app's review step. A reliable answer needs camera pose (ARKit /
  ARCore), which a browser page cannot give.
- **Material is a best guess** from a general image model; it will confuse painted wood, PVC and composite. The
  corrections people make in the review screen are the data you need to train a better classifier later.

## Deploying

The tunnel used in the Colab notebook gives a new URL every run, and `VITE_API_URL` is baked into the frontend at
build time, so it suits development only. For a stable deployment, run the API on a machine that stays up
(a GPU VM, or a container host), put it behind HTTPS, and set `ALLOWED_ORIGINS` to your Vercel URL. The API has no
login: anyone who knows the URL can use it. Add authentication before real use. Saved scans live in
`DB_PATH` (SQLite); on Colab that disappears with the runtime.

## Licences

ImageAI is MIT-licensed, but its YOLOv3 code credits `ultralytics/yolov3` as a reference: check the licence of the
code and of the pretrained weights before commercial use. HomeObjects-3K (the training data) is AGPL-3.0.
Ultralytics YOLO (only used with `DETECTOR_BACKEND=ultralytics`) is AGPL-3.0 too. The DoorDetect dataset's images
come from Open Images and MCIndoor20000.

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest
```
