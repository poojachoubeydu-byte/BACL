"""M3 — Statistical Method Version Lock.

Under GxP reproducibility requirements, a pipeline must record *exactly* which
version of every statistical tool was used, with enough detail to rebuild the
environment later. This module captures versions from three sources, in order
of preference:

1. ``importlib.metadata`` — for Python packages installed in the current env.
2. ``subprocess`` — for external binaries that print ``--version``.
3. Manual — explicit user-supplied pins (e.g. container digests).

It also verifies the presence of *parameter pins*: if a tool is used but its
configuration hash is not recorded, that's a reproducibility hole and we flag
it as a checklist warning.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from importlib import metadata as importlib_metadata

from bcal.schema import ChecklistItem, RegulatoryStatus

# Matches a semver-ish token at the start of a line, or after "version"/"v".
_VERSION_RE = re.compile(
    r"""
    (?:version|v|release)?  # optional label
    [\s:=]*                 # separator
    (                       # capture group
      \d+(?:\.\d+){0,3}     # 1-4 dotted numbers
      (?:[-+][\w.]+)?       # optional pre-release/build
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)


@dataclass(frozen=True, slots=True)
class ToolPin:
    """A single recorded tool version + provenance."""

    name: str
    version: str
    source: str  # "importlib" | "subprocess" | "manual"


class VersionLookupError(RuntimeError):
    """Raised when a tool version cannot be determined."""


def from_importlib(name: str) -> ToolPin:
    """Resolve a pure-Python package version via importlib.metadata."""
    try:
        version = importlib_metadata.version(name)
    except importlib_metadata.PackageNotFoundError as exc:
        raise VersionLookupError(
            f"Package {name!r} is not installed in the current environment."
        ) from exc
    return ToolPin(name=name, version=version, source="importlib")


def from_subprocess(
    binary: str,
    *,
    args: tuple[str, ...] = ("--version",),
    timeout: float = 5.0,
) -> ToolPin:
    """Resolve an external binary's version by running ``binary --version``.

    The output is parsed with a conservative regex; if no semver-like token is
    found, the full first line of output is stored verbatim so the information
    is at least preserved (even if not machine-parseable).
    """
    path = shutil.which(binary)
    if path is None:
        raise VersionLookupError(f"Binary {binary!r} not found on $PATH.")
    try:
        proc = subprocess.run(
            [path, *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise VersionLookupError(
            f"Binary {binary!r} did not respond within {timeout}s."
        ) from exc

    # Some tools print to stderr (git), others to stdout (python). Try both.
    output = (proc.stdout or proc.stderr or "").strip().splitlines()
    if not output:
        raise VersionLookupError(f"Binary {binary!r} produced no version output.")
    first = output[0].strip()
    match = _VERSION_RE.search(first)
    version = match.group(1) if match else first
    return ToolPin(name=binary, version=version, source="subprocess")


def from_manual(name: str, version: str) -> ToolPin:
    """Record an explicit user-supplied pin."""
    if not version.strip():
        raise ValueError(f"Manual version for {name!r} must be non-empty.")
    return ToolPin(name=name, version=version.strip(), source="manual")


def params_hash(params: dict[str, object]) -> str:
    """Return a stable SHA-256 hex digest of a parameter dict.

    Uses ``sort_keys=True`` with separators that remove whitespace so that
    equivalent parameter sets always produce the same digest regardless of
    insertion order or indentation.
    """
    canonical = json.dumps(
        params, sort_keys=True, separators=(",", ":"), default=str
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def checklist_for(
    tools: list[ToolPin],
    *,
    parameter_hashes: dict[str, str] | None = None,
    required: set[str] | None = None,
) -> list[ChecklistItem]:
    """Build compliance-checklist items for the recorded versions.

    Parameters
    ----------
    tools:
        The tool pins actually captured for this run.
    parameter_hashes:
        Mapping of ``tool_name -> parameter_digest``. If a tool is present but
        has no parameter hash, a WARNING item is emitted.
    required:
        Tools that *must* be pinned for this profile (e.g. ``{"deseq2"}``).
        Missing entries produce MISSING items.
    """
    items: list[ChecklistItem] = []
    captured = {t.name: t for t in tools}

    for name, pin in sorted(captured.items()):
        items.append(
            ChecklistItem(
                item=f"Version recorded: {name}={pin.version} ({pin.source})",
                status=RegulatoryStatus.OK,
                reference="21 CFR 11.10(e) / ICH E9R1",
            )
        )
        if parameter_hashes is not None and name not in parameter_hashes:
            items.append(
                ChecklistItem(
                    item=f"Parameter hash missing for {name}",
                    status=RegulatoryStatus.WARNING,
                    reference="GxP reproducibility",
                )
            )

    for name in sorted(required or set()):
        if name not in captured:
            items.append(
                ChecklistItem(
                    item=f"Required tool not pinned: {name}",
                    status=RegulatoryStatus.MISSING,
                    reference="21 CFR 11.10(e)",
                )
            )
    return items
