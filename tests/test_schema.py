"""Schema — validation rules, serialisation, seal determinism."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from bcal.schema import (
    SCHEMA_VERSION,
    ExclusionRecord,
    PipelineMetadata,
    StatisticalEvidencePackage,
)


def _pmeta() -> PipelineMetadata:
    return PipelineMetadata(
        pipeline_name="p",
        version="1",
        operator="op",
        timestamp=datetime(2026, 1, 1, tzinfo=UTC),
        sha256="a" * 64,
    )


def test_schema_version_exposed() -> None:
    assert SCHEMA_VERSION == "1.0.0"
    sep = StatisticalEvidencePackage(id="x", pipeline_provenance=_pmeta())
    assert sep.schema_version == SCHEMA_VERSION


def test_timestamp_always_utc() -> None:
    naive = datetime(2026, 1, 1)
    pm = PipelineMetadata(
        pipeline_name="p", version="1", operator="o", timestamp=naive, sha256="a" * 64
    )
    assert pm.timestamp.tzinfo is not None
    assert pm.timestamp.tzinfo.utcoffset(pm.timestamp).total_seconds() == 0


def test_sha256_pattern_rejects_garbage() -> None:
    with pytest.raises(ValidationError):
        PipelineMetadata(
            pipeline_name="p",
            version="1",
            operator="o",
            timestamp=datetime(2026, 1, 1, tzinfo=UTC),
            sha256="not-a-hash",
        )


def test_exclusion_requires_substantive_justification() -> None:
    with pytest.raises(ValidationError):
        ExclusionRecord(
            sample_id="S-1",
            reason="QC",
            operator_id="op",
            timestamp=datetime.now(tz=UTC),
            justification="too short",
        )


def test_extra_keys_rejected() -> None:
    with pytest.raises(ValidationError):
        StatisticalEvidencePackage(
            id="x",
            pipeline_provenance=_pmeta(),
            unknown_field=1,  # type: ignore[call-arg]
        )


def test_seal_is_deterministic() -> None:
    sep1 = StatisticalEvidencePackage(id="x", pipeline_provenance=_pmeta())
    sep2 = StatisticalEvidencePackage(id="x", pipeline_provenance=_pmeta())
    assert sep1.compute_seal() == sep2.compute_seal()


def test_seal_excludes_seal_field() -> None:
    """Assigning a seal and re-computing must not depend on the seal itself."""
    sep = StatisticalEvidencePackage(id="x", pipeline_provenance=_pmeta())
    first = sep.compute_seal()
    sep.seal = first
    assert sep.compute_seal() == first


def test_canonical_json_is_sorted() -> None:
    sep = StatisticalEvidencePackage(id="x", pipeline_provenance=_pmeta())
    canon = sep.to_canonical_json()
    # Keys in a sorted JSON object — id should come before pipeline_provenance.
    assert canon.index('"id"') < canon.index('"pipeline_provenance"')
