"""M3 — Version lock & parameter hashing."""

from __future__ import annotations

import pytest

from bcal.modules import version_lock
from bcal.schema import RegulatoryStatus


def test_from_importlib_resolves_installed_package() -> None:
    # pydantic is a hard dep of bcal — must be installed.
    pin = version_lock.from_importlib("pydantic")
    assert pin.source == "importlib"
    assert pin.version


def test_from_importlib_raises_for_missing() -> None:
    with pytest.raises(version_lock.VersionLookupError):
        version_lock.from_importlib("this-package-does-not-exist-x9q2")


def test_from_manual() -> None:
    pin = version_lock.from_manual("samtools", "1.19.2")
    assert pin.name == "samtools"
    assert pin.version == "1.19.2"
    assert pin.source == "manual"


def test_manual_rejects_blank() -> None:
    with pytest.raises(ValueError):
        version_lock.from_manual("tool", "")


def test_params_hash_stable() -> None:
    a = version_lock.params_hash({"alpha": 0.05, "cores": 4})
    b = version_lock.params_hash({"cores": 4, "alpha": 0.05})
    assert a == b


def test_params_hash_changes_on_value_change() -> None:
    a = version_lock.params_hash({"alpha": 0.05})
    b = version_lock.params_hash({"alpha": 0.1})
    assert a != b


def test_checklist_flags_missing_required() -> None:
    items = version_lock.checklist_for(
        tools=[version_lock.from_manual("salmon", "1.10.2")],
        required={"salmon", "deseq2"},
    )
    missing = [i for i in items if i.status == RegulatoryStatus.MISSING.value]
    assert len(missing) == 1
    assert "deseq2" in missing[0].item


def test_checklist_flags_missing_params() -> None:
    items = version_lock.checklist_for(
        tools=[version_lock.from_manual("deseq2", "1.38.3")],
        parameter_hashes={},  # empty → warning for deseq2
    )
    warnings = [i for i in items if i.status == RegulatoryStatus.WARNING.value]
    assert any("Parameter hash missing" in w.item for w in warnings)
