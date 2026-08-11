#!/usr/bin/env python3
"""สร้าง CSV ที่อัปเดตจาก OCR และชุดข้อมูลนิรนาม pilot-vault"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_TRANSCRIPTS = ROOT / "pilot-vault" / "raw" / "ART-ROST-PHOTO-SET"
VAULT = ROOT / "pilot-vault" / "anonymized"

# ข้อมูล OCR มี.ค. 2569 — แถว 2–23 (แถว 1 มีอยู่แล้ว)
MARCH_ROWS: dict[int, list[str]] = {
    2: "INC,HE20,N1,N2,off,off,CH,7BB18,CH,MI20,N1,N2,off,CH,off,MI20,N1,N2,off,7BB,off,7CH,MI20,INC18,off,BB,CH,7BB,Bac,N1,off".split(","),
    3: "Bae18,Bae,BB,off,off,Bae,Bae,Bae,Bae,BB,off,INC,Bae18,Bae,Bae,BB,off,Bae,INC,MI,Bae18,Bae,off,off,Bae18,IM,BB,off,off,INC,CH".split(","),
    4: "N1,N2,off,BB,Bae,CH,MI20,N1,N2,off,7BB,INC,CH18,HE,off,HE,7INC,MI20,N1,N2,off,IM18,7CH,Bae20,N1,N2,off,7BB,MI18,off,off,off".split(","),
    5: "off,MI18,7Bae,Bae20,N1,N2,off,off,off,Bae,Bae18,Bae20,N1,N2,off,7Bae,Bae,off,Bae,Bae20,N1,N2,off,Bae,INC,7Bae,Bae18,Bae,N2,off,Bac".split(","),
    6: "MI20,N1,N2,off,CH,off,off,off,7BB,CH18,MI20,N1,N2,off,7BB,CH,MI20,N1,N2,off,7BB,INC,Bac18,off,CH,INC,off,HE20,INC,7BB,MI20".split(","),
    7: "N2,off,INC,MI18,INC,7BB,MI18,INC,MI20,N1,N2,off,7BB,MI20,N1,N2,off,off,off,off,off,off,BB,off,7BB,MI20,N1,N2,off,MI18,INC".split(","),
    8: "off,CH,off,off,7BB,INC,7BB,HE20,N1,N2,off,CH,HE,INC,CH18,off,IM18,MI20,N1,N2,off,BB18,CH,N1,N2,off,7INC,CH,MI20,N2,off".split(","),
    9: "7BB,INC,off,MI,MI20,N1,N2,off,BB18,MI,N2,off,INC,off,off,off,CH,7BB,off,HE18,INC,CH,MI20,N1,N2,off,?,?,?,?,?".split(","),
    10: "off,off,CH,7HE,IM18,MI20,N1,N2,off,7INC,CH,off,INC,HE18,INC20,N1,N2,off,7BB,INC,CH,MI20,N1,N2,off,off,off,MI,N1,off,7BB".split(","),
    11: "CH,7BB,MI20,N1,N2,off,INC,CH,HE18,off,INC,7BB,MI20,N1,N2,off,CH,7BB,off,CH,INC20,N1,N2,off,off,CH18,MI20,N1,off,off,IM18".split(","),
    12: "HE,off,INC18,INC,BB,BB/18,MI20,N1,off,IM,CH,N1,N2,off,MI,INC18,N1,off,off,MI20,N1,N2,off,off,CH,7BB,CH,INC,HE,N2,off".split(","),
    13: "off,CH18,CH18,CH18,CH18,CH18,off,off,BB18,BB18,BB18,BB18,BB18,off,off,MI18,MI18,MI18,MI18,MI18,off,off,INC18,INC18,INC18,INC18,INC18,off,off,HE18,HE18".split(","),
    14: "off,Set,Set,Set,Set,Set,off,off,HE18,HE18,HE18,HE18,HE18,off,off,CH18,CH18,CH18,CH18,CH18,off,off,MI18,MI18,MI18,MI18,MI18,off,off,BB18,BB18".split(","),
    15: [""] * 31,
    16: "?,?,?,?,?,?,?,?,?,?,MI,?,?,?,?,?,?,?,HE,?,?,?,?,?,?,?,?,?,MI,?,?".split(","),
    17: "?,?,?,?,?,?,HE,HE,?,?,HE,HE,HE,?,?,?,?,HE,HE,HE,?,?,?,HE,HE,HE,?,?,?,?,HE,HE,?".split(","),
    18: "off,F/16,F/16,F/16,F/16,8/16,off,off,B/16,es/19,off,F/16,F/16,F/16,F/16,F/16,off,F/16,F/16,F/16,F/16,off,F/16,8/16,off,off,F/16,F/16,F/16,F/16,off".split(","),
    19: "B/17,es/19,บด,off,es/19,B/17,es/19,บด,off,F/16,es/19,บด,off,B/17,บด,off,B/17,off,off,off,off,B/17,es/19,บด,off,F/16,es/19,บด,off,B/17,F/16".split(","),
    20: "es/19,บด,off,off,off,บด,off,B/17,es/19,F/16,B/17,บด,off,B/17,es/19,บด,off,off,off,off,B/17,es/19,บด,off,B/17,B/17,es/19,บด,off,off,F/16".split(","),
    21: "บด,off,B/17,B/17,off,บด,off,B/17,F/16,es/19,บด,off,es/19,F/16,B/17,es/19,บด,off,off,es/19,บด,off,B/17,off,B/17,F/16,es/19,บด,off,es/19,บด".split(","),
    22: "es/19,B/17,es/19,บด,off,F/16,B/17,F/16,es/19,บด,off,B/17,B/17,off,off,off,บด,off,B/17,es/19,บด,off,off,F/16,es/19,บด,off,B/17,B/17,es/19,บด".split(","),
    23: "off,cs/19,บด,off,F/16,บด,off,B/17,B/17,cs/19,บด,off,off,B/17,cs/19,บด,off,B/17,F/16,B/17,cs/19,บด,off,off,F/16,B/17,cs/19,บด,off,off,B/17".split(","),
}

MAY_ROW2_TAIL = "CH,7BB,INC,N1,off,7CH,MI20,N1,off,INC,HE,7BB,MI20,N2,off,Bac,Bac20,N1,off,CH,BB,N2,off,HE,INC,7IM".split(",")

AUG_ROWS: dict[int, list[str]] = {
    22: "Set/17,es/19,บด,off,บด,off,off,off,บด,off,es/19,บด,off,CT/17,CT/17,es/19,บด,off,es/19,บด,off,CT/17,es/19,es/19,บด,off,es/19,บด,off,off,off".split(","),
    23: "cs/19,Set/17,Set/17,cs/19,off,บด,off,cs/19,บด,off,CT/17,บด,off,cs/19,Set/17,บด,off,บด,off,บด,off,cs/19,cs/19,บด,off,CT/17,off,บด,off,cs/19,บด".split(","),
    24: "บด,off,es/19,บด,off,CT/17,es/19,บด,off,CT/17,es/19,บด,off,CT/17,es/19,บด,off,es/19,Set/17,off,Set/17,es/19,บด,off,Set/17,CT/17,off,บด".split(",") + ["?", "?", "?"],
    25: "off,B/17,F/16,บด,off,off,B/17,F/16,off,บด,off,B/17,es/19,บด,off,off,F/16,B/17,es/19,บด,off,B/17,es/19,บด,off,off,es/19,บด,off,B/17,บด,off,B/17,es/19".split(",")[:31],
}

MONTH_META: dict[str, tuple[int, int, int, str]] = {
    "S__21069857_0.csv": (2026, 1, 31, "S__21069857_0.jpg"),
    "S__21069858_0.csv": (2026, 2, 28, "S__21069858_0.jpg"),
    "S__21069856_0.csv": (2026, 3, 31, "S__21069856_0.jpg"),
    "S__21069852_0.csv": (2026, 4, 30, "S__21069852_0.jpg"),
    "S__21069855_0.csv": (2026, 4, 30, "S__21069855_0.jpg"),
    "S__21069853_0.csv": (2026, 5, 31, "S__21069853_0.jpg"),
    "S__21069854_0.csv": (2026, 6, 30, "S__21069854_0.jpg"),
    "S__21069860.csv": (2023, 8, 31, "S__21069860.jpg"),
}

WEEKDAYS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"]

CANONICAL_AREA: dict[str, str] = {
    "bac": "Bac", "bae": "Bac", "bb": "BB", "ch": "CH", "he": "HE",
    "inc": "INC", "mi": "MI", "im": "IM", "n1": "N1", "n2": "N2",
    "set": "Set", "ct": "CT", "f": "F", "b": "B", "cs": "cs", "es": "es",
}

GRADE_MAP = {"หัวหน้า": "HEAD", "MT": "MT", "PT": "PT", "ผู้ช่วย": "ASSISTANT", "พิเศษ": "SPECIAL"}


def parse_shift(raw: str) -> tuple[str, str, str, str, str, str]:
    """แปลงรหัสดิบ → canonical_area, start, end, crosses_midnight, status, confidence"""
    cell = raw.strip()
    if not cell or cell in ("?", ""):
        return "", "", "", "false", "UNKNOWN", "LOW"
    if cell == "[แดง]":
        return "", "", "", "false", "UNKNOWN", "MED"
    lower = cell.lower()
    if lower in ("off", "ช", "ซ"):
        return "", "", "", "false", "OFF" if lower == "off" else "ASSIGNED", "HIGH"
    if lower in ("sick", "vac"):
        return "", "", "", "false", "LEAVE", "HIGH"

    area = ""
    start = ""
    end = ""
    for key, val in CANONICAL_AREA.items():
        if key in lower.replace("/", ""):
            area = val
            break
    m = re.search(r"(\d{2})$", cell)
    if m:
        end = f"{m.group(1)}:00"
    m7 = re.search(r"^7", cell)
    if m7:
        start = "07:00"
    if "บด" in cell:
        area = area or "บด"
        start = start or "16:00"
        return area, start, "08:00", "true", "ASSIGNED", "HIGH"
    if "/" in cell and re.match(r"^[BF8]", cell):
        parts = cell.split("/")
        if len(parts) == 2 and parts[1].isdigit():
            start = f"{parts[1][:2]}:00" if len(parts[1]) >= 2 else ""
            area = area or parts[0]
    return area, start, end, "false", "ASSIGNED", "HIGH" if "?" not in cell else "LOW"


def load_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        return reader.fieldnames or [], rows


def save_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def patch_month_csv(filename: str, patches: dict[int, list[str]]) -> None:
    path = RAW_TRANSCRIPTS / filename
    fieldnames, rows = load_csv(path)
    day_cols = [c for c in fieldnames if c.startswith("d") and c[1:].isdigit()]
    for seq, days in patches.items():
        row = rows[seq - 1]
        for i, col in enumerate(day_cols):
            if i < len(days):
                row[col] = days[i]
    save_csv(path, fieldnames, rows)


def patch_may_row2() -> None:
    path = RAW_TRANSCRIPTS / "S__21069853_0.csv"
    fieldnames, rows = load_csv(path)
    day_cols = [c for c in fieldnames if c.startswith("d") and c[1:].isdigit()]
    row = rows[1]
    for i, val in enumerate(MAY_ROW2_TAIL, start=18):
        if i - 1 < len(day_cols):
            row[day_cols[i - 1]] = val
    save_csv(path, fieldnames, rows)


def weekday_th(d: date) -> str:
    return WEEKDAYS_TH[d.weekday()]


def build_anonymized() -> None:
    VAULT.mkdir(parents=True, exist_ok=True)
    id_months: dict[str, set[str]] = defaultdict(set)
    id_names: dict[str, list[str]] = defaultdict(list)
    id_grades: dict[str, str] = {}
    roster_rows: list[dict[str, str]] = []

    for csv_name, (year, month, days, source) in MONTH_META.items():
        path = RAW_TRANSCRIPTS / csv_name
        if not path.exists():
            continue
        _, rows = load_csv(path)
        month_key = f"{year}-{month:02d}"
        day_cols = [f"d{i}" for i in range(1, days + 1)]
        for row in rows:
            eid = (row.get("employee_id") or "").strip()
            name = (row.get("name") or "").strip()
            group = row.get("group", "")
            if eid:
                id_months[eid].add(month_key)
                if name:
                    id_names[eid].append(name)
                id_grades[eid] = GRADE_MAP.get(group, group)

    stable_ids = sorted(
        [eid for eid, months in id_months.items() if len(months) >= 3],
        key=lambda x: int(x) if x.isdigit() else x,
    )
    code_map = {eid: f"STAFF-{i:03d}" for i, eid in enumerate(stable_ids, 1)}

    staff_master: list[dict[str, str]] = []
    for eid in stable_ids:
        months_sorted = sorted(id_months[eid])
        names = id_names[eid]
        majority_name = Counter(names).most_common(1)[0][0] if names else ""
        staff_master.append({
            "staff_code": code_map[eid],
            "grade": id_grades.get(eid, ""),
            "first_seen_month": months_sorted[0],
            "last_seen_month": months_sorted[-1],
            "months_present": str(len(months_sorted)),
            "_majority_name_off_repo": majority_name,
        })

    for csv_name, (year, month, days, source) in MONTH_META.items():
        path = RAW_TRANSCRIPTS / csv_name
        if not path.exists():
            continue
        _, rows = load_csv(path)
        day_cols = [f"d{i}" for i in range(1, days + 1)]
        for row in rows:
            eid = (row.get("employee_id") or "").strip()
            if not eid or eid not in code_map:
                continue
            staff_code = code_map[eid]
            for i, col in enumerate(day_cols, start=1):
                raw = (row.get(col) or "").strip()
                local = date(year, month, i)
                area, start, end, cross, status, conf = parse_shift(raw)
                if not raw:
                    status = "NO_SHIFT"
                    conf = "HIGH"
                roster_rows.append({
                    "staff_code": staff_code,
                    "local_date": local.isoformat(),
                    "weekday": weekday_th(local),
                    "raw_code": raw,
                    "canonical_area": area,
                    "start_hint": start,
                    "end_hint": end,
                    "crosses_midnight": cross,
                    "status": status,
                    "confidence": conf,
                    "source_file": source,
                })

    id_map = [
        {"staff_code": code_map[eid], "employee_id": eid}
        for eid in stable_ids
    ]

    save_csv(VAULT / "staff_master.csv", ["staff_code", "grade", "first_seen_month", "last_seen_month", "months_present"], [
        {k: v for k, v in r.items() if not k.startswith("_")} for r in staff_master
    ])
    save_csv(VAULT / "id_map.csv", ["staff_code", "employee_id"], id_map)
    save_csv(
        VAULT / "roster_long.csv",
        ["staff_code", "local_date", "weekday", "raw_code", "canonical_area", "start_hint", "end_hint", "crosses_midnight", "status", "confidence", "source_file"],
        roster_rows,
    )

    manifest_path = ROOT / "pilot-vault" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    vault_artifacts = [
        {
            "id": "ART-ROST-PHOTO-SET",
            "description": "ชุดภาพตารางเวร 8 เดือน + transcript (pilot-vault/raw/)",
            "rawPath": "raw/ART-ROST-PHOTO-SET/",
            "anonymizedPath": "anonymized/roster_long.csv",
            "status": "anonymized",
            "receivedAt": "2026-08-10",
            "anonymizedAt": "2026-08-10",
            "handedBy": "DISCOVERY-OCR",
            "sha256": None,
            "notes": "staff_master.csv, roster_long.csv, id_map.csv; temp/ ปิดแล้ว",
        },
        {
            "id": "ART-OT-01",
            "description": "แผ่น OT รายบุคคล พ.ค. 2569",
            "rawPath": "raw/ART-ROST-PHOTO-SET/3942F9C6-22F2-4394-833F-8FD6DE2421D8.jpg",
            "anonymizedPath": None,
            "status": "received",
            "receivedAt": "2026-08-10",
            "anonymizedAt": None,
            "handedBy": "DISCOVERY-OCR",
            "sha256": None,
            "notes": "ยังไม่ anonymize รายบุคคล",
        },
    ]
    by_id = {item["id"]: item for item in manifest.get("artifacts", [])}
    for item in vault_artifacts:
        by_id[item["id"]] = item
    manifest["artifacts"] = list(by_id.values())
    manifest["updatedAt"] = "2026-08-10"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"anonymized: {len(stable_ids)} staff, {len(roster_rows)} roster cells")


def main() -> None:
    patch_month_csv("S__21069856_0.csv", MARCH_ROWS)
    patch_may_row2()
    patch_month_csv("S__21069860.csv", AUG_ROWS)
    build_anonymized()
    print("done")


if __name__ == "__main__":
    main()
