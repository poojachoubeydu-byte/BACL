"""Instrument layer — pipeline metadata capture.

The :class:`Instrument` class is used by pipeline developers to incrementally
record what happened during a run: which tools ran, which samples were excluded
and why, which files were consumed. On ``seal()`` it emits a signed SEP.

Typical usage::

    from bcal import Instrument

    with Instrument(
        pipeline_name="rnaseq-de",
        version="2.4.1",
        operator="alice@lab.org",
    ) as inst:
        inst.hash_inputs(["data/fastq/*.fq.gz"])
        inst.capture_tool_version("deseq2", "1.38.3")
        inst.exclude(
            sample_id="S-102",
            reason="Low depth (<5M reads)",
            operator_id="auto-qc",
            justification="Insufficient coverage for transcript estimation.",
        )
        sep = inst.seal()
        sep.to_json("audit_output/sep.json")

Pure Python, no network I/O. All timestamps are UTC.
"""

from __future__ import annotations

import glob
import hashlib
import os
import socket
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from importlib import metadata as importlib_metadata
from pathlib import Path
from types import TracebackType
from typing import Self

from bcal.schema import (
    BatchEffectAudit,
    ChecklistItem,
    ExclusionRecord,
    OutlierRecord,
    PipelineMetadata,
    StatisticalEvidencePackage,
    SubgroupAnalysis,
)

# Reading files in 1MB chunks keeps memory flat on multi-gigabyte FASTQ inputs.
_HASH_CHUNK = 1 << 20


def _sha256_file(path: Path) -> str:
    """Stream a file through SHA-256. Used for input manifest hashing."""
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while chunk := fh.read(_HASH_CHUNK):
            h.update(chunk)
    return h.hexdigest()


def _sha256_manifest(paths: list[Path]) -> str:
    """Order-independent hash over ``(path, per-file sha256)`` pairs.

    Sorting on absolute path makes the manifest digest deterministic regardless
    of directory-walk order — important for reproducibility across machines.
    """
    h = hashlib.sha256()
    entries = sorted((str(p.resolve()), _sha256_file(p)) for p in paths)
    for path_str, digest in entries:
        h.update(f"{digest}  {path_str}\n".encode())
    return h.hexdigest()


def _utc_now() -> datetime:
    return datetime.now(tz=UTC)


