"""BCAL audit modules.

Each module exposes a pure-functional ``run(...)`` entry point that consumes
data (typically a pandas DataFrame plus config) and returns typed results
suitable for attaching to an :class:`~bcal.schema.StatisticalEvidencePackage`.

Modules are deliberately decoupled from :class:`~bcal.instrument.Instrument`
so they can be unit-tested in isolation and reused by third parties.
"""

from bcal.modules import batch_audit, exclusions, outlier_ledger, subgroup, version_lock

__all__ = [
    "batch_audit",
    "exclusions",
    "outlier_ledger",
    "subgroup",
    "version_lock",
]
