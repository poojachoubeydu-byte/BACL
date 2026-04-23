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

type TabKey = 'audit' | 'sep' | 'instrument' | 'docs';

// BCAL palette — bright, modern, minimal.
// Mirrors the CSS variables in index.css so components can mix inline styles
// with Tailwind utilities. Pure white canvas with vivid gold + sage accents.
const palette = {
  // canvas
  bg: '#FFFFFF',
  surface: '#FBF9F3',
  surface2: '#F6F1E3',
  surface3: '#F2EAD3',

  // gold (primary accent)
  gold50: '#FDF9EC',
  gold100: '#FAF0CE',
  gold200: '#F2E0A2',
  gold300: '#E8C875',
  gold400: '#D4AF37',
  gold500: '#BD9628',
  gold600: '#9B7A1F',
  gold700: '#7C5F17',

  // ink (neutrals)
  ink100: '#F1EDE0',
  ink200: '#E6E3DA',
  ink300: '#D1D1D1',
  ink400: '#A3A3A3',
  ink500: '#7A7A7A',
  ink600: '#5C5C5C',
  ink700: '#3F3F3F',
  ink800: '#2B2B2B',
  ink900: '#1A1A1A',

  // status
  sage300: '#B6D4B1',
  sage500: '#6FA96A',
  sage700: '#3F7A3B',
  rose300: '#F0B5B0',
  rose500: '#D48B85',
  rose700: '#A85A55',
  sky500: '#6FA8CF',
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
      style={{background: palette.bg, color: palette.ink900}}
    >
      <nav
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          borderBottom: `1px solid ${palette.ink200}`,
        }}
        aria-label="Primary"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${palette.gold200}, ${palette.gold400})`,
                  boxShadow: `0 2px 8px ${palette.gold200}66`,
                }}
                aria-hidden="true"
              >
                <ShieldCheck className="w-6 h-6" style={{color: palette.ink900}} />
              </div>
              <div>
                <h1
                  className="font-bold text-lg tracking-tight uppercase"
                  style={{color: palette.ink900}}
                >
                  BCAL
                </h1>
                <p
                  className="text-[10px] font-mono font-medium -mt-1 tracking-widest uppercase"
                  style={{color: palette.ink500}}
                >
                  BioCompliance Audit Layer
                </p>
              </div>
            </div>

            <div
              className="hidden md:flex items-center gap-1 p-1 rounded-full"
              style={{
                background: palette.surface,
                border: `1px solid ${palette.ink200}`,
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
              <TabButton
                active={activeTab === 'docs'}
                onClick={() => setActiveTab('docs')}
                controls="panel-docs"
              >
                Docs
              </TabButton>
            </div>

            <div className="flex items-center gap-4">
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: palette.surface,
                  color: palette.gold600,
                  border: `1px solid ${palette.gold200}`,
                }}
                aria-live="polite"
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{background: palette.gold400}}
                  aria-hidden="true"
                />
                Demo Mode
              </div>
              <a
                href="https://github.com/"
                className="rounded transition-colors"
                style={{color: palette.ink500}}
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
                    border: `1px solid ${palette.ink200}`,
                  }}
                  aria-labelledby="heading-m4"
                >
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2
                        id="heading-m4"
                        className="font-bold flex items-center gap-2 uppercase tracking-wide text-sm"
                        style={{color: palette.ink900}}
                      >
                        <Activity className="w-4 h-4" style={{color: palette.gold400}} aria-hidden="true" />
                        [M4] Batch Effect Audit
                      </h2>
                      <p className="text-xs mt-1" style={{color: palette.ink500}}>
                        PCA stratified by known batch variables and disease subtype.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className="text-[10px] px-2 py-1 rounded font-mono"
                        style={{background: palette.surface, color: palette.ink700}}
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
                        <XAxis type="number" dataKey="pc1" name="PC1" stroke={palette.ink500} fontSize={10} tickLine={false} />
                        <YAxis type="number" dataKey="pc2" name="PC2" stroke={palette.ink500} fontSize={10} tickLine={false} />
                        <ZAxis type="category" dataKey="subtype" name="Subtype" />
                        <Tooltip
                          cursor={{strokeDasharray: '3 3'}}
                          contentStyle={{
                            borderRadius: '12px',
                            border: `1px solid ${palette.ink200}`,
                            background: palette.surface,
                            boxShadow: '0 4px 12px rgba(60,58,54,0.08)',
                            fontSize: '11px',
                            color: palette.ink900,
                          }}
                        />
                        <Scatter name="Samples" data={mockPCAData}>
                          {mockPCAData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.batch === 'Batch_1' ? palette.gold400 : palette.sage500}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div
                    className="mt-4 flex gap-4 text-[10px] font-mono"
                    style={{color: palette.ink500}}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{background: palette.gold400}}
                        aria-hidden="true"
                      />
                      Batch 1
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{background: palette.sage500}}
                        aria-hidden="true"
                      />
                      Batch 2
                    </div>
                  </div>
                </section>

                <section
                  className="rounded-2xl p-6 shadow-sm"
                  style={{background: '#ffffff', border: `1px solid ${palette.ink200}`}}
                  aria-labelledby="heading-checklist"
                >
                  <h2
                    id="heading-checklist"
                    className="font-bold flex items-center gap-2 uppercase tracking-wide text-sm mb-6"
                    style={{color: palette.ink900}}
                  >
                    <Terminal className="w-4 h-4" style={{color: palette.gold600}} aria-hidden="true" />
                    Compliance Checklist
                  </h2>
                  <ul className="space-y-4">
                    {sep.regulatoryChecklist.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        {item.status === 'ok' ? (
                          <CheckCircle2
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{color: palette.sage500}}
                            aria-label="passing"
                          />
                        ) : (
                          <AlertTriangle
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{color: palette.gold600}}
                            aria-label="attention required"
                          />
                        )}
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: item.status === 'ok' ? palette.ink700 : palette.gold600,
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
                      background: `linear-gradient(135deg, ${palette.gold400}, ${palette.gold600})`,
                      color: palette.bg,
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
                  style={{background: '#ffffff', border: `1px solid ${palette.ink200}`}}
                  aria-labelledby="heading-m2"
                >
                  <div
                    className="px-6 py-4 flex justify-between items-center"
                    style={{
                      background: palette.surface,
                      borderBottom: `1px solid ${palette.ink200}`,
                    }}
                  >
                    <h2
                      id="heading-m2"
                      className="font-bold flex items-center gap-2 uppercase tracking-wide text-sm"
                      style={{color: palette.ink900}}
                    >
                      <AlertTriangle
                        className="w-4 h-4"
                        style={{color: palette.gold600}}
                        aria-hidden="true"
                      />
                      [M2] Exclusion Ledger
                    </h2>
                    <span className="text-[10px] font-mono" style={{color: palette.ink500}}>
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
                              ? `1px solid ${palette.ink100}`
                              : 'none',
                        }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{color: palette.gold600}}
                          >
                            {log.sampleId}
                          </span>
                          <time
                            dateTime={log.timestamp}
                            className="text-[10px]"
                            style={{color: palette.ink500}}
                          >
                            {new Date(log.timestamp).toLocaleString()}
                          </time>
                        </div>
                        <p
                          className="text-xs font-semibold mb-1"
                          style={{color: palette.ink900}}
                        >
                          {log.reason}
                        </p>
                        <p
                          className="text-[11px] italic"
                          style={{color: palette.ink700}}
                        >
                          "{log.justification}"
                        </p>
                        <div
                          className="mt-2 flex items-center gap-1 text-[9px] font-mono uppercase"
                          style={{color: palette.ink500}}
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
                  style={{background: '#ffffff', border: `1px solid ${palette.ink200}`}}
                  aria-labelledby="heading-m1"
                >
                  <div
                    className="px-6 py-4"
                    style={{
                      background: palette.surface,
                      borderBottom: `1px solid ${palette.ink200}`,
                    }}
                  >
                    <h2
                      id="heading-m1"
                      className="font-bold flex items-center gap-2 uppercase tracking-wide text-sm"
                      style={{color: palette.ink900}}
                    >
                      <FlaskConical
                        className="w-4 h-4"
                        style={{color: palette.gold400}}
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
                        style={{border: `1px solid ${palette.ink100}`}}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background:
                              finding.status === 'consistent'
                                ? '#EEF2EB'
                                : finding.status === 'paradox'
                                ? '#F6E4E2'
                                : palette.surface,
                            color:
                              finding.status === 'consistent'
                                ? palette.sage500
                                : finding.status === 'paradox'
                                ? palette.rose500
                                : palette.gold600,
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
                              style={{color: palette.ink900}}
                            >
                              {finding.subgroupId}
                            </h3>
                            <span
                              className="text-[10px] font-mono px-1.5 rounded"
                              style={{background: palette.surface, color: palette.ink700}}
                            >
                              {finding.trait}
                            </span>
                          </div>
                          <div
                            className="mt-1 h-1.5 w-full rounded-full overflow-hidden"
                            style={{background: palette.ink100}}
                          >
                            <div
                              className="h-full transition-all duration-1000"
                              style={{
                                width: `${Math.min(100, Math.abs(finding.effect * 100))}%`,
                                background: `linear-gradient(90deg, ${palette.gold200}, ${palette.gold400})`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className="text-xs font-bold"
                            style={{color: palette.ink900}}
                          >
                            {finding.effect > 0 ? '+' : ''}
                            {finding.effect}
                          </div>
                          <div
                            className="text-[9px] font-mono"
                            style={{color: palette.ink500}}
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
                    background: `linear-gradient(160deg, ${palette.surface}, ${palette.surface2})`,
                    border: `1px solid ${palette.gold200}`,
                    color: palette.ink900,
                  }}
                >
                  <p
                    className="text-[10px] font-mono uppercase tracking-widest mb-1"
                    style={{color: palette.ink500}}
                  >
                    Package ID
                  </p>
                  <h2 className="font-bold text-lg mb-6" style={{color: palette.ink900}}>
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
                    background: `linear-gradient(135deg, ${palette.gold400}, ${palette.gold600})`,
                    color: palette.bg,
                    boxShadow: `0 8px 20px ${palette.gold200}80`,
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
                style={{background: '#ffffff', border: `1px solid ${palette.ink200}`}}
              >
                <div className="markdown-body">
                  {sep.reviewerReadyLanguage ? (
                    <ReactMarkdown>{sep.reviewerReadyLanguage}</ReactMarkdown>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center h-[500px] space-y-4"
                      style={{color: palette.ink500}}
                    >
                      <FileText className="w-16 h-16 opacity-40" aria-hidden="true" />
                      <p className="text-sm font-medium">
                        Click <em>Generate Reviewer Language</em> to synthesize the audit trace.
                      </p>
                      <p
                        className="text-[10px] font-mono uppercase tracking-widest"
                        style={{color: palette.ink400}}
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
                background: palette.surface2,
                border: `1px solid ${palette.gold200}`,
                color: palette.ink800,
              }}
            >
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{
                  background: `linear-gradient(90deg, ${palette.gold200}, ${palette.gold400}, ${palette.gold600})`,
                }}
              />
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{background: palette.rose500}}
                    aria-hidden="true"
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{background: palette.gold400}}
                    aria-hidden="true"
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{background: palette.sage500}}
                    aria-hidden="true"
                  />
                  <span
                    className="ml-4 text-xs font-bold uppercase tracking-widest font-sans"
                    style={{color: palette.ink700}}
                  >
                    BCAL Instrument Logs
                  </span>
                </div>
                <div className="text-[10px]" style={{color: palette.ink500}}>
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
                  style={{background: palette.gold400}}
                  aria-hidden="true"
                />
              </div>

              <div
                className="mt-12 p-4 rounded-xl"
                style={{background: '#ffffff', border: `1px solid ${palette.ink200}`}}
              >
                <h3
                  className="text-xs font-bold mb-4 uppercase tracking-wider flex items-center gap-2"
                  style={{color: palette.ink700}}
                >
                  <Terminal className="w-4 h-4" aria-hidden="true" /> Integration CLI
                </h3>
                <pre
                  className="p-3 rounded-lg text-[10px] mb-4 overflow-x-auto"
                  style={{background: palette.surface, color: palette.gold600}}
                >
                  <code>
                    $ bcal audit --path ./nextflow/output --config bcal_config.yaml --profile fda_ind
                  </code>
                </pre>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className="p-3 rounded-lg flex items-center justify-between"
                    style={{background: palette.surface}}
                  >
                    <span
                      className="text-[10px] uppercase"
                      style={{color: palette.ink700}}
                    >
                      Input Files Managed
                    </span>
                    <span className="text-sm font-bold" style={{color: palette.ink900}}>
                      —
                    </span>
                  </div>
                  <div
                    className="p-3 rounded-lg flex items-center justify-between"
                    style={{background: palette.surface}}
                  >
                    <span
                      className="text-[10px] uppercase"
                      style={{color: palette.ink700}}
                    >
                      Avg Capture Latency
                    </span>
                    <span className="text-sm font-bold" style={{color: palette.ink900}}>
                      —
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'docs' && (
            <motion.div
              key="docs"
              id="panel-docs"
              role="tabpanel"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
              className="space-y-8"
            >
              <DocsPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer
        className="mt-20"
        style={{
          background: palette.surface,
          borderTop: `1px solid ${palette.ink200}`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div
            className="text-[10px] font-medium uppercase tracking-[0.2em]"
            style={{color: palette.ink500}}
          >
            © 2026 BCAL Compliance Architecture. For regulatory use only.
          </div>
          <div className="flex gap-6">
            <FooterLink onClick={() => goToDoc(setActiveTab, 'doc-overview')}>
              Documentation
            </FooterLink>
            <FooterLink onClick={() => goToDoc(setActiveTab, 'doc-fda')}>
              FDA IND Profile
            </FooterLink>
            <FooterLink onClick={() => goToDoc(setActiveTab, 'doc-ema')}>
              EMA Module
            </FooterLink>
            <FooterLink onClick={() => goToDoc(setActiveTab, 'doc-cli')}>
              CLI Quickstart
            </FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

function goToDoc(
  setTab: (t: TabKey) => void,
  sectionId: string
): void {
  setTab('docs');
  // Wait for the docs panel to mount (next microtask is enough after React batches).
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
  }, 60);
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
        color: active ? palette.ink900 : palette.ink500,
        boxShadow: active ? `0 1px 2px ${palette.ink200}` : 'none',
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
    ? `linear-gradient(135deg, ${palette.gold200}, ${palette.surface})`
    : '#ffffff';
  return (
    <div
      className="p-5 rounded-2xl shadow-sm transition-transform hover:-translate-y-1"
      style={{
        background: bg,
        border: `1px solid ${highlight ? palette.gold400 : palette.ink200}`,
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{color: palette.ink500}}
        >
          {label}
        </span>
        <Icon
          className="w-4 h-4"
          style={{
            color: highlight
              ? palette.gold600
              : warning
              ? palette.rose500
              : palette.ink300,
          }}
        />
      </div>
      <div
        className={cn('text-xl font-black truncate', mono && 'font-mono text-base tracking-tighter')}
        style={{color: palette.ink900}}
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
      style={{borderBottom: `1px solid ${palette.ink200}`}}
    >
      <dt
        className="text-[10px] uppercase font-bold tracking-tight"
        style={{color: palette.ink500}}
      >
        {label}
      </dt>
      <dd className="text-[10px] font-mono" style={{color: palette.ink900}}>
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
        border: `1px solid ${palette.ink200}`,
        color: palette.ink700,
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
    INFO: palette.gold600,
    WARN: palette.rose500,
    TRACE: palette.ink500,
    SUCCESS: palette.sage500,
  }[level];

  return (
    <div
      className="flex gap-4 items-start py-0.5 transition-colors"
      style={{borderBottom: `1px solid ${palette.ink100}`}}
    >
      <span className="shrink-0" style={{color: palette.ink500}}>
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
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] font-bold uppercase tracking-[0.15em] transition-colors bg-transparent border-0 p-0 cursor-pointer"
      style={{color: palette.ink500}}
      onMouseOver={(e) => (e.currentTarget.style.color = palette.gold600)}
      onMouseOut={(e) => (e.currentTarget.style.color = palette.ink500)}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Docs panel — real content for the footer links to navigate to.
// ---------------------------------------------------------------------------

function DocsPanel(): JSX.Element {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <aside
        className="lg:col-span-1 rounded-2xl p-5 h-fit sticky top-20"
        style={{background: palette.surface, border: `1px solid ${palette.ink200}`}}
      >
        <h3
          className="text-[10px] font-bold uppercase tracking-widest mb-3"
          style={{color: palette.ink500}}
        >
          On this page
        </h3>
        <nav className="flex flex-col gap-1.5 text-xs">
          <DocLink href="#doc-overview">Overview</DocLink>
          <DocLink href="#doc-architecture">Architecture</DocLink>
          <DocLink href="#doc-cli">CLI Quickstart</DocLink>
          <DocLink href="#doc-fda">FDA IND Profile</DocLink>
          <DocLink href="#doc-ema">EMA Module</DocLink>
          <DocLink href="#doc-cap">CAP / CLIA Profile</DocLink>
          <DocLink href="#doc-schema">SEP Schema</DocLink>
        </nav>
      </aside>

      <article className="lg:col-span-3 space-y-6">
        <DocSection
          id="doc-overview"
          title="Overview"
          eyebrow="BCAL"
        >
          <p>
            BCAL (BioCompliance Audit Layer) sits alongside a bioinformatics
            pipeline and produces a <strong>Statistical Evidence Package (SEP)</strong>{' '}
            — a sealed, schema-versioned record of every decision made during
            the run. Outputs are designed for direct regulatory review.
          </p>
          <p>
            The default mode is fully deterministic: no LLM is called, nothing
            leaves the machine. An opt-in server proxy can call an LLM for a
            reviewer-ready narrative; the API key never touches the browser.
          </p>
        </DocSection>

        <DocSection
          id="doc-architecture"
          title="Five audit modules"
          eyebrow="Architecture"
        >
          <ModuleCard
            code="M1"
            name="Subgroup Consistency"
            ref="ICH E9R1 §5.2.3"
            body="Detects Simpson's-paradox sign-reversals between pooled and stratum-specific effects across covariates (sex, age, disease subtype)."
          />
          <ModuleCard
            code="M2"
            name="Exclusion Ledger"
            ref="21 CFR 11.50"
            body="Forces signed, timestamped, ≥20-character justifications for every excluded sample. A bare QC flag is rejected at validation."
          />
          <ModuleCard
            code="M3"
            name="Version Lock"
            ref="21 CFR 11.10(e)"
            body="Captures tool versions via importlib / subprocess / manual pins and hashes every configuration dict for GxP reproducibility."
          />
          <ModuleCard
            code="M4"
            name="Batch Effect Audit"
            ref="GxP reproducibility"
            body="Seeded PCA + PVCA-approximated variance partitioning. Reports the fraction of expression variance attributable to batch."
          />
          <ModuleCard
            code="M5"
            name="Outlier Ledger"
            ref="CAP GEN.41350"
            body="MAD-based modified z-score screen with mandatory orthogonal evidence and biological / technical / unclassified labelling."
          />
        </DocSection>

        <DocSection
          id="doc-cli"
          title="CLI Quickstart"
          eyebrow="Command line"
        >
          <p>Install and run against your pipeline output:</p>
          <CodeBlock>
            {`pip install -e ".[dev]"

