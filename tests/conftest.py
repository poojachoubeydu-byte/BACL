"""Shared pytest fixtures."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from bcal.instrument import Instrument
from bcal.schema import StatisticalEvidencePackage


@pytest.fixture
def frozen_now() -> datetime:
    """A stable UTC timestamp used across tests for golden-file determinism."""
    return datetime(2026, 4, 23, 5, 53, 57, tzinfo=UTC)


@pytest.fixture
def synth_cohort() -> pd.DataFrame:
    """A small deterministic cohort with a planted Simpson's paradox.

    The pooled effect of ``treatment`` on ``outcome`` is positive, but the
    female stratum's effect is negative — the canonical textbook reversal.
    """
    rng = np.random.default_rng(seed=42)
    rows: list[dict[str, object]] = []

    # Majority: males receiving treatment benefit strongly.
    for i in range(80):
        rows.append(
            {
                "sample_id": f"M-{i:03d}",
                "treatment": 1 if i % 2 == 0 else 0,
                "outcome": (1.0 if i % 2 == 0 else 0.0) + rng.normal(scale=0.1),
                "sex": "M",
                "age_bucket": "<50",
            }
        )
    # Minority: females where treated have worse outcomes than control.
    for i in range(20):
        rows.append(
            {
                "sample_id": f"F-{i:03d}",
                "treatment": 1 if i % 2 == 0 else 0,
                "outcome": (-0.5 if i % 2 == 0 else 0.0) + rng.normal(scale=0.05),
                "sex": "F",
                "age_bucket": ">65",
            }
        )
    return pd.DataFrame(rows).set_index("sample_id")


@pytest.fixture
def sample_feature_matrix() -> tuple[np.ndarray, pd.DataFrame]:
    """An expression-like matrix with an obvious batch effect."""
    rng = np.random.default_rng(seed=7)
    n, p = 20, 40
    batch_labels = np.array(["Batch_1"] * 10 + ["Batch_2"] * 10)
    subtype = np.array(["Resistant"] * 10 + ["Sensitive"] * 10)
    meta = pd.DataFrame(
        {"batch": batch_labels, "subtype": subtype},
        index=[f"S-{i:03d}" for i in range(n)],
    )
    features = rng.normal(size=(n, p))
    # Add a batch-specific shift to every feature — we expect PVCA to detect it.
    features[batch_labels == "Batch_2"] += 3.0
    return features, meta


@pytest.fixture
def minimal_sep(frozen_now: datetime, tmp_path: Path) -> StatisticalEvidencePackage:
    """A fully-sealed SEP using a precomputed manifest digest — no I/O."""
    with Instrument(
        pipeline_name="test-pipeline",
        version="0.1.0",
        operator="pytest",
        sep_id="SEP-TEST-0001",
        capture_host=False,  # host string is nondeterministic — drop it
    ) as inst:
        inst._started_at = frozen_now  # type: ignore[attr-defined]
        inst.set_manifest_digest("a" * 64)
        inst.exclude(
            sample_id="S-001",
            reason="Low depth",
            operator_id="auto-qc",
            justification=(
                "Insufficient coverage for reliable estimation; flagged by auto-QC."
            ),
            timestamp=frozen_now,
        )
        sep = inst.seal()
    return sep
