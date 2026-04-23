"""Deterministic JSON emission for the SEP."""

from __future__ import annotations

import json
from pathlib import Path

from bcal.schema import StatisticalEvidencePackage


def write_json(
    sep: StatisticalEvidencePackage,
    path: str | Path,
    *,
    indent: int = 2,
) -> Path:
    """Write the SEP as indented, sort-keyed JSON. Returns the written path."""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    data = sep.model_dump(mode="json")
    text = json.dumps(data, indent=indent, sort_keys=True) + "\n"
    out.write_text(text, encoding="utf-8")
    return out