class Instrument:
    """Context manager for building a Statistical Evidence Package."""

    def __init__(
        self,
        pipeline_name: str,
        version: str,
        operator: str,
        *,
        sep_id: str | None = None,
        reference_genome: str | None = None,
        annotation_version: str | None = None,
        capture_host: bool = True,
    ) -> None:
        self._pipeline_name = pipeline_name
        self._version = version
        self._operator = operator
        self._sep_id = sep_id or f"SEP-{uuid.uuid4().hex[:12].upper()}"
        self._reference_genome = reference_genome
        self._annotation_version = annotation_version
        self._capture_host = capture_host

        self._started_at = _utc_now()
        self._manifest_digest: str | None = None
        self._tool_versions: dict[str, str] = {}
        self._exclusions: list[ExclusionRecord] = []
        self._subgroups: list[SubgroupAnalysis] = []
        self._outliers: list[OutlierRecord] = []
        self._batch_audit: BatchEffectAudit | None = None
        self._checklist: list[ChecklistItem] = []
        self._reviewer_language: str = ""

    # ------------------------------------------------------------------ #
    # Context manager plumbing
    # ------------------------------------------------------------------ #
    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:  # pragma: no cover - thin wrapper
        # Intentionally do NOT auto-seal on exit — callers may want to run
        # additional audits after the pipeline body. Explicit seal() is safer.
        return None

    # ------------------------------------------------------------------ #
    # Capture API
    # ------------------------------------------------------------------ #
    def hash_inputs(self, patterns: Iterable[str]) -> str:
        """Compute a deterministic manifest digest over all matching input files.

        Accepts glob patterns (``data/**/*.fq.gz``). Non-file matches (dirs,
        sockets) are skipped. Raises FileNotFoundError if nothing matches —
        this is deliberate: an empty input manifest almost always indicates a
        configuration error and should fail loudly.
        """
        # Use a set of resolved absolute paths to dedupe when overlapping
        # globs match the same file twice (common when a user passes both
        # "results/*.csv" and "results/**/*.csv").
        seen: set[Path] = set()
        resolved: list[Path] = []
        for pattern in patterns:
            for match in glob.iglob(pattern, recursive=True):
                p = Path(match)
                if not p.is_file():
                    continue
                abs_p = p.resolve()
                if abs_p in seen:
                    continue
                seen.add(abs_p)
                resolved.append(p)
        if not resolved:
            raise FileNotFoundError(
                f"Input manifest is empty; none of the patterns matched files: "
                f"{list(patterns)!r}"
            )
        self._manifest_digest = _sha256_manifest(resolved)
        return self._manifest_digest

    def set_manifest_digest(self, digest: str) -> None:
        """Directly set a pre-computed digest (e.g. supplied by Nextflow)."""
        if len(digest) != 64 or not all(c in "0123456789abcdef" for c in digest):
            raise ValueError(f"Not a SHA-256 hex digest: {digest!r}")
        self._manifest_digest = digest

    def capture_tool_version(
        self,
        name: str,
        version: str | None = None,
    ) -> str:
        """Record the version of a dependency.

        If ``version`` is None, attempt to discover it via ``importlib.metadata``.
        Raises ``PackageNotFoundError`` if auto-discovery fails.
        """
        if version is None:
            version = importlib_metadata.version(name)
        self._tool_versions[name] = version
        return version

    def exclude(
        self,
        sample_id: str,
        reason: str,
        operator_id: str,
        justification: str,
        *,
        evidence_refs: list[str] | None = None,
        timestamp: datetime | None = None,
    ) -> ExclusionRecord:
        """Record a documented, signed sample exclusion (M2)."""
        record = ExclusionRecord(
            sample_id=sample_id,
            reason=reason,
            operator_id=operator_id,
            timestamp=timestamp or _utc_now(),
            justification=justification,
            evidence_refs=list(evidence_refs or []),
        )
        self._exclusions.append(record)
        return record

    def add_subgroup_finding(self, finding: SubgroupAnalysis) -> None:
        self._subgroups.append(finding)

    def add_subgroup_findings(self, findings: Iterable[SubgroupAnalysis]) -> None:
        self._subgroups.extend(findings)

    def set_batch_audit(self, audit: BatchEffectAudit) -> None:
        self._batch_audit = audit

    def add_outlier(self, record: OutlierRecord) -> None:
        self._outliers.append(record)

    def add_outliers(self, records: Iterable[OutlierRecord]) -> None:
        self._outliers.extend(records)

    def add_checklist_items(self, items: Iterable[ChecklistItem]) -> None:
        self._checklist.extend(items)

    def set_reviewer_language(self, text: str) -> None:
        self._reviewer_language = text

    # ------------------------------------------------------------------ #
    # Finalisation
    # ------------------------------------------------------------------ #
    def seal(self) -> StatisticalEvidencePackage:
        """Finalise the SEP, compute its seal hash, and return it."""
        if self._manifest_digest is None:
            # A SEP without a manifest digest cannot prove input integrity.
            raise RuntimeError(
                "Cannot seal SEP: no input manifest digest recorded. "
                "Call hash_inputs(...) or set_manifest_digest(...) first."
            )

        host = None
        if self._capture_host:
            try:
                host = f"{socket.gethostname()}:{os.uname().sysname.lower()}"
            except (OSError, AttributeError):  # pragma: no cover - Windows fallback
                host = socket.gethostname()

        provenance = PipelineMetadata(
            pipeline_name=self._pipeline_name,
            version=self._version,
            operator=self._operator,
            timestamp=self._started_at,
            sha256=self._manifest_digest,
            tool_versions=dict(self._tool_versions),
            reference_genome=self._reference_genome,
            annotation_version=self._annotation_version,
            host=host,
        )

        sep = StatisticalEvidencePackage(
            id=self._sep_id,
            pipeline_provenance=provenance,
            decision_log=list(self._exclusions),
            subgroup_findings=list(self._subgroups),
            batch_audit=self._batch_audit,
            outlier_ledger=list(self._outliers),
            regulatory_checklist=list(self._checklist),
            reviewer_ready_language=self._reviewer_language,
        )
        sep.seal = sep.compute_seal()
        return sep


# ---------------------------------------------------------------------------
# Convenience one-shot function — useful from notebooks and CLI wrappers.
# ---------------------------------------------------------------------------
def audit(
    pipeline_name: str,
    version: str,
    operator: str,
    *,
    input_patterns: Iterable[str] | None = None,
    manifest_digest: str | None = None,
) -> StatisticalEvidencePackage:
    """Build a minimal SEP suitable as a starting point.

    Either ``input_patterns`` (glob strings) or ``manifest_digest`` (pre-hashed)
    must be supplied — never both.
    """
    if bool(input_patterns) == bool(manifest_digest):
        raise ValueError(
            "Supply exactly one of `input_patterns` or `manifest_digest`."
        )
    inst = Instrument(pipeline_name=pipeline_name, version=version, operator=operator)
    if input_patterns is not None:
        inst.hash_inputs(input_patterns)
    else:
        assert manifest_digest is not None  # narrowed by the XOR above
        inst.set_manifest_digest(manifest_digest)
    return inst.seal()
