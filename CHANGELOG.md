# Changelog

All notable changes to BCAL are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-04-23

Initial release.

### Added

- **Python package** `bcal` with pydantic-v2 SEP schema (v1.0.0).
- **Instrument layer** — deterministic SHA-256 manifest hashing, tool-version
  capture, signed exclusion API, context-manager ergonomics.
- **M1 Subgroup Consistency** — Simpson's-paradox detection across strata
  with sign-reversal classification and magnitude-ratio warning threshold.
- **M2 Exclusion Ledger** — 21 CFR Part 11-aligned validation (≥20-char
  justification, required operator identity, UTC timestamps).
- **M3 Version Lock** — `importlib.metadata` / `subprocess` / manual
  provenance, deterministic parameter-dict hashing, required-tools checklist.
- **M4 Batch Effect Audit** — PVCA-approximated variance partition using
  top-k PCA R², seeded and deterministic.
- **M5 Outlier Ledger** — MAD-based modified z-score screening with
  biological/technical/unclassified classification and mandatory evidence.
- **Report writers** — JSON (sort-keyed), Markdown (Jinja2), CSV
  (findings table), PDF (WeasyPrint) with HTML fallback.
- **Regulatory profiles** — `fda_ind`, `ema`, `cap_clia` shipped with
  references to the originating CFR / ICH / EMA clauses.
- **CLI** (`bcal audit | verify | seal | report | schema | profiles`) via
  Typer with rich output.
- **Integration templates** — Nextflow process, Snakemake rule, Jupyter
  demo notebook, GitHub Actions CI + release workflows.
- **Frontend dashboard** — Vite/React UI with the soft ivory/cream/gold
  palette; API-key-free zero-cost default mode; optional LLM-enhanced
  narrative via a server proxy that never exposes the key client-side.
- **Tests** — 61 pytest cases, 88% coverage, deterministic golden-file
  tests for report writers.

### Security

- Removed the pre-existing API-key leak (`GEMINI_API_KEY` was being inlined
  into the Vite bundle).
- Removed a hardcoded personal email address from the demo SEP fixture.
- Fixed an invalid `gemini-3-flash-preview` model ID that caused every
  "Generate" click to error.
