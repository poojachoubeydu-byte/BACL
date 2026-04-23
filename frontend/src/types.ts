/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TypeScript mirror of bcal.schema (Pydantic). Keep in sync.
 * Source of truth: bcal/schema.py
 */

export type RegulatoryStatus = 'ok' | 'missing' | 'warning';
export type SubgroupStatus = 'consistent' | 'paradox' | 'warning';
export type OutlierClass = 'biological' | 'technical' | 'unclassified';

export interface PipelineMetadata {
  pipelineName: string;
  version: string;
  operator: string;
  timestamp: string; // ISO 8601
  sha256: string;
  toolVersions?: Record<string, string>;
  referenceGenome?: string;
  annotationVersion?: string;
}

export interface SubgroupAnalysis {
  subgroupId: string;
  trait: string;
  baseline: number;
  effect: number;
  status: SubgroupStatus;
  nPooled?: number;
  nStratum?: number;
}

export interface ExclusionRecord {
  sampleId: string;
  reason: string;
  operatorId: string;
  timestamp: string;
  justification: string;
  evidenceRefs?: string[];
}

export interface PCAPoint {
  pc1: number;
  pc2: number;
  batch: string;
  subtype: string;
}

export interface BatchEffectAudit {
  varianceRatio: number;
  principalComponents: PCAPoint[];
}

export interface OutlierRecord {
  sampleId: string;
  classification: OutlierClass;
  zScore?: number;
  evidence: string;
  reviewedBy?: string;
}

export interface ChecklistItem {
  item: string;
  status: RegulatoryStatus;
  reference?: string; // e.g. "21 CFR 11.10(e)"
}

export interface StatisticalEvidencePackage {
  id: string;
  schemaVersion: string;
  pipelineProvenance: PipelineMetadata;
  decisionLog: ExclusionRecord[];
  subgroupFindings: SubgroupAnalysis[];
  batchAudit?: BatchEffectAudit;
  outlierLedger?: OutlierRecord[];
  regulatoryChecklist: ChecklistItem[];
  reviewerReadyLanguage: string;
}
