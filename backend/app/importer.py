from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .database import Database


METRIC_METADATA = {
    "precision": {"label": "Precision", "unit": "", "direction": "higher", "group": "accuracy"},
    "recall": {"label": "Recall", "unit": "", "direction": "higher", "group": "accuracy"},
    "map50": {"label": "mAP@0.5", "unit": "", "direction": "higher", "group": "accuracy"},
    "map5095": {"label": "mAP@0.5:0.95", "unit": "", "direction": "higher", "group": "accuracy"},
    "fps": {"label": "FPS", "unit": "fps", "direction": "higher", "group": "speed"},
    "frame_time_ms": {"label": "Frame time", "unit": "ms", "direction": "lower", "group": "speed"},
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def metric_key(raw_name: str) -> str:
    normalized = raw_name.strip().lower()
    normalized = normalized.replace("map@0.5", "map50").replace("map50-95", "map5095")
    normalized = normalized.replace("map@0.5:0.95", "map5095")
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")
    return normalized


def metric_label(key: str) -> str:
    if key in METRIC_METADATA:
        return METRIC_METADATA[key]["label"]
    return key.replace("_", " ").title()


def metric_unit(key: str) -> str:
    return METRIC_METADATA.get(key, {}).get("unit", "")


def metric_direction(key: str) -> str:
    if key in METRIC_METADATA:
        return METRIC_METADATA[key]["direction"]
    return "lower" if "loss" in key or "error" in key or key.endswith("_ms") else "higher"


def metric_group(key: str) -> str:
    if key in METRIC_METADATA:
        return METRIC_METADATA[key]["group"]
    if "loss" in key or "error" in key:
        return "loss"
    if "fps" in key or key.endswith("_ms") or "time" in key or "latency" in key:
        return "speed"
    if "map" in key or "precision" in key or "recall" in key or "acc" in key:
        return "accuracy"
    return "other"


def read_numeric_metrics(row: dict[str, str]) -> dict[str, float]:
    metrics: dict[str, float] = {}
    for raw_key, raw_value in row.items():
        key = metric_key(raw_key)
        if key == "epoch" or raw_value is None or raw_value == "":
            continue
        try:
            metrics[key] = float(raw_value)
        except ValueError:
            continue
    return metrics


def read_curve(csv_path: Path) -> list[dict[str, float | int]]:
    points: list[dict[str, float | int]] = []
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            point = {"epoch": int(row["epoch"])}
            point.update(read_numeric_metrics(row))
            points.append(point)
    if not points:
        raise ValueError(f"No metric rows found in {csv_path}")
    return points


def import_sample_data(database: Database, sample_data_dir: Path) -> dict[str, int]:
    manifest_path = sample_data_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Sample manifest not found: {manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    imported_at = utc_now()

    with database.connect() as connection:
        connection.execute("DELETE FROM visual_cases")
        connection.execute("DELETE FROM metric_values")
        connection.execute("DELETE FROM metric_points")
        connection.execute("DELETE FROM metrics")
        connection.execute("DELETE FROM experiments")

        for experiment in manifest["experiments"]:
            results_csv = sample_data_dir / experiment["results_csv"]
            curve = read_curve(results_csv)
            final_point = curve[-1]
            final_metrics = {
                key: float(value)
                for key, value in final_point.items()
                if key != "epoch" and isinstance(value, (float, int))
            }
            final_metrics["fps"] = float(experiment["fps"])
            final_metrics["frame_time_ms"] = float(experiment["frame_time_ms"])

            connection.execute(
                """
                INSERT INTO experiments (
                    id, experiment_folder, experiment_name, experiment_group,
                    method, epoch, source_path, created_at, imported_at, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    experiment["id"],
                    experiment["experiment_folder"],
                    experiment["experiment_name"],
                    experiment["experiment_group"],
                    experiment["method"],
                    int(final_point["epoch"]),
                    str(results_csv),
                    experiment["created_at"],
                    imported_at,
                    experiment["notes"],
                ),
            )
            connection.execute(
                """
                INSERT INTO metrics (
                    experiment_id, precision, recall, map50, map5095,
                    fps, frame_time_ms, data_source
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    experiment["id"],
                    final_point["precision"],
                    final_point["recall"],
                    final_point["map50"],
                    final_point["map5095"],
                    float(experiment["fps"]),
                    float(experiment["frame_time_ms"]),
                    "sample_data",
                ),
            )
            connection.executemany(
                """
                INSERT INTO metric_points (
                    experiment_id, epoch, precision, recall, map50, map5095
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        experiment["id"],
                        int(point["epoch"]),
                        float(point["precision"]),
                        float(point["recall"]),
                        float(point["map50"]),
                        float(point["map5095"]),
                    )
                    for point in curve
                ],
            )
            connection.executemany(
                """
                INSERT INTO metric_values (
                    experiment_id, metric_key, metric_label, metric_value,
                    metric_unit, metric_direction, metric_group
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        experiment["id"],
                        key,
                        metric_label(key),
                        value,
                        metric_unit(key),
                        metric_direction(key),
                        metric_group(key),
                    )
                    for key, value in final_metrics.items()
                ],
            )

        for visual_case in manifest["visual_cases"]:
            connection.execute(
                """
                INSERT INTO visual_cases (
                    id, experiment_id, image_path, image_url, case_type,
                    model_name, description, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    visual_case["id"],
                    visual_case["experiment_id"],
                    str(sample_data_dir / visual_case["image_path"]),
                    f"/sample_data/{visual_case['image_path']}",
                    visual_case["case_type"],
                    visual_case["model_name"],
                    visual_case["description"],
                    visual_case["created_at"],
                ),
            )

    return {
        "experiments_imported": len(manifest["experiments"]),
        "visual_cases_imported": len(manifest["visual_cases"]),
    }


def list_experiments(database: Database) -> list[dict[str, Any]]:
    experiments = database.query(
        """
        SELECT
            e.id, e.experiment_folder, e.experiment_name, e.experiment_group,
            e.method, e.epoch, e.source_path, e.created_at, e.imported_at, e.notes,
            m.precision, m.recall, m.map50, m.map5095, m.fps, m.frame_time_ms,
            m.data_source
        FROM experiments e
        JOIN metrics m ON m.experiment_id = e.id
        ORDER BY m.map50 DESC, m.fps DESC
        """
    )
    attach_metric_values(database, experiments)
    return experiments


def attach_metric_values(database: Database, experiments: list[dict[str, Any]]) -> None:
    if not experiments:
        return
    metric_rows = database.query(
        """
        SELECT
            experiment_id, metric_key AS key, metric_label AS label,
            metric_value AS value, metric_unit AS unit,
            metric_direction AS direction, metric_group AS metric_group
        FROM metric_values
        ORDER BY id ASC
        """
    )
    by_experiment: dict[str, list[dict[str, Any]]] = {}
    for row in metric_rows:
        experiment_id = row.pop("experiment_id")
        by_experiment.setdefault(experiment_id, []).append(row)
    for experiment in experiments:
        experiment["metrics"] = by_experiment.get(experiment["id"], [])


def build_experiment_analysis(experiment: dict[str, Any]) -> dict[str, Any]:
    precision = float(experiment["precision"])
    recall = float(experiment["recall"])
    map50 = float(experiment["map50"])
    fps = float(experiment["fps"])
    frame_time_ms = float(experiment["frame_time_ms"])

    accuracy_label = "strong" if map50 >= 0.7 else "moderate" if map50 >= 0.62 else "early baseline"
    speed_label = "fast" if fps >= 100 else "balanced" if fps >= 70 else "slower but richer"

    if precision >= recall:
        risk = "Recall trails precision, so missed objects should be reviewed before using this model as the final detector."
        next_step = "Inspect false negatives and add targeted low-light or small-object examples before the next run."
    else:
        risk = "Recall is ahead of precision, so false positives need closer review before deployment."
        next_step = "Inspect false positives and tighten confidence or augmentation choices in the next run."

    return {
        "headline": f"{experiment['experiment_name']} is a {accuracy_label} accuracy run with {speed_label} inference speed.",
        "strengths": [
            f"mAP@0.5 is {map50:.3f}, which makes this run useful for comparing detector quality.",
            f"FPS is {fps:.1f} with {frame_time_ms:.1f} ms per frame, so the latency tradeoff is visible.",
        ],
        "risks": [risk],
        "next_steps": [next_step],
        "tradeoff": (
            "Use this run when accuracy matters most."
            if map50 >= 0.7
            else "Use this run as a speed or baseline reference before deeper failure analysis."
        ),
    }


def list_visual_cases_for_experiment(database: Database, experiment_id: str) -> list[dict[str, Any]]:
    return database.query(
        """
        SELECT
            v.id, v.experiment_id, v.image_path, v.image_url, v.case_type,
            v.model_name, v.description, v.created_at,
            e.experiment_name, e.experiment_group
        FROM visual_cases v
        JOIN experiments e ON e.id = v.experiment_id
        WHERE v.experiment_id = ?
        ORDER BY v.created_at DESC, v.id ASC
        """,
        (experiment_id,),
    )


def get_experiment_detail(database: Database, experiment_id: str) -> dict[str, Any] | None:
    experiment = database.query_one(
        """
        SELECT
            e.id, e.experiment_folder, e.experiment_name, e.experiment_group,
            e.method, e.epoch, e.source_path, e.created_at, e.imported_at, e.notes,
            m.precision, m.recall, m.map50, m.map5095, m.fps, m.frame_time_ms,
            m.data_source
        FROM experiments e
        JOIN metrics m ON m.experiment_id = e.id
        WHERE e.id = ?
        """,
        (experiment_id,),
    )
    if experiment is None:
        return None
    experiment["curve"] = database.query(
        """
        SELECT epoch, precision, recall, map50, map5095
        FROM metric_points
        WHERE experiment_id = ?
        ORDER BY epoch ASC
        """,
        (experiment_id,),
    )
    attach_metric_values(database, [experiment])
    experiment["visual_cases"] = list_visual_cases_for_experiment(database, experiment_id)
    experiment["analysis"] = build_experiment_analysis(experiment)
    return experiment


def list_visual_cases(database: Database) -> list[dict[str, Any]]:
    return database.query(
        """
        SELECT
            v.id, v.experiment_id, v.image_path, v.image_url, v.case_type,
            v.model_name, v.description, v.created_at,
            e.experiment_name, e.experiment_group
        FROM visual_cases v
        JOIN experiments e ON e.id = v.experiment_id
        ORDER BY v.created_at DESC, v.id ASC
        """
    )


def get_demo_summary(database: Database) -> dict[str, Any]:
    experiments = list_experiments(database)
    failures = list_visual_cases(database)
    if not experiments:
        return {
            "demo_mode": True,
            "status": "empty",
            "experiment_count": 0,
            "failure_case_count": 0,
            "best_map_model": None,
            "best_fps_model": None,
            "latest_imported_at": None,
        }

    best_map_model = max(experiments, key=lambda experiment: experiment["map50"])
    best_fps_model = max(experiments, key=lambda experiment: experiment["fps"])
    latest_imported_at = max(experiment["imported_at"] for experiment in experiments)
    return {
        "demo_mode": True,
        "status": "normal",
        "experiment_count": len(experiments),
        "failure_case_count": len(failures),
        "best_map_model": best_map_model,
        "best_fps_model": best_fps_model,
        "latest_imported_at": latest_imported_at,
    }
