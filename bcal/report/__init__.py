"""SEP report generators (JSON, Markdown, CSV, PDF).

Each writer is a pure function — ``write(sep, path)`` — that produces a
deterministic output for a given input SEP. Determinism is load-bearing: CI
tests freeze golden outputs and regress if any writer introduces nondeterminism.
"""

from bcal.report.csv_writer import write_csv
from bcal.report.json_writer import write_json
from bcal.report.markdown_writer import render_markdown, write_markdown
from bcal.report.pdf_writer import write_pdf

__all__ = [
    "render_markdown",
    "write_csv",
    "write_json",
    "write_markdown",
    "write_pdf",
]
