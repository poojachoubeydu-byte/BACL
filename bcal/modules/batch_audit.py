"""M4 — Batch Effect & Covariate Audit.

Produces a 2D PCA and a PVCA-style variance ratio: the proportion of total
variance in expression (or feature) data that is attributable to batch.

Key design decisions:

* **No R dependency.** PVCA is normally an R/Bioconductor function; we
  approximate it with a linear-model variance partition using the first *k*
  principal components, which is good enough for an audit flag and does not
  require shipping R.
* **Deterministic.** The scikit-learn PCA is seeded via
  ``np.random.seed(42)``-equivalent ``random_state=0`` so two invocations on
  the same input produce byte-identical outputs — essential for reproducible
  SEPs.
* **Standardised inputs.** Features are z-scored before PCA to prevent
  absolute-scale artefacts from dominating PC1.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from bcal.schema import BatchEffectAudit, PCAPoint

_PVCA_MAX_PCS = 8
"""Variance partition uses the top-k PCs; 8 captures ~95% for typical data."""


@dataclass(frozen=True, slots=True)
class PVCAResult:
    """Summary of variance explained by batch across top-k PCs."""

    variance_ratio: float
    per_pc_r_squared: tuple[float, ...]
    pcs_considered: int


def _fit_pca(
    feature_matrix: np.ndarray, n_components: int
) -> tuple[PCA, np.ndarray]:
    """Z-score features, then fit a seeded PCA. Returns (pca, scores)."""
    if feature_matrix.size == 0:
        raise ValueError("Feature matrix is empty.")
    n_samples, n_features = feature_matrix.shape
    if n_features < 2 or n_samples < 2:
        raise ValueError(
            f"Need at least 2 samples and 2 features; got shape {feature_matrix.shape}."
        )
    n_components = max(2, min(n_components, n_samples - 1, n_features))
    scaler = StandardScaler()
    scaled = scaler.fit_transform(feature_matrix)
    pca = PCA(n_components=n_components, random_state=0)
    scores = pca.fit_transform(scaled)
    return pca, scores


def pvca_variance_ratio(
    feature_matrix: np.ndarray,
    batch_labels: pd.Series,
    *,
    max_pcs: int = _PVCA_MAX_PCS,
) -> PVCAResult:
    """Proportion of variance attributable to batch using top-k PCs.

    For each PC we fit ``score ~ C(batch)`` and compute R² (between-group
    variance / total variance). The overall ratio is the explained-variance-
    weighted mean of those R² values — mirroring PVCA's intuition while
    remaining dependency-light.
    """
    if len(batch_labels) != feature_matrix.shape[0]:
        raise ValueError(
            f"batch_labels length ({len(batch_labels)}) does not match "
            f"feature_matrix rows ({feature_matrix.shape[0]})."
        )

    pca, scores = _fit_pca(feature_matrix, n_components=max_pcs)
    batch_arr = batch_labels.to_numpy()
    per_pc_r2: list[float] = []
    for k in range(scores.shape[1]):
        per_pc_r2.append(float(_between_group_r2(scores[:, k], batch_arr)))

    explained = pca.explained_variance_ratio_
    weighted = float(
        np.sum(np.array(per_pc_r2) * explained) / np.sum(explained)
        if np.sum(explained) > 0
        else 0.0
    )
    return PVCAResult(
        variance_ratio=max(0.0, min(1.0, weighted)),
        per_pc_r_squared=tuple(per_pc_r2),
        pcs_considered=scores.shape[1],
    )


def _between_group_r2(values: np.ndarray, labels: np.ndarray) -> float:
    """R² of a one-way ANOVA decomposition — between / total sum of squares."""
    values = np.asarray(values, dtype=float)
    overall = values.mean()
    ss_total = float(((values - overall) ** 2).sum())
    if ss_total == 0:
        return 0.0
    ss_between = 0.0
    for label in np.unique(labels):
        group = values[labels == label]
        if group.size == 0:
            continue
        ss_between += float(group.size * (group.mean() - overall) ** 2)
    return ss_between / ss_total


def run(
    feature_matrix: np.ndarray | pd.DataFrame,
    sample_meta: pd.DataFrame,
    *,
    batch_col: str,
    subtype_col: str,
    correction_applied: str | None = None,
) -> BatchEffectAudit:
    """Compute the M4 audit for one run.

    Parameters
    ----------
    feature_matrix:
        ``samples × features`` matrix (e.g. log-normalised expression).
    sample_meta:
        One row per sample — must contain ``batch_col`` and ``subtype_col``.
    batch_col, subtype_col:
        Column names in ``sample_meta``.
    correction_applied:
        Name of any batch-correction method that was run upstream
        (``"ComBat"``, ``"sva"``, ``"none"``).
    """
    if isinstance(feature_matrix, pd.DataFrame):
        feature_matrix = feature_matrix.to_numpy(dtype=float)

    if feature_matrix.shape[0] != len(sample_meta):
        raise ValueError(
            f"Row count mismatch: feature_matrix has "
            f"{feature_matrix.shape[0]} samples, sample_meta has "
            f"{len(sample_meta)}."
        )
    for col in (batch_col, subtype_col):
        if col not in sample_meta.columns:
            raise KeyError(f"sample_meta missing column {col!r}")

    _, scores = _fit_pca(feature_matrix, n_components=2)
    pvca = pvca_variance_ratio(feature_matrix, sample_meta[batch_col])

    points: list[PCAPoint] = []
    index = sample_meta.index.tolist()
    for i, (pc1, pc2) in enumerate(scores):
        points.append(
            PCAPoint(
                sample_id=str(index[i]),
                pc1=round(float(pc1), 6),
                pc2=round(float(pc2), 6),
                batch=str(sample_meta[batch_col].iloc[i]),
                subtype=str(sample_meta[subtype_col].iloc[i]),
            )
        )

    return BatchEffectAudit(
        variance_ratio=round(pvca.variance_ratio, 6),
        principal_components=points,
        correction_applied=correction_applied,
    )
