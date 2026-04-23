"""Pydantic schema for the Statistical Evidence Package (SEP).

The SEP is BCAL's core artefact: a machine-readable, schema-versioned record
of everything a regulator (or a reproducer) would need to understand the
decisions made during a bioinformatics pipeline run.

Every field is typed, validated, and serialisable to stable JSON. The schema
version follows semver: **breaking** changes to field semantics bump the major
version; additive changes bump minor; clarifications bump patch.

Downstream consumers (TypeScript frontend, LIMS exporters, test fixtures)
should pin the schema major version they support.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_serializer,
    field_validator,
)

SCHEMA_VERSION: str = "1.0.0"
"""Current SEP JSON Schema version (semver)."""

SafeString = Annotated[
    str,
    StringConstraints(min_length=1, max_length=2048, strip_whitespace=True),
]


class RegulatoryStatus(StrEnum):
    """Traffic-light state for a checklist item."""

    OK = "ok"
    MISSING = "missing"
    WARNING = "warning"


class SubgroupStatus(StrEnum):
    """Result of the M1 subgroup-consistency test."""

    CONSISTENT = "consistent"
    PARADOX = "paradox"  # Simpson's Paradox detected
    WARNING = "warning"  # directional consistency, magnitude change >2x


class OutlierClass(StrEnum):
    """Biological vs. technical outlier classification (M5)."""

    BIOLOGICAL = "biological"
    TECHNICAL = "technical"
    UNCLASSIFIED = "unclassified"


class _Base(BaseModel):
    """Project-wide Pydantic base. Strict; no extra keys; frozen for safety."""

    model_config = ConfigDict(
        extra="forbid",
        frozen=False,  # SEP is built incrementally; we freeze at seal-time
        str_strip_whitespace=True,
        validate_assignment=True,
        use_enum_values=True,
    )


class ToolVersion(_Base):
    """A single (tool, version) pair captured during instrumentation."""

    name: SafeString
    version: SafeString
    source: Literal["importlib", "subprocess", "manual", "conda", "container"] = (
        "manual"
    )


class PipelineMetadata(_Base):
    """Captured provenance for a single pipeline run.

    References:
        21 CFR 11.10(e): audit trails must include time-stamped records.
    """

    pipeline_name: SafeString
    version: SafeString
    operator: SafeString
    timestamp: datetime
    sha256: str = Field(
        pattern=r"^[0-9a-f]{64}$",
        description="SHA-256 digest of the pipeline input manifest.",
    )
    tool_versions: dict[str, str] = Field(default_factory=dict)
    reference_genome: str | None = None
    annotation_version: str | None = None
    host: str | None = Field(
        default=None, description="hostname:container:arch — optional."
    )

    @field_validator("timestamp")
    @classmethod
    def _ensure_tz(cls, v: datetime) -> datetime:
        """All timestamps are stored as UTC-aware."""
        if v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        return v.astimezone(UTC)

    @field_serializer("timestamp")
    def _ser_ts(self, v: datetime) -> str:
        # Always emit RFC 3339 with 'Z' for UTC — canonical form for audit logs.
        return v.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class ExclusionRecord(_Base):
    """A documented, signed decision to remove a sample (M2).

    Compliance:
        21 CFR 11.50 — signed electronic records must include name of signer,
        date/time, and meaning (reason).
    """

    sample_id: SafeString
    reason: SafeString
    operator_id: SafeString
    timestamp: datetime
    justification: Annotated[
        str, StringConstraints(min_length=20, max_length=4096, strip_whitespace=True)
    ] = Field(
        description=(
            "Human-readable justification (≥20 chars). A bare 'failed QC' is "
            "insufficient per 21 CFR Part 11 — the *why* must be documented."
        )
    )
    evidence_refs: list[str] = Field(default_factory=list)

    @field_validator("timestamp")
    @classmethod
    def _ensure_tz(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        return v.astimezone(UTC)

    @field_serializer("timestamp")
    def _ser_ts(self, v: datetime) -> str:
        return v.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class SubgroupAnalysis(_Base):
    """Result of comparing a stratum's effect vs. the pooled effect (M1)."""

    subgroup_id: SafeString
    trait: SafeString
    baseline: float
    effect: float
    status: SubgroupStatus
    n_pooled: int | None = Field(default=None, ge=0)
    n_stratum: int | None = Field(default=None, ge=0)
    p_value: float | None = Field(default=None, ge=0, le=1)
    note: str | None = None


