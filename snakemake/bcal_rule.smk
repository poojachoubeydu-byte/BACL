# BCAL — Snakemake rule template
#
# Include in your main Snakefile:
#
#   include: "snakemake/bcal_rule.smk"
#
#   rule all:
#       input:
#           rules.bcal_audit.output.json,
#
# Configure in config.yaml:
#
#   bcal:
#     pipeline_name: my-pipeline
#     pipeline_version: 1.2.3
#     profile: fda_ind        # fda_ind | ema | cap_clia
#     input_root: results/
#     output_dir: audit_output/
#     operator: "{USER}"      # {USER} is expanded from env at runtime

import os

_bcal_cfg = config.get("bcal", {})
_BCAL_INPUT   = _bcal_cfg.get("input_root", "results")
_BCAL_OUT     = _bcal_cfg.get("output_dir", "audit_output")
_BCAL_PROFILE = _bcal_cfg.get("profile", "fda_ind")
_BCAL_NAME    = _bcal_cfg.get("pipeline_name", "unknown-pipeline")
_BCAL_VERSION = _bcal_cfg.get("pipeline_version", "0.0.0")
_BCAL_OPERATOR = _bcal_cfg.get("operator", "{USER}").replace(
    "{USER}", os.environ.get("USER", "snakemake")
)


rule bcal_audit:
    """Produce a sealed Statistical Evidence Package from pipeline outputs."""
    input:
        pipeline_root = _BCAL_INPUT,
    output:
        json     = f"{_BCAL_OUT}/bcal-sep.json",
        markdown = f"{_BCAL_OUT}/bcal-sep.md",
        findings = f"{_BCAL_OUT}/bcal-sep-findings.csv",
    params:
        profile  = _BCAL_PROFILE,
        name     = _BCAL_NAME,
        version  = _BCAL_VERSION,
        operator = _BCAL_OPERATOR,
        out_dir  = _BCAL_OUT,
    log:
        f"{_BCAL_OUT}/bcal-audit.log",
    shell:
        """
        set -euo pipefail
        bcal audit \
            --path {input.pipeline_root} \
            --profile {params.profile} \
            --pipeline-name {params.name} \
            --pipeline-version {params.version} \
            --operator {params.operator} \
            --out-dir {params.out_dir} \
            2>&1 | tee {log}
        """
