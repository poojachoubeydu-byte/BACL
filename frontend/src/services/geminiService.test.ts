import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {generateReviewerReadyLanguage} from './geminiService';
import {mockSEP} from './dataService';

describe('generateReviewerReadyLanguage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Each test starts with no fetch — we explicitly install behaviour below.
    globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('falls back to a deterministic template if the server is unreachable', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network down')
    );
    const result = await generateReviewerReadyLanguage(mockSEP);
    expect(result.source).toBe('template');
    expect(result.language).toContain('Reviewer-Ready Statistical Evidence Summary');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns server response when /api/enhance responds OK', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        language: '# Narrative from server',
        source: 'template',
        warnings: [],
      }),
    } as Response);
    const result = await generateReviewerReadyLanguage(mockSEP);
    expect(result.language).toBe('# Narrative from server');
    expect(result.source).toBe('template');
  });

  it('falls back on non-OK HTTP status', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const result = await generateReviewerReadyLanguage(mockSEP);
    expect(result.source).toBe('template');
  });
});
