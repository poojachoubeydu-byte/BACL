/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Demo-mode fixtures. Used only when the backend is not connected.
 * No PII, no real credentials, no real pipeline fingerprints.
 */

import type {StatisticalEvidencePackage, PCAPoint} from '../types';

export const mockSEP: StatisticalEvidencePackage = {
  id: 'SEP-DEMO-0001',
  schemaVersion: '1.0.0',
  pipelineProvenance: {
    pipelineName: 'rnaseq-differential-expression',
    version: '2.4.1',
    operator: 'demo-operator',
    timestamp: '2026-04-23T05:53:57Z',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    toolVersions: {
      deseq2: '1.38.3',
      salmon: '1.10.2',
      fastqc: '0.12.1',
    },
    referenceGenome: 'GRCh38.p14',
    annotationVersion: 'GENCODE 44',
  },
  decisionLog: [
    {
      sampleId: 'S-102',
      reason: 'Low sequencing depth (<5M reads)',
      operatorId: 'auto-qc',
      timestamp: '2026-04-23T05:40:00Z',
      justification:
        'Insufficient coverage for reliable transcript-level expression estimation (threshold: 5M uniquely-mapped reads).',
      evidenceRefs: ['fastqc:S-102.html', 'multiqc:general_stats'],
    },
    {
      sampleId: 'S-205',
      reason: 'High duplication rate (>60%)',
      operatorId: 'demo-operator',
      timestamp: '2026-04-23T05:45:00Z',
      justification:
        'Manual review confirmed library complexity artefact; exclusion prevents bias in median-of-ratios normalization.',
      evidenceRefs: ['picard:MarkDuplicates:S-205.txt'],
    },
  ],
  subgroupFindings: [
    {
      subgroupId: 'COHORT-A',
      trait: 'treatment_response',
      baseline: 0.12,
      effect: 0.85,
      status: 'consistent',
      nPooled: 240,
      nStratum: 120,
    },
    {
      subgroupId: 'SEX-MALE',
      trait: 'survival',
      baseline: 0.05,
      effect: -0.12,
      status: 'paradox',
      nPooled: 240,
      nStratum: 118,
    },
    {
      subgroupId: 'AGE-GT65',
      trait: 'toxicity',
      baseline: 0.18,
      effect: 0.22,
      status: 'warning',
      nPooled: 240,
      nStratum: 74,
    },
  ],
  regulatoryChecklist: [
    {item: 'Traceability of method versions (ICH E9R1)', status: 'ok'},
    {item: 'Electronic signature for exclusions (21 CFR Part 11)', status: 'ok'},
    {item: "Simpson's Paradox audit of primary endpoint", status: 'warning'},
    {item: 'SHA-256 integrity check of all raw input FASTQs', status: 'ok'},
    {item: 'Method lock for DESeq2 parameters', status: 'ok'},
  ],
  batchAudit: {
    varianceRatio: 0.12,
    principalComponents: [],
  },
  reviewerReadyLanguage: '',
};

export const mockPCAData: PCAPoint[] = [
  {pc1: -10, pc2: 5, batch: 'Batch_1', subtype: 'Resistant'},
  {pc1: -8, pc2: 6, batch: 'Batch_1', subtype: 'Resistant'},
  {pc1: -12, pc2: 4, batch: 'Batch_1', subtype: 'Resistant'},
  {pc1: 15, pc2: -2, batch: 'Batch_2', subtype: 'Sensitive'},
  {pc1: 14, pc2: -3, batch: 'Batch_2', subtype: 'Sensitive'},
  {pc1: 16, pc2: -1, batch: 'Batch_2', subtype: 'Sensitive'},
  {pc1: 2, pc2: -8, batch: 'Batch_1', subtype: 'Sensitive'},
  {pc1: 1, pc2: -9, batch: 'Batch_1', subtype: 'Sensitive'},
];
