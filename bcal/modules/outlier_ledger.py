"""M5 — Outlier Classification Ledger.

A z-score alone is *not* sufficient justification for removing a sample. This
module requires orthogonal evidence for every outlier, and classifies each as:

* ``BIOLOGICAL`` — anomalous but genuine (e.g. a known rare genotype).
* ``TECHNICAL`` — process artefact (contamination, library prep failure).
* ``UNCLASSIFIED`` — flagged by the statistical screen but not yet reviewed.

The default screen uses a median-absolute-deviation (MAD) based z-score
because MAD is robust to the very outliers we're trying to detect — classical
mean/SD z-scores break down when the sample of interest is itself large.
"""

from __future__ import annotations

from collections.abc import Mapping

import numpy as np
import pandas as pd

from bcal.schema import OutlierClass, OutlierRecord

DEFAULT_Z_THRESHOLD = 3.0
"""Absolute modified-z-score above which a sample is flagged."""

# 1/Φ⁻¹(0.75) ≈ 1.4826 — the consistency constant that makes MAD equal to σ
# for normally distributed data. See Rousseeuw & Croux (1993).
_MAD_CONSISTENCY = 1.4826


def modified_z_scores(values: np.ndarray) -> np.ndarray:
    """Compute MAD-based robust z-scores. Constant vectors return zeros."""
    values = np.asarray(values, dtype=float)
    if values.size == 0:
        return values
    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median)))
    if mad == 0:
        # Fall back to mean/SD but zero out if that's also degenerate.
        std = float(np.std(values))
        if std == 0:
            return np.zeros_like(values)
        return (values - float(np.mean(values))) / std
    return (values - median) / (_MAD_CONSISTENCY * mad)


def screen(
    metric: pd.Series,
    *,
    threshold: float = DEFAULT_Z_THRESHOLD,
) -> pd.DataFrame:
    """Return a DataFrame of ``(sample_id, z)`` for samples past the threshold.

    ``metric`` must be indexed by sample_id. The result is sorted descending
    by |z| so reviewers see the worst offenders first.
    """
    if metric.empty:
        return pd.DataFrame(columns=["sample_id", "z"])

    z = pd.Series(modified_z_scores(metric.to_numpy()), index=metric.index)
    flagged = z[z.abs() >= threshold].sort_values(key=lambda s: s.abs(), ascending=False)
    return pd.DataFrame({"sample_id": flagged.index, "z": flagged.values})


def classify(
    flagged: pd.DataFrame,
    evidence_map: Mapping[str, str] | None = None,
    classification_map: Mapping[str, OutlierClass] | None = None,
    reviewer: str | None = None,
) -> list[OutlierRecord]:
    """Convert a flagged frame to :class:`OutlierRecord` instances.

    Parameters
    ----------
    flagged:
        Output of :func:`screen`.
    evidence_map:
        ``sample_id -> orthogonal evidence string``. Samples without an
        evidence entry get a placeholder and are classified as
        :attr:`OutlierClass.UNCLASSIFIED` unless a classification is supplied.
    classification_map:
        Optional explicit classifications, overriding the default.
    reviewer:
        Identifier recorded as ``reviewed_by`` on the record.
    """
    evidence_map = dict(evidence_map or {})
    classification_map = dict(classification_map or {})
    records: list[OutlierRecord] = []

    for _, row in flagged.iterrows():
        sid = str(row["sample_id"])
        evidence = evidence_map.get(
            sid, "Pending review — no orthogonal evidence supplied."
        )
        classification = classification_map.get(sid, OutlierClass.UNCLASSIFIED)
        records.append(
            OutlierRecord(
                sample_id=sid,
                classification=classification,
                z_score=round(float(row["z"]), 4),
                evidence=evidence,
                reviewed_by=reviewer,
            )
        )
    return records
