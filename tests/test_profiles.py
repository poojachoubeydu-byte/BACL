"""Regulatory profiles."""

from __future__ import annotations

import pytest

from bcal.profiles import ProfileNotFoundError, list_profiles, load_profile


def test_fda_profile_loads() -> None:
    p = load_profile("fda_ind")
    assert p.code == "fda_ind"
    assert p.checklist
    assert any("21 CFR" in (c.reference or "") for c in p.checklist)


def test_ema_and_cap_clia_present() -> None:
    codes = {p.code for p in list_profiles()}
    assert {"fda_ind", "ema", "cap_clia"}.issubset(codes)


def test_unknown_profile_raises() -> None:
    with pytest.raises(ProfileNotFoundError):
        load_profile("martian_ind")
