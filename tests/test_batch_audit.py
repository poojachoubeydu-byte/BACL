"""M4 — Batch effect audit."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from bcal.modules import batch_audit


def test_pvca_detects_planted_batch_effect(
    sample_feature_matrix: tuple[np.ndarray, pd.DataFrame],
) -> None:
    features, meta = sample_feature_matrix
    result = batch_audit.pvca_variance_ratio(features, meta["batch"])
    # With the planted shift, batch should explain most of the variance.
    assert result.variance_ratio > 0.5


def test_run_produces_pca_points(
    sample_feature_matrix: tuple[np.ndarray, pd.DataFrame],
) -> None:
    features, meta = sample_feature_matrix
    audit = batch_audit.run(
        features, meta, batch_col="batch", subtype_col="subtype"
    )
    assert len(audit.principal_components) == features.shape[0]
    assert 0 <= audit.variance_ratio <= 1


def test_deterministic(sample_feature_matrix: tuple[np.ndarray, pd.DataFrame]) -> None:
    features, meta = sample_feature_matrix
    a = batch_audit.run(features, meta, batch_col="batch", subtype_col="subtype")
    b = batch_audit.run(features, meta, batch_col="batch", subtype_col="subtype")
    assert a.variance_ratio == b.variance_ratio
    assert [p.pc1 for p in a.principal_components] == [
        p.pc1 for p in b.principal_components
    ]


def test_shape_mismatch_rejected() -> None:
    with pytest.raises(ValueError):
        batch_audit.run(
            np.zeros((3, 10)),
            pd.DataFrame({"batch": ["A"] * 4, "subtype": ["X"] * 4}),
            batch_col="batch",
            subtype_col="subtype",
        )


def test_constant_values_do_not_divide_by_zero() -> None:
    # All samples identical — variance_ratio should be 0, not NaN.
    features = np.ones((6, 4))
    meta = pd.DataFrame({"batch": ["A", "B"] * 3, "subtype": ["X"] * 6})
    result = batch_audit.run(features, meta, batch_col="batch", subtype_col="subtype")
    assert result.variance_ratio == 0 or np.isnan(result.variance_ratio) is False
