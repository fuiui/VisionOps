from pathlib import Path

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
