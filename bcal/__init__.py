"""BCAL — BioCompliance Audit Layer.

A statistical-evidence auditing framework for regulated bioinformatics pipelines
(RNA-seq, variant calling, multi-omics). Produces Statistical Evidence Packages
(SEPs) that are reproducible, cryptographically hashed, and pre-aligned with:

- ICH E9R1 (Statistical Principles for Clinical Trials — addendum on estimands)
- 21 CFR Part 11 (Electronic records & electronic signatures)
- CAP / CLIA clinical laboratory guidance

Public API:
    >>> import bcal
    >>> sep = bcal.audit(pipeline_root="./results", config="bcal_config.yaml")
    >>> sep.to_json("sep.json")

See `bcal.cli` for the command-line entry point (``bcal audit …``).
"""

from __future__ import annotations

from importlib import metadata

try:  # pragma: no cover - metadata only present for installed package
    __version__: str = metadata.version("bcal")
except metadata.PackageNotFoundError:  # pragma: no cover
    __version__ = "0.1.0+local"

from bcal.instrument import Instrument, audit
from bcal.schema import (
    ChecklistItem,
    ExclusionRecord,
    OutlierRecord,
    PipelineMetadata,
    StatisticalEvidencePackage,
    SubgroupAnalysis,
)

__all__ = [
    "ChecklistItem",
    "ExclusionRecord",
    "Instrument",
    "OutlierRecord",
    "PipelineMetadata",
    "StatisticalEvidencePackage",
    "SubgroupAnalysis",
    "__version__",
    "audit",
]