class PCAPoint(_Base):
    """A single sample in 2D PCA space, tagged by batch and subtype."""

    sample_id: SafeString | None = None
    pc1: float
    pc2: float
    batch: SafeString
    subtype: SafeString


class BatchEffectAudit(_Base):
    """Variance partitioning + stratified PCA (M4)."""

    variance_ratio: float = Field(
        ge=0, le=1,
        description="Fraction of total variance explained by batch (PVCA-style).",
    )
    principal_components: list[PCAPoint] = Field(default_factory=list)
    correction_applied: str | None = Field(
        default=None,
        description="Name of correction method applied (e.g. 'ComBat', 'sva', 'none').",
    )


class OutlierRecord(_Base):
    """A sample flagged as an outlier with an explicit classification (M5)."""

    sample_id: SafeString
    classification: OutlierClass
    z_score: float | None = None
    evidence: SafeString = Field(
        description=(
            "What makes this biological vs technical? A z-score alone is *not* "
            "sufficient — supply orthogonal evidence (clinical note, library "
            "complexity, contamination estimate, etc.)."
        )
    )
    reviewed_by: str | None = None


class ChecklistItem(_Base):
    """A single line on the regulatory compliance checklist."""

    item: SafeString
    status: RegulatoryStatus
    reference: str | None = Field(
        default=None,
        description="e.g. '21 CFR 11.10(e)', 'ICH E9R1 §5.2.3'",
    )


class StatisticalEvidencePackage(_Base):
    """Top-level SEP artefact.

    Build incrementally with the :class:`bcal.instrument.Instrument` context
    manager, then serialise to JSON / Markdown / CSV / PDF via
    :mod:`bcal.report`.
    """

    id: SafeString
    schema_version: Literal["1.0.0"] = "1.0.0"
    pipeline_provenance: PipelineMetadata
    decision_log: list[ExclusionRecord] = Field(default_factory=list)
    subgroup_findings: list[SubgroupAnalysis] = Field(default_factory=list)
    batch_audit: BatchEffectAudit | None = None
    outlier_ledger: list[OutlierRecord] = Field(default_factory=list)
    regulatory_checklist: list[ChecklistItem] = Field(default_factory=list)
    reviewer_ready_language: str = ""
    seal: str | None = Field(
        default=None,
        description=(
            "SHA-256 over the canonical JSON of all other fields; set by "
            "Instrument.seal() to make tampering detectable."
        ),
    )

    # ----- serialisation helpers ---------------------------------------- #
    def to_canonical_json(self) -> str:
        """Return stable, sorted, UTF-8 JSON suitable for hashing.

        The ``seal`` field is excluded so that sealing is idempotent.
        """
        data = self.model_dump(mode="json", exclude={"seal"})
        return json.dumps(data, sort_keys=True, separators=(",", ":"))

    def compute_seal(self) -> str:
        """Return the SHA-256 hex digest of the canonical JSON."""
        return hashlib.sha256(self.to_canonical_json().encode("utf-8")).hexdigest()

    def to_json(self, path: str | Path | None = None, *, indent: int = 2) -> str:
        """Serialise to human-readable JSON (non-canonical, indented)."""
        data = self.model_dump(mode="json")
        text = json.dumps(data, indent=indent, sort_keys=True)
        if path is not None:
            Path(path).write_text(text, encoding="utf-8")
        return text

    @classmethod
    def from_json(cls, path: str | Path) -> StatisticalEvidencePackage:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls.model_validate(raw)


def dump_json_schema() -> dict[str, Any]:
    """Return the JSON Schema for the SEP. Used by CI to emit docs."""
    return StatisticalEvidencePackage.model_json_schema()
