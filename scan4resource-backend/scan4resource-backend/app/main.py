"""Scan4Resource API, for the Scan4Resource frontend.

    POST   /detect       multipart: frame, scan_id, frame_index       -> { doors: [...] }
    POST   /scans        json: { id?, site?, started_at?, finished_at?, doors: [...] }
    GET    /scans        -> [ scan, ... ]  newest first
    DELETE /scans/{id}   -> 204, or 404
    GET    /health

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .imaging import decode_image
from .pipeline import Pipeline, build_pipeline
from .schemas import ScanIn
from .store import ScanStore

log = logging.getLogger("scan4resource")


def create_app(settings: Optional[Settings] = None, pipeline: Optional[Pipeline] = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.store = ScanStore(settings.db_path)
        app.state.pipeline = pipeline or build_pipeline(settings)  # loads the models once, at start-up
        log.info("Pipeline ready: %s", app.state.pipeline.describe())
        yield

    app = FastAPI(title="Scan4Resource API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    # ---- health --------------------------------------------------------------------
    @app.get("/")
    def root():
        return {"service": "Scan4Resource API", "status": "ok"}

    @app.get("/health")
    def health():
        return {"status": "ok", "pipeline": settings.pipeline, **app.state.pipeline.describe()}

    # ---- live detection ---------------------------------------------------------------
    @app.post("/detect")
    def detect(
        frame: UploadFile = File(...),
        scan_id: Optional[str] = Form(None),
        frame_index: Optional[int] = Form(None),
    ):
        """One camera frame in, the doors visible in it out. `scan_id` ties the frames of one walkthrough
        together, so a door seen in many frames keeps one id. Materials are the keys wood, metal, glass, pvc,
        composite or unknown."""
        try:
            image = decode_image(frame.file.read())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"doors": app.state.pipeline.process(image, scan_id or "default")}

    # ---- saved scans --------------------------------------------------------------------
    @app.post("/scans", status_code=201)
    def save_scan(scan: ScanIn):
        return app.state.store.save(scan)

    @app.get("/scans")
    def list_scans():
        return app.state.store.list()

    @app.delete("/scans/{scan_id}", status_code=204)
    def delete_scan(scan_id: str):
        if not app.state.store.delete(scan_id):
            raise HTTPException(status_code=404, detail="Scan not found.")
        return Response(status_code=204)

    return app


# `uvicorn app.main:app` builds the app from environment variables.
app = create_app()
