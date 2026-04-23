"""CLI smoke tests — exercise entry points without depending on real pipelines."""

from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from bcal.cli import app
from bcal.schema import StatisticalEvidencePackage

runner = CliRunner()


def test_version() -> None:
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert result.output.strip()


def test_schema_emits_valid_json() -> None:
    result = runner.invoke(app, ["schema"])
    assert result.exit_code == 0
    data = json.loads(result.output)
    assert data["title"] == "StatisticalEvidencePackage"


def test_profiles_listing() -> None:
    result = runner.invoke(app, ["profiles"])
    assert result.exit_code == 0
    assert "fda_ind" in result.output


def test_seal_and_verify(
    minimal_sep: StatisticalEvidencePackage, tmp_path: Path
) -> None:
    sep_path = tmp_path / "sep.json"
    minimal_sep.to_json(sep_path)
    seal_out = tmp_path / "sealed.json"
    r1 = runner.invoke(app, ["seal", str(sep_path), "--out", str(seal_out)])
    assert r1.exit_code == 0
    r2 = runner.invoke(app, ["verify", str(seal_out)])
    assert r2.exit_code == 0, r2.output


def test_verify_detects_tamper(
    minimal_sep: StatisticalEvidencePackage, tmp_path: Path
) -> None:
    sep_path = tmp_path / "sep.json"
    minimal_sep.to_json(sep_path)
    raw = json.loads(sep_path.read_text())
    raw["id"] = "TAMPERED"
    sep_path.write_text(json.dumps(raw))
    result = runner.invoke(app, ["verify", str(sep_path)])
    assert result.exit_code == 2
    assert "MISMATCH" in result.output


def test_report_regenerates(
    minimal_sep: StatisticalEvidencePackage, tmp_path: Path
) -> None:
    sep_path = tmp_path / "sep.json"
    minimal_sep.to_json(sep_path)
    out_dir = tmp_path / "out"
    result = runner.invoke(app, ["report", str(sep_path), "--out-dir", str(out_dir)])
    assert result.exit_code == 0, result.output
    assert (out_dir / f"{minimal_sep.id}.json").exists()
    assert (out_dir / f"{minimal_sep.id}.md").exists()
