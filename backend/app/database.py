from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    experiment_folder TEXT NOT NULL,
    experiment_name TEXT NOT NULL,
    experiment_group TEXT NOT NULL,
    method TEXT NOT NULL,
    epoch INTEGER NOT NULL,
    source_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    precision REAL NOT NULL,
    recall REAL NOT NULL,
    map50 REAL NOT NULL,
    map5095 REAL NOT NULL,
    fps REAL NOT NULL,
    frame_time_ms REAL NOT NULL,
    data_source TEXT NOT NULL,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS metric_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    epoch INTEGER NOT NULL,
    precision REAL NOT NULL,
    recall REAL NOT NULL,
    map50 REAL NOT NULL,
    map5095 REAL NOT NULL,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS metric_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    metric_label TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT NOT NULL,
    metric_direction TEXT NOT NULL,
    metric_group TEXT NOT NULL,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visual_cases (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    image_path TEXT NOT NULL,
    image_url TEXT NOT NULL,
    case_type TEXT NOT NULL,
    error_type TEXT NOT NULL DEFAULT '',
    gt_class TEXT NOT NULL DEFAULT '',
    pred_class TEXT NOT NULL DEFAULT '',
    confidence REAL,
    iou REAL,
    object_size TEXT NOT NULL DEFAULT '',
    scene_tags TEXT NOT NULL DEFAULT '[]',
    reason TEXT NOT NULL DEFAULT '',
    case_group_id TEXT NOT NULL DEFAULT '',
    model_name TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inference_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_path TEXT NOT NULL,
    input_image_path TEXT NOT NULL,
    output_image_path TEXT NOT NULL,
    inference_time_ms REAL NOT NULL,
    created_at TEXT NOT NULL
);
"""


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def initialize(self) -> None:
        with sqlite3.connect(self.path) as connection:
            connection.executescript(SCHEMA)
            self.migrate(connection)

    def migrate(self, connection: sqlite3.Connection) -> None:
        visual_columns = {row[1] for row in connection.execute("PRAGMA table_info(visual_cases)").fetchall()}
        migrations = {
            "error_type": "ALTER TABLE visual_cases ADD COLUMN error_type TEXT NOT NULL DEFAULT ''",
            "gt_class": "ALTER TABLE visual_cases ADD COLUMN gt_class TEXT NOT NULL DEFAULT ''",
            "pred_class": "ALTER TABLE visual_cases ADD COLUMN pred_class TEXT NOT NULL DEFAULT ''",
            "confidence": "ALTER TABLE visual_cases ADD COLUMN confidence REAL",
            "iou": "ALTER TABLE visual_cases ADD COLUMN iou REAL",
            "object_size": "ALTER TABLE visual_cases ADD COLUMN object_size TEXT NOT NULL DEFAULT ''",
            "scene_tags": "ALTER TABLE visual_cases ADD COLUMN scene_tags TEXT NOT NULL DEFAULT '[]'",
            "reason": "ALTER TABLE visual_cases ADD COLUMN reason TEXT NOT NULL DEFAULT ''",
            "case_group_id": "ALTER TABLE visual_cases ADD COLUMN case_group_id TEXT NOT NULL DEFAULT ''",
        }
        for column, statement in migrations.items():
            if column not in visual_columns:
                connection.execute(statement)

    def execute(self, sql: str, params: Iterable[Any] = ()) -> None:
        with self.connect() as connection:
            connection.execute(sql, tuple(params))

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(sql, tuple(params)).fetchall()
        return [dict(row) for row in rows]

    def query_one(self, sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None
