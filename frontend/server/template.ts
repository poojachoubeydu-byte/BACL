/**
 * Deterministic fallback narrative — the default server response.
 * Same shape as the client-side fallback in `src/services/geminiService.ts`
 * so a disconnected server and a zero-key server produce identical output.
 */

import type {EnhancePayload} from './types.js';

export function renderTemplateLanguage(
  sep: EnhancePayload['sep']
): string {
  const p = sep.pipelineProvenance;
  const pipelineLine = p
    ? `**${p.pipelineName}** (v${p.version}), run ${p.timestamp} by \`${p.operator}\`.`
    : '*Pipeline provenance not supplied.*';

  const exclusions = (sep.decisionLog ?? [])
    .map(
      (d) =>
        `- **${d.sampleId}** — ${d.reason} (signed by \`${d.operatorId}\` at ${d.timestamp})\n  > ${d.justification}`
    )
    .join('\n');

  const subgroups = (sep.subgroupFindings ?? [])
    .map(
      (s) =>
        `- **${s.subgroupId}** (${s.trait}): baseline ${s.baseline}, effect ${s.effect} — *${s.status}*`
    )
    .join('\n');

  const checklist = (sep.regulatoryChecklist ?? [])
    .map((c) => `- \`${c.status.toUpperCase().padEnd(7)}\` ${c.item}`)
    .join('\n');

  return [
    '# Reviewer-Ready Statistical Evidence Summary',
    '',
    '> Generated deterministically from the BCAL Statistical Evidence Package (SEP).',
    '> No LLM was invoked — output is reproducible byte-for-byte.',
    '',
    '## 1. Pipeline Provenance',
    pipelineLine,
    '',
    '## 2. Sample Exclusions (21 CFR Part 11)',
    exclusions || '*No exclusions on record.*',
    '',
    "## 3. Subgroup Consistency (ICH E9R1)",
    subgroups || '*No subgroup findings reported.*',
    '',
    '## 4. Regulatory Alignment',
    checklist || '*No checklist entries.*',
    '',
  ].join('\n');
}
