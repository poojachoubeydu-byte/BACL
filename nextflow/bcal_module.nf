// BCAL — Nextflow drop-in module
//
// Adds Statistical Evidence Package generation as a post-processing step
// after your pipeline's main workflow. Consumes the pipeline's input file
// manifest + any sample-level exclusion metadata you already produce and
// emits a sealed SEP (JSON + MD + CSV + PDF).
//
// Usage in your main.nf:
//
//   include { BCAL_AUDIT } from './nextflow/bcal_module.nf'
//
//   workflow {
//       ...your existing pipeline...
//       BCAL_AUDIT(
//           input_manifest_ch,           // channel emitting one file manifest
//           exclusions_ch,               // channel of CSV(s) with exclusions
//           "my-pipeline",               // pipeline_name
//           "1.2.3",                     // pipeline_version
//           "fda_ind"                    // regulatory profile
//       )
//   }
//
// BCAL must be importable in the execution environment:
//   pip install bcal
// or use the published container image (see Dockerfile).

nextflow.enable.dsl=2

process BCAL_AUDIT {
    tag "${pipeline_name}/${pipeline_version}"
    publishDir "${params.outdir ?: 'audit_output'}/bcal", mode: 'copy'

    input:
        path(input_manifest)
        path(exclusions_csv)
        val(pipeline_name)
        val(pipeline_version)
        val(profile)

    output:
        path("*.json"), emit: json
        path("*.md"),   emit: markdown
        path("*.csv"),  emit: findings
        path("*.{pdf,html}"), emit: report
        path("bcal-audit.log"),  emit: log

    script:
    def operator = System.getenv('BCAL_OPERATOR') ?: System.getProperty('user.name') ?: 'nextflow'
    """
    set -euo pipefail

    bcal audit \\
        --path ${input_manifest} \\
        --profile ${profile} \\
        --pipeline-name ${pipeline_name} \\
        --pipeline-version ${pipeline_version} \\
        --operator ${operator} \\
        --out-dir . \\
        2>&1 | tee bcal-audit.log
    """

    stub:
    """
    touch SEP-STUB.json SEP-STUB.md SEP-STUB-findings.csv SEP-STUB.pdf bcal-audit.log
    """
}