bcal audit \\
    --path ./results/ \\
    --profile fda_ind \\
    --pipeline-name my-rnaseq \\
    --pipeline-version 1.2.3 \\
    --operator "$USER"

# Verify the seal later
bcal verify audit_output/SEP-*.json`}
          </CodeBlock>
          <p className="mt-3">
            The command emits four files: JSON (machine-readable), Markdown
            (reviewer-ready), CSV (findings for risk scoring), and a PDF (or
            HTML fallback if WeasyPrint isn't installed).
          </p>
        </DocSection>

        <DocSection
          id="doc-fda"
          title="FDA IND Profile"
          eyebrow="21 CFR Part 11 + ICH E9R1"
        >
          <p>
            Baseline for an Investigational New Drug submission. Enforces the
            record-keeping requirements of 21 CFR Part 11 and the statistical
            principles from ICH E9R1.
          </p>
          <ChecklistTable
            rows={[
              ['Traceability of method versions', 'ok', '21 CFR 11.10(e)'],
              ['Electronic signature for every exclusion', 'ok', '21 CFR 11.50'],
              ['SHA-256 integrity digest of all raw inputs', 'ok', '21 CFR 11.10(c)'],
              ["Subgroup pre-specification (Simpson's paradox audit)", 'warning', 'ICH E9R1 §5.2.3'],
              ['Method parameter lock recorded', 'ok', 'ICH E9R1 §6.1'],
              ['Reviewer-ready narrative generated deterministically', 'ok', '21 CFR 11.10(a)'],
            ]}
          />
        </DocSection>

        <DocSection
          id="doc-ema"
          title="EMA Module"
          eyebrow="European Medicines Agency"
        >
          <p>
            Alignment with the EMA statistical guideline package (CHMP/EWP),
            including multiplicity control and pre-specification of subgroup
            analyses.
          </p>
          <ChecklistTable
            rows={[
              ['Pre-specified primary endpoint analysis plan', 'ok', 'CHMP/EWP/2330/99'],
              ['Multiplicity adjustment recorded', 'warning', 'CHMP/EWP/908/99'],
              ['Subgroup analysis plan pre-specified', 'ok', 'CHMP/EWP/117211/2010'],
              ['Method and software version captured', 'ok', 'EMA/CHMP/GCP/2017'],
              ['Electronic audit trail retained', 'ok', 'EudraLex Vol 4 Annex 11'],
            ]}
          />
        </DocSection>

        <DocSection
          id="doc-cap"
          title="CAP / CLIA Profile"
          eyebrow="Clinical diagnostics"
        >
          <p>
            Alignment with CAP (College of American Pathologists) laboratory
            accreditation and CLIA-88 high-complexity testing requirements.
          </p>
          <ChecklistTable
            rows={[
              ['Sample chain-of-custody recorded', 'ok', 'CAP GEN.40490'],
              ['Instrument QC verified prior to run', 'ok', '42 CFR 493.1256'],
              ['Analytical method validation on file', 'ok', '42 CFR 493.1253'],
              ['Result review documented by qualified personnel', 'ok', 'CAP GEN.41350'],
              ['Proficiency-testing alignment recorded', 'warning', '42 CFR 493.801'],
            ]}
          />
        </DocSection>

        <DocSection
          id="doc-schema"
          title="SEP Schema"
          eyebrow="For downstream integrations"
        >
          <p>
            The SEP JSON schema is exported by <code>bcal schema</code>. Every
            field is Pydantic-validated and the top-level <code>seal</code>{' '}
            field is a SHA-256 hash over the canonical JSON (all fields except
            the seal itself). Any modification to a sealed SEP invalidates the
            seal — <code>bcal verify</code> surfaces tampering immediately.
          </p>
          <CodeBlock>{`bcal schema --out docs/sep.schema.json`}</CodeBlock>
        </DocSection>
      </article>
    </div>
  );
}

function DocSection({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section
      id={id}
      className="rounded-2xl p-8 shadow-sm scroll-mt-24"
      style={{background: palette.bg, border: `1px solid ${palette.ink200}`}}
    >
      <div className="mb-4">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-1"
          style={{color: palette.gold600}}
        >
          {eyebrow}
        </p>
        <h2
          className="text-xl font-black tracking-tight"
          style={{color: palette.ink900}}
        >
          {title}
        </h2>
      </div>
      <div className="text-sm leading-relaxed space-y-3" style={{color: palette.ink800}}>
        {children}
      </div>
    </section>
  );
}

function DocLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <a
      href={href}
      className="py-1 px-2 -mx-2 rounded transition-colors"
      style={{color: palette.ink700}}
      onMouseOver={(e) => {
        e.currentTarget.style.background = palette.gold50;
        e.currentTarget.style.color = palette.gold700;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = palette.ink700;
      }}
    >
      {children}
    </a>
  );
}

function ModuleCard({
  code,
  name,
  ref,
  body,
}: {
  code: string;
  name: string;
  ref: string;
  body: string;
}): JSX.Element {
  return (
    <div
      className="flex gap-4 p-4 rounded-xl mb-2"
      style={{background: palette.surface, border: `1px solid ${palette.ink200}`}}
    >
      <div
        className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-black text-sm"
        style={{
          background: `linear-gradient(135deg, ${palette.gold200}, ${palette.gold400})`,
          color: palette.ink900,
        }}
      >
        {code}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h3 className="font-bold text-sm" style={{color: palette.ink900}}>
            {name}
          </h3>
          <span
            className="text-[10px] font-mono whitespace-nowrap"
            style={{color: palette.gold600}}
          >
            {ref}
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{color: palette.ink700}}>
          {body}
        </p>
      </div>
    </div>
  );
}

function CodeBlock({children}: {children: React.ReactNode}): JSX.Element {
  return (
    <pre
      className="p-4 rounded-lg text-[11px] overflow-x-auto font-mono"
      style={{
        background: palette.ink900,
        color: palette.gold200,
        border: `1px solid ${palette.ink800}`,
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

function ChecklistTable({
  rows,
}: {
  rows: Array<[string, 'ok' | 'warning' | 'missing', string]>;
}): JSX.Element {
  return (
    <div
      className="rounded-lg overflow-hidden mt-4"
      style={{border: `1px solid ${palette.ink200}`}}
    >
      <table className="w-full text-xs">
        <thead style={{background: palette.surface}}>
          <tr>
            <th className="text-left p-3 font-semibold" style={{color: palette.ink900}}>
              Item
            </th>
            <th className="text-left p-3 font-semibold w-24" style={{color: palette.ink900}}>
              Status
            </th>
            <th className="text-left p-3 font-semibold" style={{color: palette.ink900}}>
              Reference
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([item, status, ref], i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? palette.bg : palette.surface,
                borderTop: `1px solid ${palette.ink200}`,
              }}
            >
              <td className="p-3" style={{color: palette.ink800}}>
                {item}
              </td>
              <td className="p-3">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background:
                      status === 'ok'
                        ? '#E8F4E5'
                        : status === 'warning'
                        ? palette.gold50
                        : '#FBE9E7',
                    color:
                      status === 'ok'
                        ? palette.sage700
                        : status === 'warning'
                        ? palette.gold700
                        : palette.rose700,
                  }}
                >
                  {status}
                </span>
              </td>
              <td
                className="p-3 font-mono text-[11px]"
                style={{color: palette.ink600}}
              >
                {ref}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
