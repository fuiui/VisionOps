from pathlib import Path
import json

from fastapi.testclient import TestClient

from app.main import create_app


def test_health_reports_database_ready(tmp_path: Path) -> None:
    app = create_app(
        database_path=tmp_path / "visionops.db",
        sample_data_dir=Path(__file__).parents[2] / "sample_data",
    )
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "ready"


def test_import_sample_data_populates_experiments_and_failures(tmp_path: Path) -> None:
    app = create_app(
        database_path=tmp_path / "visionops.db",
        sample_data_dir=Path(__file__).parents[2] / "sample_data",
    )
    client = TestClient(app)

    import_response = client.post("/api/import/sample")

    assert import_response.status_code == 200
    assert import_response.json()["experiments_imported"] == 3
    assert import_response.json()["visual_cases_imported"] == 4

    experiments_response = client.get("/api/experiments")
    failures_response = client.get("/api/failures")

    assert experiments_response.status_code == 200
    assert len(experiments_response.json()) == 3
    assert experiments_response.json()[0]["experiment_name"]
    assert failures_response.status_code == 200
    assert len(failures_response.json()) == 4


def test_experiment_detail_includes_metric_curve(tmp_path: Path) -> None:
    app = create_app(
        database_path=tmp_path / "visionops.db",
        sample_data_dir=Path(__file__).parents[2] / "sample_data",
    )
    client = TestClient(app)
    client.post("/api/import/sample")

    experiments = client.get("/api/experiments").json()
    response = client.get(f"/api/experiments/{experiments[0]['id']}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == experiments[0]["id"]
    assert len(payload["curve"]) >= 3
    assert {"epoch", "map50", "precision", "recall"} <= set(payload["curve"][0])


def test_experiment_detail_includes_analysis_and_related_visual_cases(tmp_path: Path) -> None:
    app = create_app(
        database_path=tmp_path / "visionops.db",
        sample_data_dir=Path(__file__).parents[2] / "sample_data",
    )
    client = TestClient(app)
    client.post("/api/import/sample")

    response = client.get("/api/experiments/exp-yolov8s-lowlight")

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis"]["headline"]
    assert payload["analysis"]["strengths"]
    assert payload["analysis"]["risks"]
    assert payload["analysis"]["next_steps"]
    assert payload["analysis"]["tradeoff"]
    assert {item["experiment_id"] for item in payload["visual_cases"]} == {"exp-yolov8s-lowlight"}


def test_experiment_detail_includes_single_model_analysis_fields(tmp_path: Path) -> None:
    app = create_app(
        database_path=tmp_path / "visionops.db",
        sample_data_dir=Path(__file__).parents[2] / "sample_data",
    )
    client = TestClient(app)
    client.post("/api/import/sample")

    response = client.get("/api/experiments/exp-yolov8s-lowlight")

    assert response.status_code == 200
    payload = response.json()
    assert {"map50", "precision", "recall", "fps", "frame_time_ms"} <= set(payload["baseline_comparison"])
    assert payload["baseline_comparison"]["map50"]["baseline_experiment_name"] == "YOLOv8n Baseline"
    assert payload["baseline_comparison"]["map50"]["absolute_delta"] > 0
    assert payload["baseline_comparison"]["map50"]["best_epoch"] <= payload["baseline_comparison"]["map50"]["final_epoch"]
    assert {"accuracy", "loss", "learning_rate"} <= set(payload["curve_groups"])
    assert {"precision", "recall", "map50", "map5095"} <= set(payload["curve_groups"]["accuracy"][0])
    assert {"train_box_loss", "val_box_loss", "train_cls_loss", "val_cls_loss"} <= set(payload["curve_groups"]["loss"][0])
    assert "lr" in payload["curve_groups"]["learning_rate"][0]
    assert len(payload["class_metrics"]) == 17
    assert {"class_name", "precision", "recall", "map50", "map5095", "samples"} <= set(payload["class_metrics"][0])
    assert {"false_positive", "false_negative", "class_error", "localization_error"} <= set(payload["error_summary"])


def test_import_sample_data_returns_dynamic_numeric_metrics(tmp_path: Path) -> None:
    sample_dir = tmp_path / "sample_data"
    experiment_dir = sample_dir / "experiments" / "dynamic_run"
    experiment_dir.mkdir(parents=True)
    (experiment_dir / "results.csv").write_text(
        "\n".join(
            [
                "epoch,precision,recall,map50,map5095,box_loss,notes",
                "1,0.40,0.31,0.35,0.18,1.42,warmup",
                "5,0.62,0.58,0.66,0.39,0.82,final",
            ]
        ),
        encoding="utf-8",
    )
    (sample_dir / "manifest.json").write_text(
        json.dumps(
            {
                "experiments": [
                    {
                        "id": "exp-dynamic",
                        "experiment_folder": "experiments/dynamic_run",
                        "experiment_name": "Dynamic Metrics Run",
                        "experiment_group": "dynamic",
                        "method": "Run with an extra metric column.",
                        "results_csv": "experiments/dynamic_run/results.csv",
                        "fps": 77.5,
                        "frame_time_ms": 12.9,
                        "created_at": "2026-06-01T10:00:00Z",
                        "notes": "Includes box_loss and a non-numeric notes column.",
                    }
                ],
                "visual_cases": [],
            }
        ),
        encoding="utf-8",
    )
    app = create_app(database_path=tmp_path / "visionops.db", sample_data_dir=sample_dir)
    client = TestClient(app)

    assert client.post("/api/import/sample").status_code == 200
    payload = client.get("/api/experiments").json()[0]
    metric_keys = {metric["key"] for metric in payload["metrics"]}

    assert {"precision", "recall", "map50", "map5095", "box_loss", "fps", "frame_time_ms"} <= metric_keys
    assert "notes" not in metric_keys
    box_loss = next(metric for metric in payload["metrics"] if metric["key"] == "box_loss")
    assert box_loss["value"] == 0.82
    assert box_loss["direction"] == "lower"
    assert box_loss["unit"] == ""


def test_demo_summary_reports_empty_state_before_import(tmp_path: Path) -> None:
    app = create_app(
        database_path=tmp_path / "visionops.db",
        sample_data_dir=Path(__file__).parents[2] / "sample_data",
    )
    client = TestClient(app)

    response = client.get("/api/demo-summary")

    assert response.status_code == 200
    assert response.json() == {
        "demo_mode": True,
        "status": "empty",
        "experiment_count": 0,
        "failure_case_count": 0,
        "best_map_model": None,
        "best_fps_model": None,
        "latest_imported_at": None,
    }


def test_demo_summary_reports_story_metrics_after_sample_import(tmp_path: Path) -> None:
    app = create_app(
        database_path=tmp_path / "visionops.db",
        sample_data_dir=Path(__file__).parents[2] / "sample_data",
    )
    client = TestClient(app)
    client.post("/api/import/sample")

    response = client.get("/api/demo-summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["demo_mode"] is True
    assert payload["status"] == "normal"
    assert payload["experiment_count"] == 3
    assert payload["failure_case_count"] == 4
    assert payload["best_map_model"]["experiment_name"] == "YOLOv8s Low-Light Augmentation"
    assert payload["best_fps_model"]["experiment_name"] == "YOLOv8n Edge Speed"
    assert payload["latest_imported_at"]
