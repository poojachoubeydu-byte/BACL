/**
 * Server-side types mirroring the frontend's SEP shape.
 * Kept as a minimal, forgiving surface — the canonical schema lives in
 * `bcal/schema.py` (Python) and `src/types.ts` (frontend).
 */

export interface EnhancePayload {
  sep: Record<string, unknown> & {
    id?: string;
    pipelineProvenance?: {
      pipelineName?: string;
      version?: string;
      operator?: string;
      timestamp?: string;
      sha256?: string;
    };
    decisionLog?: Array<{
      sampleId: string;
      reason: string;
      operatorId: string;
      timestamp: string;
      justification: string;
    }>;
    subgroupFindings?: Array<{
      subgroupId: string;
      trait: string;
      baseline: number;
      effect: number;
      status: string;
    }>;
    regulatoryChecklist?: Array<{
      item: string;
      status: string;
    }>;
  };
}

export interface EnhanceResponse {
  language: string;
  source: 'template' | 'llm';
  warnings: string[];
}
