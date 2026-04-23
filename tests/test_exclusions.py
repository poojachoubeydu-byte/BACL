"""M2 — Exclusion validation."""

from __future__ import annotations

from datetime import UTC, datetime

import pandas as pd
import pytest

from bcal.modules import exclusions


def _base_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "sample_id": "S-1",
                "reason": "low depth",
                "operator_id": "qc",
                "timestamp": datetime(2026, 1, 1, tzinfo=UTC),
                "justification": "insufficient coverage for reliable estimation",
            }
        ]
    )


def test_accepts_valid_frame() -> None:
    exclusions.validate_dataframe(_base_df())


def test_rejects_short_justification() -> None:
    df = _base_df()
    df.at[0, "justification"] = "bad"
    with pytest.raises(exclusions.ExclusionValidationError) as ei:
        exclusions.validate_dataframe(df)
    assert "justification too short" in str(ei.value)


def test_rejects_missing_operator() -> None:
    df = _base_df()
    df.at[0, "operator_id"] = ""
    with pytest.raises(exclusions.ExclusionValidationError):
        exclusions.validate_dataframe(df)


def test_rejects_missing_columns() -> None:
    with pytest.raises(exclusions.ExclusionValidationError):
        exclusions.validate_dataframe(pd.DataFrame({"sample_id": ["x"]}))


def test_to_records_roundtrip() -> None:
    recs = exclusions.to_records(_base_df())
    assert len(recs) == 1
    assert recs[0].sample_id == "S-1"


def test_duplicate_detection() -> None:
    df = pd.concat([_base_df(), _base_df()], ignore_index=True)
    df.at[1, "sample_id"] = "S-1"
    recs = exclusions.to_records(df)
    assert exclusions.duplicate_sample_ids(recs) == ["S-1"]
