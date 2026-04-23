/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side helper for reviewer-ready language generation.
 *
 * Design:
 *  - NEVER call Gemini (or any LLM) directly from the browser — that leaks the API key.
 *  - The client POSTs the SEP to /api/enhance, which is proxied to the local
 *    server (frontend/server/index.ts). The server holds the API key.
 *  - If the server is not running OR no key is configured, the server responds
 *    with a deterministic template-rendered narrative. The UI never fails.
 *
 * This keeps the build 100% free (no required paid API calls) while preserving
 * the optional LLM enhancement path for regulated deployments.
 */

import type {StatisticalEvidencePackage} from '../types';

export interface EnhanceResponse {
  language: string;
  source: 'template' | 'llm';
  warnings: string[];
}

export async function generateReviewerReadyLanguage(
  sep: Partial<StatisticalEvidencePackage>
): Promise<EnhanceResponse> {
  try {
    const res = await fetch('/api/enhance', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({sep}),
    });
    if (!res.ok) {
      throw new Error(`enhance endpoint returned ${res.status}`);
    }
    return (await res.json()) as EnhanceResponse;
  } catch (err) {
    // Fallback: render a deterministic summary entirely on the client so the UI
    // is never dependent on any external service or API key.
    return {
      language: renderTemplateLanguage(sep),
      source: 'template',
      warnings: [
        `Enhance endpoint unavailable (${(err as Error).message}). Using offline template.`,
      ],
    };
  }
}

function renderTemplateLanguage(sep: Partial<StatisticalEvidencePackage>): string {
  const p = sep.pipelineProvenance;
  const pipelineLine = p
    ? `**${p.pipelineName}** (v${p.version}), run ${new Date(p.timestamp).toISOString()} by \`${p.operator}\`.`
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
    '> No LLM was invoked for this narrative — output is reproducible byte-for-byte.',
    '',
    '## 1. Pipeline Provenance',
    pipelineLine,
    '',
    '## 2. Sample Exclusions (21 CFR Part 11)',
    exclusions || '*No exclusions on record.*',
    '',
    '## 3. Subgroup Consistency (ICH E9R1)',
    subgroups || '*No subgroup findings reported.*',
    '',
    '## 4. Regulatory Alignment',
    checklist || '*No checklist entries.*',
    '',
  ].join('\n');
}
