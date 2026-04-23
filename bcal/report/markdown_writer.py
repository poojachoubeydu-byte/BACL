"""Deterministic Markdown renderer for the SEP.

Uses Jinja2 with a frozen seed so output is byte-identical across runs.
"""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from bcal import __version__
from bcal.schema import StatisticalEvidencePackage

_TEMPLATE_DIR = Path(__file__).parent / "templates"


def _env() -> Environment:
    # autoescape=False for markdown output; StrictUndefined catches template bugs
    # at render time instead of silently rendering "None".
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
        autoescape=select_autoescape(disabled_extensions=("md.j2",), default=False),
    )
    return env


def render_markdown(sep: StatisticalEvidencePackage) -> str:
    """Render the SEP to a Markdown string."""
    tmpl = _env().get_template("sep.md.j2")
    return tmpl.render(sep=sep, bcal_version=__version__)


def write_markdown(
    sep: StatisticalEvidencePackage,
    path: str | Path,
) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_markdown(sep), encoding="utf-8")
    return out
