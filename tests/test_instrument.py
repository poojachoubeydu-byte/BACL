"""Instrument — manifest hashing, exclusion capture, seal correctness."""

from __future__ import annotations

from pathlib import Path

import pytest

from bcal.instrument import Instrument, audit


def _make_inputs(dir_: Path, n: int = 3) -> list[Path]:
    paths: list[Path] = []
    for i in range(n):
        p = dir_ / f"file_{i}.txt"
        p.write_text(f"content-{i}")
        paths.append(p)
    return paths


def test_hash_inputs_rejects_empty(tmp_path: Path) -> None:
    empty = tmp_path / "empty"
    empty.mkdir()
    inst = Instrument("p", "1", "op")
    with pytest.raises(FileNotFoundError):
        inst.hash_inputs([str(empty / "*")])


def test_hash_inputs_deterministic(tmp_path: Path) -> None:
    _make_inputs(tmp_path)
    a = Instrument("p", "1", "op").hash_inputs([str(tmp_path / "*.txt")])
    b = Instrument("p", "1", "op").hash_inputs([str(tmp_path / "*.txt")])
    assert a == b
    # Different content → different digest.
    (tmp_path / "file_0.txt").write_text("mutated")
    c = Instrument("p", "1", "op").hash_inputs([str(tmp_path / "*.txt")])
    assert a != c


def test_hash_inputs_order_independent(tmp_path: Path) -> None:
    _make_inputs(tmp_path, n=5)
    a = Instrument("p", "1", "op").hash_inputs([str(tmp_path / "*.txt")])
    # Re-glob gives the same input set even if filesystem order differs.
    b = Instrument("p", "1", "op").hash_inputs(
        [str(tmp_path / "file_4.txt"), str(tmp_path / "file_*.txt")]
    )
    assert a == b


def test_seal_requires_manifest() -> None:
    with pytest.raises(RuntimeError):
        Instrument("p", "1", "op").seal()


def test_set_manifest_digest_validates() -> None:
    inst = Instrument("p", "1", "op")
    with pytest.raises(ValueError):
        inst.set_manifest_digest("garbage")
    inst.set_manifest_digest("0" * 64)


def test_exclusion_roundtrip() -> None:
    inst = Instrument("p", "1", "op")
    inst.set_manifest_digest("0" * 64)
    inst.exclude(
        sample_id="S-1",
        reason="low depth",
        operator_id="qc",
        justification="insufficient coverage for transcript estimation",
    )
    sep = inst.seal()
    assert len(sep.decision_log) == 1
    assert sep.decision_log[0].sample_id == "S-1"


def test_seal_is_valid() -> None:
    sep = audit(
        pipeline_name="p", version="1", operator="op", manifest_digest="f" * 64
    )
    assert sep.seal == sep.compute_seal()


def test_audit_xor_inputs() -> None:
    with pytest.raises(ValueError):
        audit(pipeline_name="p", version="1", operator="op")
    with pytest.raises(ValueError):
        audit(
            pipeline_name="p", version="1", operator="op",
            input_patterns=["a"], manifest_digest="0" * 64,
        )
