"""CSV emission — one row per flagged finding, for risk-scoring spreadsheets."""

from __future__ import annotations

import csv
from pathlib import Path

from bcal.schema import (
    RegulatoryStatus,
    StatisticalEvidencePackage,
    SubgroupStatus,
)

_HEADERS: tuple[str, ...] = (
    "finding_id",
    "module",
    "severity",
    "subject",
    "detail",
    "reference",
)


def _severity_from_subgroup(status: str | SubgroupStatus) -> str:
    status = SubgroupStatus(status).value if not isinstance(status, str) else status
    return {"paradox": "high", "warning": "medium", "consistent": "info"}.get(
        status, "info"
    )


def _severity_from_checklist(status: str | RegulatoryStatus) -> str:
    status = (
        RegulatoryStatus(status).value if not isinstance(status, str) else status
    )
    return {"missing": "high", "warning": "medium", "ok": "info"}.get(status, "info")


def write_csv(sep: StatisticalEvidencePackage, path: str | Path) -> Path:
    """Write a flat findings table. One row per: exclusion, subgroup, checklist, outlier."""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    # newline="" per csv docs; UTF-8 sig for Excel friendliness.
    with out.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.writer(fh, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(_HEADERS)

        for i, e in enumerate(sep.decision_log):
            writer.writerow(
                [
                    f"EXCL-{i+1:04d}",
                    "M2_exclusions",
                    "medium",
                    e.sample_id,
                    f"{e.reason} — {e.justification}",
                    "21 CFR 11.50",
                ]
            )
        for i, s in enumerate(sep.subgroup_findings):
            writer.writerow(
                [
                    f"SUBG-{i+1:04d}",
                    "M1_subgroup",
                    _severity_from_subgroup(s.status),
                    s.subgroup_id,
                    f"trait={s.trait} baseline={s.baseline} effect={s.effect} status={s.status}",
                    "ICH E9R1",
                ]
            )
        for i, o in enumerate(sep.outlier_ledger):
            writer.writerow(
                [
                    f"OUTL-{i+1:04d}",
                    "M5_outliers",
                    "medium" if o.classification == "unclassified" else "low",
                    o.sample_id,
                    f"class={o.classification} z={o.z_score} evidence={o.evidence}",
                    "CAP/CLIA",
                ]
            )
        for i, c in enumerate(sep.regulatory_checklist):
            writer.writerow(
                [
                    f"CHKL-{i+1:04d}",
                    "M0_checklist",
                    _severity_from_checklist(c.status),
                    c.item,
                    c.status,
                    c.reference or "",
                ]
            )
    return out
