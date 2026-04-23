/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {JSX} from 'react';
import {useCallback, useRef, useState} from 'react';
import {
  ShieldCheck,
  FlaskConical,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Github,
  Terminal,
  Zap,
  Lock,
} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';
import type {StatisticalEvidencePackage} from './types';
import {mockSEP, mockPCAData} from './services/dataService';
import {generateReviewerReadyLanguage} from './services/geminiService';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

type TabKey = 'audit' | 'sep' | 'instrument';

// Soft-palette tokens — kept near the component so they're easy to tune.
// Using CSS vars defined in index.css wherever possible; Tailwind arbitrary
// values fall back to hex for colors that need to mix with Tailwind utilities.
const palette = {
  ivory: '#FAF7F0',
  cream: '#F5EFE4',
  parchment: '#F2ECE0',
  gold: '#C9A65B',
  goldSoft: '#E6D49A',
  goldDeep: '#A07833',
  warm100: '#EFECE4',
  warm200: '#E3DFD6',
  warm300: '#CCC6B8',
  warm400: '#A8A294',
  warm500: '#8A857C',
  warm700: '#5A5751',
  warm800: '#47453F',
  warm900: '#3C3A36',
  sage: '#6F8A69',
  rose: '#B57670',
} as const;

export default function App(): JSX.Element {
  const [sep, setSep] = useState<StatisticalEvidencePackage>(mockSEP);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('audit');
  const [lastSource, setLastSource] = useState<'template' | 'llm' | null>(null);

  const sessionId = useRef(
    Math.random().toString(36).slice(2, 9).toUpperCase()
  ).current;

  const handleGenerateReport = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await generateReviewerReadyLanguage(sep);
      setSep((prev) => ({...prev, reviewerReadyLanguage: res.language}));
      setLastSource(res.source);
    } finally {
      setIsGenerating(false);
    }
  }, [sep]);

  const handleExportJSON = useCallback(() => {
    downloadBlob(
      new Blob([JSON.stringify(sep, null, 2)], {type: 'application/json'}),
      `${sep.id}.json`
    );
  }, [sep]);

  const handleExportMarkdown = useCallback(() => {
    const md =
      sep.reviewerReadyLanguage ||
      '# No reviewer-ready language generated yet.\n\nClick *Generate* on the Evidence tab.';
    downloadBlob(new Blob([md], {type: 'text/markdown'}), `${sep.id}.md`);
  }, [sep]);

  const exclusionCount = sep.decisionLog.length;

  return (
    <div
      className="min-h-screen font-sans"
      style={{background: palette.ivory, color: palette.warm900}}
    >
      <nav
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: 'rgba(250, 247, 240, 0.85)',
          borderBottom: `1px solid ${palette.warm200}`,
        }}
        aria-label="Primary"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${palette.goldSoft}, ${palette.gold})`,
                  boxShadow: `0 2px 8px ${palette.goldSoft}66`,
                }}
                aria-hidden="true"
              >
                <ShieldCheck className="w-6 h-6" style={{color: palette.warm900}} />
              </div>
              <div>
                <h1
                  className="font-bold text-lg tracking-tight uppercase"
                  style={{color: palette.warm900}}
                >
                  BCAL
                </h1>
                <p
                  className="text-[10px] font-mono font-medium -mt-1 tracking-widest uppercase"
                  style={{color: palette.warm500}}
                >
                  BioCompliance Audit Layer
                </p>
              </div>
            </div>

            <div
              className="hidden md:flex items-center gap-1 p-1 rounded-full"
              style={{
                background: palette.cream,
                border: `1px solid ${palette.warm200}`,
              }}
              role="tablist"
              aria-label="BCAL sections"
            >
              <TabButton
                active={activeTab === 'audit'}
                onClick={() => setActiveTab('audit')}
                controls="panel-audit"
              >
                Audit Trail
              </TabButton>
              <TabButton
                active={activeTab === 'sep'}
                onClick={() => setActiveTab('sep')}
                controls="panel-sep"
              >
                Evidence (SEP)
              </TabButton>
              <TabButton
                active={activeTab === 'instrument'}
                onClick={() => setActiveTab('instrument')}
                controls="panel-instrument"
              >
                Instrument
              </TabButton>
            </div>

            <div className="flex items-center gap-4">
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: palette.cream,
                  color: palette.goldDeep,
                  border: `1px solid ${palette.goldSoft}`,
                }}
                aria-live="polite"
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{background: palette.gold}}
                  aria-hidden="true"
                />
                Demo Mode
              </div>
              <a
                href="https://github.com/"
                className="rounded transition-colors"
                style={{color: palette.warm500}}
                aria-label="Open project on GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'audit' && (
            <motion.div
              key="audit"
              id="panel-audit"
              role="tabpanel"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Pipeline Root" value={sep.pipelineProvenance.pipelineName} icon={Database} mono />
                <StatCard label="Schema Version" value={sep.schemaVersion} icon={ShieldCheck} highlight />
                <StatCard label="Audit Nodes" value="5 active" icon={Activity} />
                <StatCard
                  label="Exclusions"
                  value={exclusionCount.toString()}
                  icon={AlertTriangle}
                  warning={exclusionCount > 0}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section
                  className="lg:col-span-2 rounded-2xl p-6 shadow-sm"
                  style={{
                    background: '#ffffff',
                    border: `1px solid ${palette.warm200}`,
                  }}
                  aria-labelledby="heading-m4"
                >
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2
                        id="heading-m4"
                        className="font-bold flex items-center gap-2 uppercase tracking-wide text-sm"
                        style={{color: palette.warm900}}
                      >
                        <Activity className="w-4 h-4" style={{color: palette.gold}} aria-hidden="true" />
                        [M4] Batch Effect Audit
                      </h2>
                      <p className="text-xs mt-1" style={{color: palette.warm500}}>
                        PCA stratified by known batch variables and disease subtype.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className="text-[10px] px-2 py-1 rounded font-mono"
                        style={{background: palette.cream, color: palette.warm700}}
                      >
                        PVCA: {sep.batchAudit?.varianceRatio ?? '—'}
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-[300px] w-full"
                    role="img"
                    aria-label="PCA scatter plot of samples by batch"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{top: 20, right: 20, bottom: 20, left: 20}}>
                        <XAxis type="number" dataKey="pc1" name="PC1" stroke={palette.warm500} fontSize={10} tickLine={false} />
                        <YAxis type="number" dataKey="pc2" name="PC2" stroke={palette.warm500} fontSize={10} tickLine={false} />
                        <ZAxis type="category" dataKey="subtype" name="Subtype" />
                        <Tooltip
                          cursor={{strokeDasharray: '3 3'}}
                          contentStyle={{
                            borderRadius: '12px',
                            border: `1px solid ${palette.warm200}`,
                            background: palette.cream,
                            boxShadow: '0 4px 12px rgba(60,58,54,0.08)',
                            fontSize: '11px',
                            color: palette.warm900,
                          }}
                        />
                        <Scatter name="Samples" data={mockPCAData}>
                          {mockPCAData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.batch === 'Batch_1' ? palette.gold : palette.sage}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div
                    className="mt-4 flex gap-4 text-[10px] font-mono"
                    style={{color: palette.warm500}}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{background: palette.gold}}
                        aria-hidden="true"
                      />
                      Batch 1
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{background: palette.sage}}
                        aria-hidden="true"
                      />
                      Batch 2
                    </div>
                  </div>
                </section>

                <section
                  className="rounded-2xl p-6 shadow-sm"
                  style={{background: '#ffffff', border: `1px solid ${palette.warm200}`}}
                  aria-labelledby="heading-checklist"
                >
                  <h2
                    id="heading-checklist"
                    className="font-bold flex items-center gap-2 uppercase tracking-wide text-sm mb-6"
                    style={{color: palette.warm900}}
                  >
                    <Terminal className="w-4 h-4" style={{color: palette.goldDeep}} aria-hidden="true" />
                    Compliance Checklist
                  </h2>
                  <ul className="space-y-4">
                    {sep.regulatoryChecklist.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        {item.status === 'ok' ? (
                          <CheckCircle2
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{color: palette.sage}}
                            aria-label="passing"
                          />
                        ) : (
                          <AlertTriangle
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{color: palette.goldDeep}}
                            aria-label="attention required"
                          />
                        )}
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: item.status === 'ok' ? palette.warm700 : palette.goldDeep,
                          }}
                        >
                          {item.item}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() =>
                      alert('Lock audit state: available in bcal CLI (`bcal seal`)')
                    }
                    className="w-full mt-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    style={{
                      background: `linear-gradient(135deg, ${palette.gold}, ${palette.goldDeep})`,
                      color: palette.ivory,
                    }}
                  >
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    Lock Audit State
                  </button>
                </section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section
                  className="rounded-2xl overflow-hidden shadow-sm"
                  style={{background: '#ffffff', border: `1px solid ${palette.warm200}`}}
                  aria-labelledby="heading-m2"
                >
                  <div
                    className="px-6 py-4 flex justify-between items-center"
                    style={{
                      background: palette.cream,
                      borderBottom: `1px solid ${palette.warm200}`,
                    }}
                  >
                    <h2
                      id="heading-m2"
                      className="font-bold flex items-center gap-2 uppercase tracking-wide text-sm"
                      style={{color: palette.warm900}}
                    >
                      <AlertTriangle
                        className="w-4 h-4"
                        style={{color: palette.goldDeep}}
                        aria-hidden="true"
                      />
                      [M2] Exclusion Ledger
                    </h2>
                    <span className="text-[10px] font-mono" style={{color: palette.warm500}}>
                      21 CFR Part 11
                    </span>
                  </div>
                  <ul style={{background: '#ffffff'}}>
                    {sep.decisionLog.map((log, idx) => (
                      <li
                        key={idx}
                        className="p-4 transition-colors"
                        style={{
                          borderBottom:
                            idx < sep.decisionLog.length - 1
                              ? `1px solid ${palette.warm100}`
                              : 'none',
                        }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{color: palette.goldDeep}}
                          >
                            {log.sampleId}
                          </span>
                          <time
                            dateTime={log.timestamp}
                            className="text-[10px]"
                            style={{color: palette.warm500}}
                          >
                            {new Date(log.timestamp).toLocaleString()}
                          </time>
                        </div>
                        <p
                          className="text-xs font-semibold mb-1"
                          style={{color: palette.warm900}}
                        >
                          {log.reason}
                        </p>
                        <p
                          className="text-[11px] italic"
                          style={{color: palette.warm700}}
                        >
                          "{log.justification}"
                        </p>
                        <div
                          className="mt-2 flex items-center gap-1 text-[9px] font-mono uppercase"
                          style={{color: palette.warm500}}
                        >
                          <Terminal className="w-3 h-3" aria-hidden="true" /> Signed by:{' '}
                          {log.operatorId}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section
                  className="rounded-2xl overflow-hidden shadow-sm"
                  style={{background: '#ffffff', border: `1px solid ${palette.warm200}`}}
                  aria-labelledby="heading-m1"
                >
                  <div
                    className="px-6 py-4"
                    style={{
                      background: palette.cream,
                      borderBottom: `1px solid ${palette.warm200}`,
                    }}
                  >
                    <h2
                      id="heading-m1"
                      className="font-bold flex items-center gap-2 uppercase tracking-wide text-sm"
                      style={{color: palette.warm900}}
                    >
                      <FlaskConical
                        className="w-4 h-4"
                        style={{color: palette.gold}}
                        aria-hidden="true"
                      />
                      [M1] Subgroup Consistency
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {sep.subgroupFindings.map((finding, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-4 p-3 rounded-xl"
                        style={{border: `1px solid ${palette.warm100}`}}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background:
                              finding.status === 'consistent'
                                ? '#EEF2EB'
                                : finding.status === 'paradox'
                                ? '#F6E4E2'
                                : palette.cream,
                            color:
                              finding.status === 'consistent'
                                ? palette.sage
                                : finding.status === 'paradox'
                                ? palette.rose
                                : palette.goldDeep,
                          }}
                          aria-label={`status ${finding.status}`}
                        >
                          {finding.status === 'consistent' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <AlertTriangle className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center whitespace-nowrap overflow-hidden">
                            <h3
                              className="text-xs font-bold uppercase truncate"
                              style={{color: palette.warm900}}
                            >
                              {finding.subgroupId}
                            </h3>
                            <span
                              className="text-[10px] font-mono px-1.5 rounded"
                              style={{background: palette.cream, color: palette.warm700}}
                            >
                              {finding.trait}
                            </span>
                          </div>
                          <div
                            className="mt-1 h-1.5 w-full rounded-full overflow-hidden"
                            style={{background: palette.warm100}}
                          >
                            <div
                              className="h-full transition-all duration-1000"
                              style={{
                                width: `${Math.min(100, Math.abs(finding.effect * 100))}%`,
                                background: `linear-gradient(90deg, ${palette.goldSoft}, ${palette.gold})`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className="text-xs font-bold"
                            style={{color: palette.warm900}}
                          >
                            {finding.effect > 0 ? '+' : ''}
                            {finding.effect}
                          </div>
                          <div
                            className="text-[9px] font-mono"
                            style={{color: palette.warm500}}
                          >
                            Δ Effect
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'sep' && (
            <motion.div
              key="sep"
              id="panel-sep"
              role="tabpanel"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
              className="grid grid-cols-1 lg:grid-cols-4 gap-6"
            >
              <aside className="lg:col-span-1 space-y-4">
                <div
                  className="p-6 rounded-2xl"
                  style={{
                    background: `linear-gradient(160deg, ${palette.cream}, ${palette.parchment})`,
                    border: `1px solid ${palette.goldSoft}`,
                    color: palette.warm900,
                  }}
                >
                  <p
                    className="text-[10px] font-mono uppercase tracking-widest mb-1"
                    style={{color: palette.warm500}}
                  >
                    Package ID
                  </p>
                  <h2 className="font-bold text-lg mb-6" style={{color: palette.warm900}}>
                    {sep.id}
                  </h2>
                  <dl className="space-y-4">
                    <Metric
                      label="Fingerprint"
                      value={sep.pipelineProvenance.sha256.slice(0, 12) + '…'}
                    />
                    <Metric
                      label="Created"
                      value={new Date(sep.pipelineProvenance.timestamp).toLocaleDateString()}
                    />
                    <Metric label="Schema" value={sep.schemaVersion} />
                    {lastSource ? (
                      <Metric
                        label="Source"
                        value={lastSource === 'llm' ? 'LLM-enhanced' : 'Deterministic'}
                      />
                    ) : null}
                  </dl>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(135deg, ${palette.gold}, ${palette.goldDeep})`,
                    color: palette.ivory,
                    boxShadow: `0 8px 20px ${palette.goldSoft}80`,
                  }}
                  aria-busy={isGenerating}
                >
                  <Zap
                    className={cn('w-4 h-4', isGenerating && 'animate-spin')}
                    aria-hidden="true"
                  />
                  {isGenerating ? 'Processing Audit…' : 'Generate Reviewer Language'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <ExportButton icon={FileText} onClick={handleExportMarkdown}>
                    MD
                  </ExportButton>
                  <ExportButton icon={Database} onClick={handleExportJSON}>
                    JSON
                  </ExportButton>
                </div>
              </aside>

              <article
                className="lg:col-span-3 rounded-2xl shadow-sm p-8 min-h-[600px] overflow-auto"
                style={{background: '#ffffff', border: `1px solid ${palette.warm200}`}}
              >
                <div className="markdown-body">
                  {sep.reviewerReadyLanguage ? (
                    <ReactMarkdown>{sep.reviewerReadyLanguage}</ReactMarkdown>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center h-[500px] space-y-4"
                      style={{color: palette.warm500}}
                    >
                      <FileText className="w-16 h-16 opacity-40" aria-hidden="true" />
                      <p className="text-sm font-medium">
                        Click <em>Generate Reviewer Language</em> to synthesize the audit trace.
                      </p>
                      <p
                        className="text-[10px] font-mono uppercase tracking-widest"
                        style={{color: palette.warm400}}
                      >
                        Deterministic template by default — no API key required.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            </motion.div>
          )}

          {activeTab === 'instrument' && (
            <motion.div
              key="instrument"
              id="panel-instrument"
              role="tabpanel"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
              className="rounded-2xl p-6 font-mono min-h-[500px] relative overflow-hidden shadow-sm"
              style={{
                background: palette.parchment,
                border: `1px solid ${palette.goldSoft}`,
                color: palette.warm800,
              }}
            >
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{
                  background: `linear-gradient(90deg, ${palette.goldSoft}, ${palette.gold}, ${palette.goldDeep})`,
                }}
              />
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{background: palette.rose}}
                    aria-hidden="true"
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{background: palette.gold}}
                    aria-hidden="true"
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{background: palette.sage}}
                    aria-hidden="true"
                  />
                  <span
                    className="ml-4 text-xs font-bold uppercase tracking-widest font-sans"
                    style={{color: palette.warm700}}
                  >
                    BCAL Instrument Logs
                  </span>
                </div>
                <div className="text-[10px]" style={{color: palette.warm500}}>
                  SESSION: {sessionId}
                </div>
              </div>

              <div className="space-y-2 text-[11px]" aria-live="polite">
                <LogEntry time="05:53:57" level="INFO" msg="BCAL instrument hook initialised for Nextflow runtime." />
                <LogEntry time="05:54:12" level="WARN" msg="Decision interceptor matched sample S-205 for manual justification." />
                <LogEntry
                  time="05:55:01"
                  level="TRACE"
                  msg={`SHA-256 checksum verified: ${sep.pipelineProvenance.sha256.slice(0, 32)}`}
                />
                <LogEntry time="05:55:02" level="INFO" msg="Capturing method version: DESeq2 (v1.38.3)" />
                <LogEntry time="05:55:10" level="SUCCESS" msg="Audit block hash appended to SEP local cache." />
                <span
                  className="inline-block w-2 h-4 animate-pulse mt-4"
                  style={{background: palette.gold}}
                  aria-hidden="true"
                />
              </div>

              <div
                className="mt-12 p-4 rounded-xl"
                style={{background: '#ffffff', border: `1px solid ${palette.warm200}`}}
              >
                <h3
                  className="text-xs font-bold mb-4 uppercase tracking-wider flex items-center gap-2"
                  style={{color: palette.warm700}}
                >
                  <Terminal className="w-4 h-4" aria-hidden="true" /> Integration CLI
                </h3>
                <pre
                  className="p-3 rounded-lg text-[10px] mb-4 overflow-x-auto"
                  style={{background: palette.cream, color: palette.goldDeep}}
                >
                  <code>
                    $ bcal audit --path ./nextflow/output --config bcal_config.yaml --profile fda_ind
                  </code>
                </pre>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className="p-3 rounded-lg flex items-center justify-between"
                    style={{background: palette.cream}}
                  >
                    <span
                      className="text-[10px] uppercase"
                      style={{color: palette.warm700}}
                    >
                      Input Files Managed
                    </span>
                    <span className="text-sm font-bold" style={{color: palette.warm900}}>
                      —
                    </span>
                  </div>
                  <div
                    className="p-3 rounded-lg flex items-center justify-between"
                    style={{background: palette.cream}}
                  >
                    <span
                      className="text-[10px] uppercase"
                      style={{color: palette.warm700}}
                    >
                      Avg Capture Latency
                    </span>
                    <span className="text-sm font-bold" style={{color: palette.warm900}}>
                      —
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer
        className="mt-20"
        style={{
          background: palette.cream,
          borderTop: `1px solid ${palette.warm200}`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div
            className="text-[10px] font-medium uppercase tracking-[0.2em]"
            style={{color: palette.warm500}}
          >
            © 2026 BCAL Compliance Architecture. For regulatory use only.
          </div>
          <div className="flex gap-6">
            <FooterLink href="#docs">Documentation</FooterLink>
            <FooterLink href="#fda">FDA IND Profile</FooterLink>
            <FooterLink href="#ema">EMA Module</FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function TabButton({
  children,
  active,
  onClick,
  controls,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  controls: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
      style={{
        background: active ? '#ffffff' : 'transparent',
        color: active ? palette.warm900 : palette.warm500,
        boxShadow: active ? `0 1px 2px ${palette.warm200}` : 'none',
      }}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  mono,
  highlight,
  warning,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{className?: string; style?: React.CSSProperties}>;
  mono?: boolean;
  highlight?: boolean;
  warning?: boolean;
}): JSX.Element {
  const bg = highlight
    ? `linear-gradient(135deg, ${palette.goldSoft}, ${palette.cream})`
    : '#ffffff';
  return (
    <div
      className="p-5 rounded-2xl shadow-sm transition-transform hover:-translate-y-1"
      style={{
        background: bg,
        border: `1px solid ${highlight ? palette.gold : palette.warm200}`,
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{color: palette.warm500}}
        >
          {label}
        </span>
        <Icon
          className="w-4 h-4"
          style={{
            color: highlight
              ? palette.goldDeep
              : warning
              ? palette.rose
              : palette.warm300,
          }}
        />
      </div>
      <div
        className={cn('text-xl font-black truncate', mono && 'font-mono text-base tracking-tighter')}
        style={{color: palette.warm900}}
      >
        {value}
      </div>
    </div>
  );
}

function Metric({label, value}: {label: string; value: string}): JSX.Element {
  return (
    <div
      className="flex justify-between items-center py-2"
      style={{borderBottom: `1px solid ${palette.warm200}`}}
    >
      <dt
        className="text-[10px] uppercase font-bold tracking-tight"
        style={{color: palette.warm500}}
      >
        {label}
      </dt>
      <dd className="text-[10px] font-mono" style={{color: palette.warm900}}>
        {value}
      </dd>
    </div>
  );
}

function ExportButton({
  children,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{className?: string}>;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors"
      style={{
        background: '#ffffff',
        border: `1px solid ${palette.warm200}`,
        color: palette.warm700,
      }}
    >
      <Icon className="w-3 h-3" />
      {children}
    </button>
  );
}

function LogEntry({
  time,
  level,
  msg,
}: {
  time: string;
  level: 'INFO' | 'WARN' | 'TRACE' | 'SUCCESS';
  msg: string;
}): JSX.Element {
  const color = {
    INFO: palette.goldDeep,
    WARN: palette.rose,
    TRACE: palette.warm500,
    SUCCESS: palette.sage,
  }[level];

  return (
    <div
      className="flex gap-4 items-start py-0.5 transition-colors"
      style={{borderBottom: `1px solid ${palette.warm100}`}}
    >
      <span className="shrink-0" style={{color: palette.warm500}}>
        [{time}]
      </span>
      <span className="font-bold w-16 shrink-0" style={{color}}>
        {level}
      </span>
      <span className="flex-1 opacity-90">{msg}</span>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <a
      href={href}
      className="text-[10px] font-bold uppercase tracking-[0.15em] transition-colors"
      style={{color: palette.warm500}}
    >
      {children}
    </a>
  );
}
