"""Check the research corpus without fetching or storing any source document."""

from __future__ import annotations

import csv
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[3]
DATASET = ROOT / "docs/research/golden-dataset.csv"
MANIFEST = ROOT / "test/fixtures/institutions/candidate-manifest.csv"
EXPECTED_HOSTS = {
    "UFPB": {"www.prg.ufpb.br", "drive.ufpb.br"},
    "UFCG": {"comprov.ufcg.edu.br"},
    "UEPB": {"uepb.edu.br"},
    "IFPB": {"estudante.ifpb.edu.br"},
}
SCOPES = {"IN_SCOPE", "OUT_OF_SCOPE", "PENDING_REVIEW"}
TRI = {"TRUE", "FALSE", "UNKNOWN"}


def main() -> int:
    with DATASET.open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    with MANIFEST.open(encoding="utf-8", newline="") as stream:
        candidates = list(csv.DictReader(stream))
    problems: list[str] = []
    ids = {row["id"] for row in rows}
    counts = Counter(row["institution"] for row in rows)
    if not 30 <= len(rows) <= 50:
        problems.append(f"expected 30–50 documents, got {len(rows)}")
    if len(ids) != len(rows):
        problems.append("duplicate document id")
    if len({row["official_url"] for row in rows}) != len(rows):
        problems.append("duplicate official document URL")
    if set(counts) != set(EXPECTED_HOSTS):
        problems.append(f"institutions incomplete: {dict(counts)}")
    manifest_by_id = {row["id"]: row for row in candidates}
    if len(manifest_by_id) != len(candidates):
        problems.append("duplicate candidate id")
    if not ids <= set(manifest_by_id):
        problems.append("golden corpus contains documents absent from candidate manifest")
    for candidate in candidates:
        expected = "PROMOTED_TO_GOLDEN" if candidate["id"] in ids else "CANDIDATE_ONLY"
        if candidate["review_state"] != expected:
            problems.append(f"{candidate['id']}: inconsistent candidate review state")

    for row in rows:
        name = row["id"]
        url = urlparse(row["official_url"])
        if url.scheme != "https" or url.hostname not in EXPECTED_HOSTS.get(row["institution"], set()):
            problems.append(f"{name}: URL is not on an allowed official host")
        if row["scope_decision"] not in SCOPES:
            problems.append(f"{name}: invalid scope")
        for key in ("regular_sisu_flow", "requires_enem"):
            if row[key] not in TRI:
                problems.append(f"{name}: invalid {key}")
        for key in ("application_start", "application_end"):
            if row[key] != "UNKNOWN":
                try:
                    date.fromisoformat(row[key])
                except ValueError:
                    problems.append(f"{name}: invalid {key}")
        for key in ("application_start_time", "application_end_time"):
            if row[key] != "UNKNOWN":
                try:
                    datetime.strptime(row[key], "%H:%M")
                except ValueError:
                    problems.append(f"{name}: invalid {key}")
        if not row["field_evidence"] or not row["reviewed_at"]:
            problems.append(f"{name}: missing evidence or review date")
        try:
            date.fromisoformat(row["reviewed_at"])
        except ValueError:
            problems.append(f"{name}: invalid review date")
        if row["related_id"] not in ids | {"UNKNOWN"}:
            problems.append(f"{name}: related document is not in the corpus")
        if row["application_start"] != "UNKNOWN" and row["application_end"] != "UNKNOWN":
            if row["application_start"] > row["application_end"]:
                problems.append(f"{name}: application period is reversed")
        if row["application_end"] != "UNKNOWN" and row["reviewed_at"] != "UNKNOWN":
            if row["application_end"] > row["reviewed_at"]:
                problems.append(f"{name}: not historical on the review date")
        if row["scope_decision"] == "PENDING_REVIEW" and "ADR 0003" not in row["field_evidence"]:
            problems.append(f"{name}: pending scope lacks ADR evidence")

    cases = {
        "ENEM required": any(row["requires_enem"] == "TRUE" and row["scope_decision"] == "IN_SCOPE" for row in rows),
        "ENEM not required": any(row["requires_enem"] == "FALSE" and row["scope_decision"] == "IN_SCOPE" for row in rows),
        "ambiguous deadline": any(row["application_end"] != "UNKNOWN" and row["application_end_time"] == "UNKNOWN" for row in rows),
        "duplicate artifacts": any(row["related_id"] in ids for row in rows),
        "out of scope": any(row["scope_decision"] == "OUT_OF_SCOPE" for row in rows),
        "revision": any(row["artifact_kind"] == "PDF_REVISION" and row["related_id"] in ids for row in rows),
    }
    problems.extend(f"missing case: {case}" for case, present in cases.items() if not present)
    by_id = {row["id"]: row for row in rows}
    expected_examples = {
        "UFPB-05": {"scope_decision": "OUT_OF_SCOPE", "regular_sisu_flow": "TRUE"},
        "UFPB-09": {"requires_enem": "FALSE"},
        "UFPB-13": {"requires_enem": "TRUE"},
        "UFCG-03": {"application_end_time": "UNKNOWN"},
        "UFCG-02": {"scope_decision": "PENDING_REVIEW"},
        "UEPB-01": {"scope_decision": "PENDING_REVIEW"},
        "UEPB-04": {"scope_decision": "PENDING_REVIEW"},
        "IFPB-15": {"application_end": "2026-07-27", "related_id": "IFPB-16"},
        "IFPB-16": {"application_end": "2026-07-20", "related_id": "IFPB-15"},
    }
    for name, expected in expected_examples.items():
        if name not in by_id:
            problems.append(f"missing example: {name}")
        else:
            for key, value in expected.items():
                if by_id[name][key] != value:
                    problems.append(f"{name}: expected {key}={value}")

    print(f"documents={len(rows)} institutions={dict(counts)}")
    print("cases=" + ", ".join(f"{case}:{'PASS' if present else 'FAIL'}" for case, present in cases.items()))
    print(f"partial_reviews={sum(row['review_state'].startswith('PARTIAL') for row in rows)}")
    for problem in problems:
        print("FAIL: " + problem)
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
