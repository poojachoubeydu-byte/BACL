# BCAL — BioCompliance Audit Layer

[![CI](https://github.com/poojachoubeydu-byte/BACL/actions/workflows/ci.yml/badge.svg)](https://github.com/poojachoubeydu-byte/BACL/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-88%25-brightgreen)](#)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](#)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)

**BCAL is an enterprise-grade BioCompliance engine.** It bridges the gap
between genomic research and IT audit rigor — turning opaque, notebook-driven
bioinformatics pipelines into defensible, regulator-ready evidence packages.

Target frameworks: **21 CFR Part 11** (electronic records & signatures),
**ICH E9R1** (statistical principles for clinical trials), **EMA** scientific
guidelines, and **CAP / CLIA** clinical-laboratory accreditation.

---

## The problem

Modern biomarker and clinical-omics pipelines produce defensible results only
if *every decision* is documented: which samples were excluded and why, which
tool versions ran, whether subgroup effects survive stratification. Auditors
routinely find pipelines that are technically correct but **unaccountable** —
the critical context is in notebooks, Slack threads, and operator memory
rather than a single reproducible record.

BCAL closes that gap. It attaches to a pipeline at the five decision points
where irreproducibility typically enters, and emits a cryptographically
sealed **Statistical Evidence Package (SEP)** that a regulator can verify
with a single command.

| Module | Role | Aligns with |
|---|---|---|
| **M1** Subgroup Consistency | Detects Simpson's-paradox reversal across strata | ICH E9R1 §5.2.3 |
| **M2** Exclusion Ledger | Forces signed, justified sample exclusions | 21 CFR 11.50 |
| **M3** Version Lock | Captures tool + parameter versions, hashes configs | 21 CFR 11.10(e) |
| **M4** Batch Effect Audit | PVCA-style variance partition + stratified PCA | GxP reproducibility |
| **M5** Outlier Ledger | Biological vs. technical classification with evidence | CAP GEN.41350 |

Outputs: a **SHA-256-sealed** SEP in JSON, Markdown, CSV, and PDF/HTML.

---

## Quick start

```bash
pip install -e ".[dev]"

# Build a SEP from a pipeline output directory
bcal audit \
    --path ./results/ \
    --profile fda_ind \
    --pipeline-name my-rnaseq \
    --pipeline-version 1.2.3 \
    --operator "$USER"

# Verify a SEP has not been tampered with
bcal verify audit_output/SEP-*.json
```

Or from Python:

```python
from bcal import Instrument
from bcal.modules import subgroup
from bcal.profiles import load_profile
from bcal.report import write_markdown

with Instrument("rnaseq-de", "2.4.1", operator="alice@lab") as inst:
    inst.hash_inputs(["results/*.fq.gz"])
    inst.capture_tool_version("pydantic")
    inst.add_subgroup_findings(
        subgroup.run(
            df, treatment_col="treatment", outcome_col="outcome",
            covariate_cols=["sex", "age_bucket"],
        )
    )
    inst.add_checklist_items(load_profile("fda_ind").checklist)
    sep = inst.seal()

write_markdown(sep, "audit_output/sep.md")
```

---

## Architecture

```
  ┌────────────────────────────────────────────────────┐
  │ ENTRY POINTS                                       │
  │ CLI · Nextflow · Snakemake · Jupyter · GH Actions  │
  └─────────────────────┬──────────────────────────────┘
                        │
  ┌─────────────────────▼──────────────────────────────┐
  │ INSTRUMENT LAYER (bcal.instrument)                 │
  │ • SHA-256 manifest hashing                         │
  │ • Tool version capture (importlib / subprocess)    │
  │ • Signed, timestamped decision log                 │
  └─────────────────────┬──────────────────────────────┘
                        │
  ┌─────────────────────▼──────────────────────────────┐
  │ AUDIT MODULES (bcal.modules)                       │
  │  [M1 subgroup] [M2 exclusions] [M3 version_lock]   │
  │  [M4 batch_audit]          [M5 outlier_ledger]     │
  └─────────────────────┬──────────────────────────────┘
                        │
  ┌─────────────────────▼──────────────────────────────┐
  │ STATISTICAL EVIDENCE PACKAGE (bcal.schema)         │
  │  • Pydantic-validated, schema-versioned, sealed    │
  │  • json · md · csv · pdf writers (bcal.report)     │
  └────────────────────────────────────────────────────┘
```

Directory layout:

```
bcal/                    Python package (schema, instrument, modules, report)
├── cli.py               Typer CLI (bcal audit|verify|seal|report|schema)
├── config/              Default config + regulatory_profiles/*.yaml
├── instrument.py        Context manager for building SEPs
├── modules/             M1–M5 audit engines
├── profiles.py          YAML profile loader
├── report/              JSON / Markdown / CSV / PDF writers
└── schema.py            Pydantic SEP schema (source of truth)

tests/                   61 tests, 88% coverage (pytest)
nextflow/bcal_module.nf  Drop-in Nextflow process
snakemake/bcal_rule.smk  Snakemake rule template
notebooks/               Jupyter demo
.github/workflows/       CI + release + Pages deploy
frontend/                Enterprise dashboard (Vite / React 19)
```

---

## Engineering guarantees

- **Deterministic output.** Every writer produces byte-identical output for
  identical input — verified by golden-file tests.
- **Tamper-evident seals.** A SHA-256 seal over the canonical JSON of a SEP
  makes any post-hoc modification detectable by `bcal verify`.
- **No external calls on the critical path.** The default reviewer-ready
  narrative is generated from a Jinja2 template. Optional AI-assisted
  narrative is an opt-in feature that routes through a server proxy — the
  client bundle never ships credentials.
- **PDF rendering.** Uses WeasyPrint if installed (`pip install bcal[pdf]`);
  otherwise falls back to a styled HTML document — no LaTeX toolchain
  required in CI.

---

## Development

```bash
pip install -e ".[dev]"
pytest                   # 61 tests, 88% coverage
ruff check bcal tests    # lint
mypy bcal                # strict type-check
```

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the workflow and
**[SECURITY.md](SECURITY.md)** for reporting vulnerabilities.

---

## License

Apache-2.0. See [LICENSE](LICENSE).
