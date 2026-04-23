# Contributing to BCAL

Thanks for considering a contribution. BCAL is a regulated-compliance tool;
the bar for changes touching the **schema**, **seal hashing**, or any audit
module is high — we prize determinism and traceability over novelty.

## Setup

```bash
git clone https://github.com/your-org/bcal
cd bcal
pip install -e ".[dev]"
pre-commit install           # optional but recommended
```

## Running the quality gates locally

```bash
ruff check bcal tests         # lint
ruff format --check .         # format check
mypy bcal                     # strict type-check
pytest                        # 61 tests, must stay >=75% coverage
```

## Change-kind guidance

### Bug fix in a module (M1–M5)
1. Add a failing test *first* — ideally against a deterministic fixture in
   `tests/conftest.py`.
2. Fix the code.
3. Update the module docstring if the contract changed.

### Adding a new regulatory profile
1. Drop a YAML file in `bcal/config/regulatory_profiles/`.
2. Cite the exact CFR / ICH / EMA clause in each `reference` field.
3. Add an entry to `tests/test_profiles.py`.

### Schema change
**Breaking changes require a major-version bump and a CHANGELOG entry.**

1. If a field is renamed, removed, or its semantics change: bump
   `SCHEMA_VERSION` in `bcal/schema.py`.
2. Update `src/types.ts` to mirror.
3. Run `bcal schema > docs/sep.schema.json` and commit.
4. Add a golden-file test that a SEP emitted by the previous version fails
   validation (proving the version bump is meaningful).

### Seal hashing
**Do not touch `to_canonical_json()` lightly.** Any change there invalidates
every previously-emitted SEP. If you must:

1. Open an issue explaining why.
2. Provide a migration path that preserves verifiability of old seals.

## Commit message style

Short imperative subject (≤72 chars), optional body explaining *why* not *what*.

```
M2: reject justifications shorter than 20 chars

21 CFR 11.50 requires meaningful signer attribution. A bare "failed QC"
string does not satisfy intent-to-sign.
```

## Pull requests

- One logical change per PR.
- All CI must be green (ruff, mypy, pytest).
- Link the CFR / ICH clause when adding checklist items or validation rules.
- Screenshots for frontend changes; note the a11y impact.
