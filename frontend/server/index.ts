/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BCAL server proxy.
 *
 * Responsibilities:
 *  - Serve `/api/enhance` with either (a) a deterministic template narrative,
 *    or (b) an LLM-generated one if GEMINI_API_KEY is set AND the request
 *    opts in via `?mode=llm`.
 *  - Never expose the API key to the browser.
 *  - Never call the LLM by default — ensures zero-cost operation out of the box.
 *
 * Run: `npm run dev:server` (or via `npm run dev` which runs both).
 */

import 'dotenv/config';
import express, {type Request, type Response} from 'express';
import {renderTemplateLanguage} from './template.js';
import type {EnhancePayload, EnhanceResponse} from './types.js';

const app = express();
app.use(express.json({limit: '1mb'}));

// Basic request hygiene.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    llmConfigured: Boolean(process.env.GEMINI_API_KEY),
    defaultMode: 'template',
  });
});

app.post('/api/enhance', async (req: Request, res: Response) => {
  const payload = req.body as EnhancePayload;
  const mode = String(req.query['mode'] ?? 'template');

  if (!payload?.sep) {
    res.status(400).json({error: 'Missing `sep` in request body.'});
    return;
  }

  if (mode === 'llm' && process.env.GEMINI_API_KEY) {
    try {
      const language = await callGemini(payload);
      const result: EnhanceResponse = {language, source: 'llm', warnings: []};
      res.json(result);
      return;
    } catch (err) {
      const result: EnhanceResponse = {
        language: renderTemplateLanguage(payload.sep),
        source: 'template',
        warnings: [
          `LLM call failed (${(err as Error).message}); served deterministic template instead.`,
        ],
      };
      res.json(result);
      return;
    }
  }

  // Default path — no LLM call, no cost.
  const result: EnhanceResponse = {
    language: renderTemplateLanguage(payload.sep),
    source: 'template',
    warnings: [],
  };
  res.json(result);
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[bcal-server] listening on http://localhost:${port}`);
});

async function callGemini(payload: EnhancePayload): Promise<string> {
  // Lazy import so the SDK is only loaded when actually needed.
  const {GoogleGenAI} = await import('@google/genai');
  const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY!});
  const sep = payload.sep;
  const prompt = [
    'You are a Senior Regulatory Statistician producing a reviewer-ready',
    'Statistical Evidence Summary for an FDA IND submission. Use formal',
    'language. Explicitly reference 21 CFR Part 11 and ICH E9R1 where',
    'appropriate. Output Markdown. Do not invent data.',
    '',
    `SEP JSON:\n${JSON.stringify(sep, null, 2)}`,
  ].join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text ?? renderTemplateLanguage(sep);
}
