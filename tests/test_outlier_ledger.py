"""M5 — Outlier ledger."""

from __future__ import annotations

import numpy as np
import pandas as pd

from bcal.modules import outlier_ledger
from bcal.schema import OutlierClass


def test_modified_z_zero_on_constant() -> None:
    values = np.ones(10)
    assert np.allclose(outlier_ledger.modified_z_scores(values), 0)


def test_modified_z_flags_extreme() -> None:
    # Include variation so MAD > 0 — otherwise the function falls back to
    # mean/SD, which itself gets dragged toward the outlier.
    values = np.array([1.0, 1.05, 0.95, 1.1, 0.9, 1.02, 0.98, 1.08, 10.0])
    z = outlier_ledger.modified_z_scores(values)
    assert abs(z[-1]) > 3


def test_screen_returns_sorted() -> None:
    metric = pd.Series(
        [100_000, 10_000_000, 10_100_000, 10_050_000, 9_900_000],
        index=[f"S-{i}" for i in range(5)],
    )
    flagged = outlier_ledger.screen(metric, threshold=2.0)
    assert not flagged.empty
    # Most extreme should appear first (by |z|).
    assert flagged.iloc[0]["sample_id"] == "S-0"


def test_classify_defaults_unclassified_without_evidence() -> None:
    flagged = pd.DataFrame({"sample_id": ["S-1"], "z": [4.2]})
    records = outlier_ledger.classify(flagged)
    assert records[0].classification == OutlierClass.UNCLASSIFIED.value
    assert "Pending review" in records[0].evidence


def test_classify_applies_maps() -> None:
    flagged = pd.DataFrame({"sample_id": ["S-1"], "z": [4.2]})
    records = outlier_ledger.classify(
        flagged,
        evidence_map={"S-1": "library complexity <0.3"},
        classification_map={"S-1": OutlierClass.TECHNICAL},
        reviewer="alice@lab",
    )
    assert records[0].classification == OutlierClass.TECHNICAL.value
    assert records[0].reviewed_by == "alice@lab"
