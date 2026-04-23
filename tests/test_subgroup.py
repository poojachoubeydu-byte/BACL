"""M1 — Simpson's paradox detection."""

from __future__ import annotations

import pandas as pd
import pytest

from bcal.modules import subgroup
from bcal.schema import SubgroupStatus


def test_detects_classical_paradox(synth_cohort: pd.DataFrame) -> None:
    findings = subgroup.run(
        synth_cohort,
        treatment_col="treatment",
        outcome_col="outcome",
        covariate_cols=["sex"],
    )
    # Female stratum should reverse sign relative to the (male-dominated) pooled effect.
    female = next(f for f in findings if f.subgroup_id == "sex=F")
    assert female.status == SubgroupStatus.PARADOX.value


def test_consistent_strata_marked_consistent() -> None:
    # Each sex stratum has both arms, and treated samples score +1 in both.
    # Pooled and per-stratum effects should all be ≈ 1 — CONSISTENT.
    rows = []
    for i in range(20):
        for sex in ("M", "F"):
            rows.append({"treatment": 0, "outcome": 0.0 + 0.01 * i, "sex": sex})
            rows.append({"treatment": 1, "outcome": 1.0 + 0.01 * i, "sex": sex})
    df = pd.DataFrame(rows)
    findings = subgroup.run(
        df, treatment_col="treatment", outcome_col="outcome", covariate_cols=["sex"]
    )
    assert all(f.status == SubgroupStatus.CONSISTENT.value for f in findings)


def test_build_from_effects_paradox() -> None:
    findings = subgroup.build_findings_from_effects(
        pooled_effect=0.5,
        stratum_effects={"A": 0.6, "B": -0.3},
        trait="toxicity",
    )
    statuses = {f.subgroup_id: f.status for f in findings}
    assert statuses["A"] == SubgroupStatus.CONSISTENT.value
    assert statuses["B"] == SubgroupStatus.PARADOX.value


def test_validates_missing_columns() -> None:
    df = pd.DataFrame({"outcome": [1.0, 2.0]})
    with pytest.raises(KeyError):
        subgroup.run(
            df, treatment_col="treatment", outcome_col="outcome", covariate_cols=["sex"]
        )


def test_rejects_non_binary_treatment() -> None:
    df = pd.DataFrame(
        {"treatment": [0, 1, 2], "outcome": [1.0, 2.0, 3.0], "sex": ["M", "F", "M"]}
    )
    with pytest.raises(ValueError):
        subgroup.run(
            df, treatment_col="treatment", outcome_col="outcome", covariate_cols=["sex"]
        )


def test_deterministic_ordering(synth_cohort: pd.DataFrame) -> None:
    a = subgroup.run(
        synth_cohort, treatment_col="treatment", outcome_col="outcome",
        covariate_cols=["sex", "age_bucket"],
    )
    b = subgroup.run(
        synth_cohort, treatment_col="treatment", outcome_col="outcome",
        covariate_cols=["sex", "age_bucket"],
    )
    assert [f.subgroup_id for f in a] == [f.subgroup_id for f in b]
