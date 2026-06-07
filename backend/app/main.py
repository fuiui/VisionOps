from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Database
from .importer import (
    get_demo_summary,
    get_experiment_detail,
    import_sample_data,
    list_experiments,
    list_visual_cases,
)


def default_database_path() -> Path:
    return Path(os.environ.get("VISIONOPS_DB_PATH", "data/visionops.db"))


def default_sample_data_dir() -> Path:
    return Path(os.environ.get("VISIONOPS_SAMPLE_DATA_DIR", "../sample_data")).resolve()


def create_app(
    database_path: Path | None = None,
    sample_data_dir: Path | None = None,
) -> FastAPI:
    database = Database(database_path or default_database_path())
    sample_dir = sample_data_dir or default_sample_data_dir()
    uploads_dir = Path(os.environ.get("VISIONOPS_UPLOAD_DIR", "data/uploads"))
    uploads_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(
        title="VisionOps API",
        description="Computer vision experiment management and failure analysis API.",
        version="0.1.0",
    )
    app.state.database = database
    app.state.sample_data_dir = sample_dir
    app.state.uploads_dir = uploads_dir

    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get("VISIONOPS_CORS_ORIGINS", "*").split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if sample_dir.exists():
        app.mount("/sample_data", StaticFiles(directory=sample_dir), name="sample_data")

    def get_database() -> Database:
        return app.state.database

    @app.get("/api/health")
    def health(db: Database = Depends(get_database)) -> dict[str, str | bool]:
        db.query_one("SELECT name FROM sqlite_master WHERE type = 'table' LIMIT 1")
        return {
            "status": "ok",
            "database": "ready",
            "demo_mode": True,
            "service": "visionops-backend",
        }

    @app.post("/api/import/sample")
    def import_sample(db: Database = Depends(get_database)) -> dict[str, int]:
        try:
            return import_sample_data(db, app.state.sample_data_dir)
        except (FileNotFoundError, ValueError, KeyError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/import/local")
    def import_local() -> dict[str, str]:
        return {
            "status": "not_implemented",
            "message": "Local Research Mode is planned after the Phase 1 Demo Mode scaffold.",
        }

    @app.get("/api/demo-summary")
    def demo_summary(db: Database = Depends(get_database)) -> dict:
        return get_demo_summary(db)

    @app.get("/api/experiments")
    def experiments(db: Database = Depends(get_database)) -> list[dict]:
        return list_experiments(db)

    @app.get("/api/experiments/{experiment_id}")
    def experiment_detail(
        experiment_id: str,
        db: Database = Depends(get_database),
    ) -> dict:
        experiment = get_experiment_detail(db, experiment_id, app.state.sample_data_dir)
        if experiment is None:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return experiment

    @app.get("/api/failures")
    def failures(db: Database = Depends(get_database)) -> list[dict]:
        return list_visual_cases(db)

    @app.post("/api/infer")
    async def infer(
        image: UploadFile = File(),
        confidence: float = 0.35,
        nms_iou: float = 0.45,
        image_size: int = 640,
        device: str = "cpu",
        save_result: bool = True,
        model_path: str = "demo-mode",
    ) -> dict:
        start = perf_counter()
        safe_name = Path(image.filename or "upload.bin").name
        saved_path = app.state.uploads_dir / safe_name
        saved_path.write_bytes(await image.read())
        upload_ms = round((perf_counter() - start) * 1000, 2)
        preprocess_ms = 2.1
        inference_ms = 11.8
        postprocess_ms = 1.7
        total_ms = round(preprocess_ms + inference_ms + postprocess_ms + min(upload_ms, 1.0), 2)
        fps = round(1000 / total_ms, 1) if total_ms else 0.0
        annotated_image_url = "/sample_data/inference_images/demo_upload.svg" if save_result else ""

        with database.connect() as connection:
            connection.execute(
                """
                INSERT INTO inference_runs (
                    model_path, input_image_path, output_image_path,
                    inference_time_ms, created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    model_path,
                    str(saved_path),
                    annotated_image_url,
                    total_ms,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

        detection_confidence = round(max(confidence, 0.72), 2)
        return {
            "mode": "demo",
            "message": "Phase 1 returns a deterministic demo detection. Real YOLO weights are wired in a later phase.",
            "model_path": model_path,
            "confidence_threshold": confidence,
            "inference_time_ms": total_ms,
            "annotated_image_url": annotated_image_url,
            "parameters": {
                "confidence": confidence,
                "nms_iou": nms_iou,
                "image_size": image_size,
                "device": device,
                "save_result": save_result,
            },
            "timing": {
                "preprocess_ms": preprocess_ms,
                "inference_ms": inference_ms,
                "postprocess_ms": postprocess_ms,
                "total_ms": total_ms,
                "fps": fps,
            },
            "detections": [
                {
                    "label": "wildlife",
                    "confidence": detection_confidence,
                    "x1": 0.22,
                    "y1": 0.18,
                    "x2": 0.68,
                    "y2": 0.70,
                    "box": {"x": 0.22, "y": 0.18, "width": 0.46, "height": 0.52},
                }
            ],
        }

    return app


app = create_app()
