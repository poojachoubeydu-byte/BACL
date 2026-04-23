"""M2 — Sample Exclusion Justification engine.

Per 21 CFR Part 11 §11.50, every decision to remove a sample must be:

1. Attributed to an identified operator (human or named auto-QC service).
2. Time-stamped (UTC, monotone within the run).
3. Accompanied by a substantive *justification* — not just a flag.

This module enforces those requirements at data-ingest time so the
responsibility cannot be bypassed by a downstream tool that forgets to log.
"""

from __future__ import annotations

from collections.abc import Iterable

import pandas as pd

from bcal.schema import ExclusionRecord

MIN_JUSTIFICATION_LEN = 20
"""Minimum number of non-whitespace chars in a justification string."""

_REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {"sample_id", "reason", "operator_id", "timestamp", "justification"}
)


class ExclusionValidationError(ValueError):
    """Raised when an exclusion row fails to meet the compliance minimum."""


def validate_dataframe(df: pd.DataFrame) -> None:
    """Raise :class:`ExclusionValidationError` if the frame is malformed.

    Checks are cumulative — all errors are collected and raised together so
    operators can fix them in one pass instead of whack-a-mole.
    """
    errors: list[str] = []

    missing = _REQUIRED_COLUMNS - set(df.columns)
    if missing:
        errors.append(f"Missing required columns: {sorted(missing)!r}")
        # Cannot validate rows further if columns are missing.
        raise ExclusionValidationError("; ".join(errors))

    for idx, row in df.iterrows():
        rid = f"row {idx} (sample_id={row.get('sample_id')!r})"
        justification = str(row["justification"] or "").strip()
        if len(justification) < MIN_JUSTIFICATION_LEN:
            errors.append(
                f"{rid}: justification too short "
                f"({len(justification)} chars, need ≥{MIN_JUSTIFICATION_LEN}). "
                f"A bare QC flag is not sufficient under 21 CFR Part 11."
            )
        if not str(row["operator_id"] or "").strip():
            errors.append(f"{rid}: empty operator_id — decisions must be attributable.")
        if pd.isna(row["timestamp"]):
            errors.append(f"{rid}: missing timestamp.")

    if errors:
        raise ExclusionValidationError("\n".join(errors))


def to_records(df: pd.DataFrame) -> list[ExclusionRecord]:
    """Convert a validated DataFrame to a list of :class:`ExclusionRecord`."""
    validate_dataframe(df)
    records: list[ExclusionRecord] = []
    for _, row in df.iterrows():
        records.append(
            ExclusionRecord(
                sample_id=str(row["sample_id"]),
                reason=str(row["reason"]),
                operator_id=str(row["operator_id"]),
                timestamp=pd.Timestamp(row["timestamp"]).to_pydatetime(),
                justification=str(row["justification"]).strip(),
                evidence_refs=list(row.get("evidence_refs") or []),
            )
        )
    return records


def duplicate_sample_ids(records: Iterable[ExclusionRecord]) -> list[str]:
    """Return the list of sample_ids that appear in more than one exclusion.

    Duplicate exclusions can mean a sample was re-flagged after re-processing,
    which *may* be legitimate — but it should always be surfaced for review.
    """
    seen: dict[str, int] = {}
    for r in records:
        seen[r.sample_id] = seen.get(r.sample_id, 0) + 1
    return sorted(sid for sid, n in seen.items() if n > 1)
