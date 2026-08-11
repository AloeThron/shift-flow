#!/usr/bin/env python3
"""ส่งออก pilot-vault/anonymized → demo/validation-dataset + golden fixtures"""

from __future__ import annotations

import csv
import json
import shutil
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from build_roster_artifacts import parse_shift

ROOT = Path(__file__).resolve().parents[1]
VAULT = ROOT / "pilot-vault" / "anonymized"
OUT = ROOT / "demo" / "validation-dataset"
GOLDEN = OUT / "golden"

ROSTER_FIELDS = [
    "staff_code",
    "local_date",
    "weekday",
    "raw_code",
    "canonical_area",
    "start_hint",
    "end_hint",
    "crosses_midnight",
    "status",
    "confidence",
    "source_file",
]

STAFF_FIELDS = [
    "staff_code",
    "grade",
    "first_seen_month",
    "last_seen_month",
    "months_present",
]


def load_roster() -> list[dict[str, str]]:
    """โหลด roster_long จาก vault"""
    path = VAULT / "roster_long.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"ไม่พบ {path} — รัน python scripts/build_roster_artifacts.py ก่อน"
        )
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def load_staff() -> list[dict[str, str]]:
    """โหลด staff_master จาก vault (ตัดฟิลด์ off-repo)"""
    path = VAULT / "staff_master.csv"
    if not path.exists():
        raise FileNotFoundError(f"ไม่พบ {path}")
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return [{key: row.get(key, "") for key in STAFF_FIELDS} for row in rows]


def save_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    """เขียน CSV ออกไฟล์"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_parse_shift_golden(rows: list[dict[str, str]]) -> dict[str, object]:
    """สร้าง golden parse_shift ต่อ unique raw_code"""
    tokens: dict[str, object] = {}
    for row in rows:
        raw = row["raw_code"]
        if raw in tokens:
            continue
        area, start, end, cross, status, conf = parse_shift(raw)
        if not raw:
            status = "NO_SHIFT"
            conf = "HIGH"
        tokens[raw] = {
            "raw_code": raw,
            "canonical_area": area,
            "start_hint": start,
            "end_hint": end,
            "crosses_midnight": cross == "true",
            "status": status,
            "confidence": conf,
        }
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "scripts/build_roster_artifacts.py::parse_shift",
        "token_count": len(tokens),
        "tokens": dict(sorted(tokens.items(), key=lambda item: item[0])),
    }


def build_status_summary(rows: list[dict[str, str]]) -> dict[str, object]:
    """สรุปสถานะและแหล่งที่มาสำหรับ regression"""
    by_status = Counter(row["status"] for row in rows)
    by_source = Counter(row["source_file"] for row in rows)
    by_confidence = Counter(row["confidence"] for row in rows)
    unknown_by_source = Counter(
        row["source_file"] for row in rows if row["status"] == "UNKNOWN"
    )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_cells": len(rows),
        "unique_staff": len({row["staff_code"] for row in rows}),
        "by_status": dict(sorted(by_status.items())),
        "by_source_file": dict(sorted(by_source.items())),
        "by_confidence": dict(sorted(by_confidence.items())),
        "unknown_by_source_file": dict(sorted(unknown_by_source.items())),
    }


def select_edge_cases(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """เลือกเซลล์ edge case ครอบคลุมทุก status และ token พิเศษ"""
    picked: list[dict[str, str]] = []
    seen_keys: set[tuple[str, str, str]] = set()

    def add(row: dict[str, str]) -> None:
        key = (row["staff_code"], row["local_date"], row["raw_code"])
        if key in seen_keys:
            return
        seen_keys.add(key)
        picked.append({field: row[field] for field in ROSTER_FIELDS})

    # อย่างน้อยหนึ่งแถวต่อ status
    for status in ("ASSIGNED", "OFF", "UNKNOWN", "NO_SHIFT", "LEAVE"):
        for row in rows:
            if row["status"] == status:
                add(row)
                break

    # token พิเศษจาก taxonomy
    special_tokens = {
        "?",
        "[แดง]",
        "off",
        "ช",
        "sick",
        "vac",
        "บด",
        "7BB",
        "7HE",
        "MI20",
        "N1",
        "N2",
        "Set",
        "F/16",
        "B/17",
        "BB/18",
    }
    for token in special_tokens:
        for row in rows:
            if row["raw_code"] == token:
                add(row)
                break

    # ครอบคลุมทุก source_file
    by_source: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_source[row["source_file"]].append(row)
    for source_rows in by_source.values():
        for row in source_rows[:2]:
            add(row)

    # เพิ่ม UNKNOWN ที่เหลือจนครบ 30 แถว (ถ้ามี)
    for row in rows:
        if row["status"] != "UNKNOWN":
            continue
        add(row)
        if sum(1 for item in picked if item["status"] == "UNKNOWN") >= 30:
            break

    return picked


def write_manifest(summary: dict[str, object]) -> None:
    """เขียน manifest.yaml แบบง่าย (YAML subset)"""
    lines = [
        "# Validation dataset — นิรนามจาก pilot-vault (commit ได้)",
        f"version: 1",
        f"generated_at: \"{summary['generated_at']}\"",
        "provenance:",
        "  source_vault: pilot-vault/anonymized/",
        "  export_script: scripts/export_validation_fixtures.py",
        "  ocr_pipeline: scripts/build_roster_artifacts.py",
        "  raw_archive: pilot-vault/raw/ART-ROST-PHOTO-SET/",
        "disclaimer: ANONYMIZED_PILOT_DATA — ใช้ regression/validation เท่านั้น ไม่ map กับ starter packs",
        "counts:",
    ]
    for key, value in summary["by_status"].items():
        lines.append(f"  {key}: {value}")
    lines.extend(
        [
            "files:",
            "  - staff_master.csv",
            "  - roster_long.csv",
            "  - edge_cases/roster_cells.csv",
            "  - golden/status_summary.json",
            "  - golden/parse_shift_tokens.json",
            "  - golden/fairness_metrics.json",
        ]
    )
    (OUT / "manifest.yaml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    roster_rows = load_roster()
    staff_rows = load_staff()
    summary = build_status_summary(roster_rows)
    parse_golden = build_parse_shift_golden(roster_rows)
    edge_cases = select_edge_cases(roster_rows)

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    GOLDEN.mkdir(parents=True)
    (OUT / "edge_cases").mkdir()

    save_csv(OUT / "staff_master.csv", STAFF_FIELDS, staff_rows)
    save_csv(OUT / "roster_long.csv", ROSTER_FIELDS, roster_rows)
    save_csv(OUT / "edge_cases" / "roster_cells.csv", ROSTER_FIELDS, edge_cases)

    (GOLDEN / "status_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (GOLDEN / "parse_shift_tokens.json").write_text(
        json.dumps(parse_golden, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    write_manifest(summary)
    print(
        f"exported: {len(staff_rows)} staff, {len(roster_rows)} cells, "
        f"{len(edge_cases)} edge cases, {parse_golden['token_count']} tokens"
    )


if __name__ == "__main__":
    main()
