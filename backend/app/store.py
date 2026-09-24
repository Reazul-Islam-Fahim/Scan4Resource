"""Saved scans, in SQLite (a single file, no server to run)."""
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .schemas import ScanIn


class ScanStore:
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._db.execute(
                """CREATE TABLE IF NOT EXISTS scans (
                       id TEXT PRIMARY KEY,
                       site TEXT NOT NULL,
                       started_at TEXT,
                       finished_at TEXT,
                       created_at TEXT NOT NULL,
                       doors TEXT NOT NULL)"""
            )
            self._migrate_old_layout()
            self._db.commit()

    def _migrate_old_layout(self) -> None:
        """Earlier versions of this API kept both a `name` and a `site` column. Keep one (`site`)."""
        columns = {row["name"] for row in self._db.execute("PRAGMA table_info(scans)")}
        if "name" not in columns:
            return
        self._db.execute("UPDATE scans SET site = name WHERE site = ''")
        try:
            self._db.execute("ALTER TABLE scans DROP COLUMN name")
        except sqlite3.OperationalError as exc:  # SQLite older than 3.35
            raise RuntimeError(
                "The scans database uses an old layout and this SQLite cannot upgrade it. "
                "Delete the database file (DB_PATH) to start fresh."
            ) from exc

    def save(self, scan: ScanIn) -> dict:
        record = {
            "id": scan.id or str(uuid.uuid4()),
            "site": (scan.site or "").strip(),
            "started_at": scan.started_at,
            "finished_at": scan.finished_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "doors": [door.model_dump() for door in scan.doors],
        }
        with self._lock:  # saving the same id again replaces the earlier save (a retry does not duplicate)
            self._db.execute(
                "INSERT OR REPLACE INTO scans (id, site, started_at, finished_at, created_at, doors) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    record["id"], record["site"], record["started_at"], record["finished_at"],
                    record["created_at"], json.dumps(record["doors"]),
                ),
            )
            self._db.commit()
        return record

    def list(self) -> list[dict]:
        with self._lock:
            rows = self._db.execute("SELECT * FROM scans ORDER BY created_at DESC").fetchall()
        return [self._to_dict(row) for row in rows]

    def get(self, scan_id: str) -> Optional[dict]:
        with self._lock:
            row = self._db.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
        return self._to_dict(row) if row else None

    def delete(self, scan_id: str) -> bool:
        with self._lock:
            cur = self._db.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
            self._db.commit()
        return cur.rowcount > 0

    @staticmethod
    def _to_dict(row: sqlite3.Row) -> dict:
        data = dict(row)
        data["doors"] = json.loads(data["doors"])
        return data
