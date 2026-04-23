"""Regulatory profile loader.

Profiles are shipped as YAML files under ``bcal/config/regulatory_profiles/``
and are loaded via :func:`load_profile`. Each profile lists the checklist
items that the audit should emit for compliance with a given framework
(FDA IND, EMA, CAP/CLIA).
"""

from __future__ import annotations

from dataclasses import dataclass
from importlib import resources
from pathlib import Path

import yaml

from bcal.schema import ChecklistItem, RegulatoryStatus

_PROFILE_PACKAGE = "bcal.config.regulatory_profiles"


@dataclass(frozen=True, slots=True)
class RegulatoryProfile:
    """An in-memory representation of a YAML regulatory profile."""

    code: str
    name: str
    description: str
    checklist: tuple[ChecklistItem, ...]


class ProfileNotFoundError(ValueError):
    """Raised when the requested profile code is unknown."""


def _profile_root() -> Path:
    """Filesystem path to the shipped profiles directory."""
    # Using .files + .joinpath is the modern resources API.
    return Path(str(resources.files(_PROFILE_PACKAGE)))


def list_profiles() -> list[RegulatoryProfile]:
    """Return every profile shipped with the package, sorted by code."""
    root = _profile_root()
    profiles: list[RegulatoryProfile] = []
    for path in sorted(root.glob("*.yaml")):
        profiles.append(_load_file(path))
    return profiles


def load_profile(code_or_path: str) -> RegulatoryProfile:
    """Resolve a profile by code (e.g. ``fda_ind``) or by filesystem path."""
    as_path = Path(code_or_path)
    if as_path.exists():
        return _load_file(as_path)

    candidate = _profile_root() / f"{code_or_path}.yaml"
    if not candidate.exists():
        available = ", ".join(p.code for p in list_profiles())
        raise ProfileNotFoundError(
            f"Unknown profile {code_or_path!r}. Available: {available}"
        )
    return _load_file(candidate)


def _load_file(path: Path) -> RegulatoryProfile:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Profile {path} must be a YAML mapping at top level.")

    code = str(data.get("code") or path.stem)
    name = str(data.get("name") or code)
    description = str(data.get("description") or "")
    raw_items = data.get("checklist") or []
    items: list[ChecklistItem] = []
    for entry in raw_items:
        if not isinstance(entry, dict):
            raise ValueError(f"Profile {path}: checklist entries must be mappings.")
        items.append(
            ChecklistItem(
                item=str(entry["item"]),
                status=RegulatoryStatus(entry.get("status", "ok")),
                reference=entry.get("reference"),
            )
        )
    return RegulatoryProfile(
        code=code,
        name=name,
        description=description,
        checklist=tuple(items),
    )
