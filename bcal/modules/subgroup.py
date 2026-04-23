"""M1 — Subgroup Consistency Engine (Simpson's Paradox detection).

Under ICH E9R1, a statistically valid subgroup analysis must be pre-specifiable
and robust to Simpson's paradox: it is unacceptable for the pooled effect of a
treatment to reverse sign when stratified by a known covariate (sex, age,
disease subtype, etc.) without that reversal being surfaced and explained.

This module computes:

* The **pooled effect** of a treatment on an outcome across the full cohort.
* The **stratum-specific effects** across user-specified covariates.
* A **status** per stratum:

  * ``CONSISTENT`` — stratum effect sign matches pooled, magnitude within 2×.
  * ``WARNING``    — same sign, magnitude change >2×.
  * ``PARADOX``    — sign reversal between pooled and stratum.

Effect estimator: difference in outcome means between treatment=1 and
treatment=0. This is intentionally simple — the framework's value is in the
*audit trail*, not in inventing a new estimator. Users with more sophisticated
needs (Cox, GLM, mixed models) can supply pre-computed effects via
:func:`build_findings_from_effects`.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats

from bcal.schema import SubgroupAnalysis, SubgroupStatus

MAGNITUDE_RATIO_WARNING = 2.0
"""If |stratum_effect| exceeds this × |pooled_effect| (or vice versa), warn."""


@dataclass(frozen=True, slots=True)
class EffectEstimate:
    """A single pooled- or stratum-level effect estimate."""

    label: str
    effect: float
    n: int
    p_value: float | None = None


def _mean_diff(
    df: pd.DataFrame, treatment_col: str, outcome_col: str
) -> EffectEstimate:
    treated = df.loc[df[treatment_col] == 1, outcome_col].dropna().to_numpy()
    control = df.loc[df[treatment_col] == 0, outcome_col].dropna().to_numpy()
    if len(treated) == 0 or len(control) == 0:
        return EffectEstimate(label="pooled", effect=float("nan"), n=len(df))
    effect = float(np.mean(treated) - np.mean(control))
    # Two-sided Welch's t-test — tolerates unequal variance and unequal n.
    try:
        _, p = stats.ttest_ind(treated, control, equal_var=False)
        p_value: float | None = float(p)
    except (ValueError, FloatingPointError):  # pragma: no cover
        p_value = None
    return EffectEstimate(label="pooled", effect=effect, n=len(df), p_value=p_value)


def _classify(pooled: float, stratum: float) -> SubgroupStatus:
    """Compare pooled vs. stratum effect and return a status code."""
    # Treat exact zero as a degenerate pooled effect — always warn.
    if pooled == 0 or np.isnan(pooled) or np.isnan(stratum):
        return SubgroupStatus.WARNING
    if np.sign(pooled) != np.sign(stratum):
        return SubgroupStatus.PARADOX
    ratio = abs(stratum) / abs(pooled) if pooled != 0 else float("inf")
    if ratio > MAGNITUDE_RATIO_WARNING or ratio < (1 / MAGNITUDE_RATIO_WARNING):
        return SubgroupStatus.WARNING
    return SubgroupStatus.CONSISTENT


def run(
    df: pd.DataFrame,
    *,
    treatment_col: str,
    outcome_col: str,
    covariate_cols: list[str],
) -> list[SubgroupAnalysis]:
    """Detect Simpson's paradox across one or more covariate strata.

    Parameters
    ----------
    df:
        Tidy sample-level data with one row per sample.
    treatment_col:
        Name of the column holding the 0/1 treatment indicator.
    outcome_col:
        Name of the numeric outcome column.
    covariate_cols:
        Names of columns to stratify on (e.g. ``['sex', 'age_bucket']``).

    Returns
    -------
    A list of :class:`SubgroupAnalysis` records — one per stratum per
    covariate — in a deterministic (covariate, stratum label) sort order.
    """
    _validate_input(df, treatment_col, outcome_col, covariate_cols)

    pooled = _mean_diff(df, treatment_col, outcome_col)
    findings: list[SubgroupAnalysis] = []

    for cov in covariate_cols:
        # Sort stratum labels so the output is deterministic. NaN-bearing
        # strata are skipped (they would otherwise pollute the audit trail).
        strata = sorted(s for s in df[cov].dropna().unique().tolist())
        for stratum in strata:
            sub = df.loc[df[cov] == stratum]
            s_est = _mean_diff(sub, treatment_col, outcome_col)
            status = _classify(pooled.effect, s_est.effect)
            findings.append(
                SubgroupAnalysis(
                    subgroup_id=f"{cov}={stratum}",
                    trait=outcome_col,
                    baseline=round(pooled.effect, 6),
                    effect=round(s_est.effect, 6),
                    status=status,
                    n_pooled=pooled.n,
                    n_stratum=s_est.n,
                    p_value=s_est.p_value,
                )
            )
    return findings


def build_findings_from_effects(
    pooled_effect: float,
    stratum_effects: dict[str, float],
    *,
    trait: str,
    n_pooled: int | None = None,
) -> list[SubgroupAnalysis]:
    """Hand-build findings when effects come from an external estimator.

    Use this when upstream code (edgeR/DESeq2 in R, a mixed model, etc.) has
    already produced effect sizes — BCAL only classifies and records them.
    """
    findings: list[SubgroupAnalysis] = []
    for label, effect in sorted(stratum_effects.items()):
        findings.append(
            SubgroupAnalysis(
                subgroup_id=label,
                trait=trait,
                baseline=round(pooled_effect, 6),
                effect=round(effect, 6),
                status=_classify(pooled_effect, effect),
                n_pooled=n_pooled,
            )
        )
    return findings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _validate_input(
    df: pd.DataFrame,
    treatment_col: str,
    outcome_col: str,
    covariate_cols: list[str],
) -> None:
    required = {treatment_col, outcome_col, *covariate_cols}
    missing = required - set(df.columns)
    if missing:
        raise KeyError(f"DataFrame is missing columns: {sorted(missing)!r}")
    if not covariate_cols:
        raise ValueError("At least one covariate column is required.")
    treat_unique = set(df[treatment_col].dropna().unique())
    if not treat_unique.issubset({0, 1}):
        raise ValueError(
            f"Treatment column must be 0/1 indicator. Got unique values "
            f"{sorted(treat_unique)!r}."
        )
    if not pd.api.types.is_numeric_dtype(df[outcome_col]):
        raise TypeError(f"Outcome column {outcome_col!r} must be numeric.")
