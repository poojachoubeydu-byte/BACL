"""Report writers — determinism and round-tripping."""

from __future__ import annotations

from pathlib import Path

from bcal.report import render_markdown, write_csv, write_json, write_markdown, write_pdf
from bcal.schema import StatisticalEvidencePackage


def test_json_roundtrip(minimal_sep: StatisticalEvidencePackage, tmp_path: Path) -> None:
    out = write_json(minimal_sep, tmp_path / "sep.json")
    restored = StatisticalEvidencePackage.from_json(out)
    assert restored.seal == minimal_sep.seal
    assert restored.id == minimal_sep.id


def test_markdown_deterministic(minimal_sep: StatisticalEvidencePackage) -> None:
    a = render_markdown(minimal_sep)
    b = render_markdown(minimal_sep)
    assert a == b
    assert minimal_sep.id in a
    assert minimal_sep.pipeline_provenance.sha256 in a


def test_markdown_writes_file(
    minimal_sep: StatisticalEvidencePackage, tmp_path: Path
) -> None:
    path = write_markdown(minimal_sep, tmp_path / "sep.md")
    assert path.exists()
    assert path.read_text(encoding="utf-8").startswith("# Statistical Evidence Package")


def test_csv_has_headers(minimal_sep: StatisticalEvidencePackage, tmp_path: Path) -> None:
    path = write_csv(minimal_sep, tmp_path / "findings.csv")
    first_line = path.read_text(encoding="utf-8-sig").splitlines()[0]
    assert first_line.startswith("finding_id,")


def test_pdf_or_html_fallback(
    minimal_sep: StatisticalEvidencePackage, tmp_path: Path
) -> None:
    path, fmt = write_pdf(minimal_sep, tmp_path / "sep.pdf")
    assert fmt in {"pdf", "html"}
    assert path.exists()
    assert path.stat().st_size > 0


def test_seal_survives_roundtrip(
    minimal_sep: StatisticalEvidencePackage, tmp_path: Path
) -> None:
    out = write_json(minimal_sep, tmp_path / "sep.json")
    restored = StatisticalEvidencePackage.from_json(out)
    assert restored.seal == restored.compute_seal()
