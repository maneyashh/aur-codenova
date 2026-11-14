import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  AudioWaveform,
  Check,
  CheckCircle2,
  Download,
  Fingerprint,
  LockKeyhole,
  RotateCcw,
  Scale,
  Sparkles,
} from 'lucide-react';
import {
  Badge,
  Meter,
  Panel,
  PanelHead,
  RingGauge,
  ScreenHead,
  Segmented,
  StatusDot,
} from '../components/ui';
import { useStudio } from '../state/studio';
import { useScenario } from '../sim/SimulationProvider';
import {
  VOICE_LLM,
  VOICE_ORIGINAL,
  VOICE_SURGICAL,
  llmFidelity,
  llmBuzzwords,
  llmMetrics,
  originalMetrics,
  surgicalFidelity,
  surgicalMetrics,
  tokenPatches,
  toneContract,
  type TokenPatch,
} from '../core/voice';

type VoiceVariant = 'source' | 'surgical' | 'llm';

function renderPatched(
  text: string,
  patches: TokenPatch[],
  mode: 'source' | 'surgical',
) {
  const matches = patches
    .map((patch) => ({
      patch,
      term: mode === 'source' ? patch.source : patch.replacement,
    }))
    .map((entry) => ({ ...entry, index: text.indexOf(entry.term) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);

  const nodes: ReactNode[] = [];
  let cursor = 0;

  matches.forEach(({ patch, term, index }) => {
    if (index > cursor) nodes.push(text.slice(cursor, index));
    nodes.push(
      <mark
        key={`${patch.id}-${index}`}
        className={mode === 'source' ? 'token-illegal' : 'token-clean'}
        data-rule={patch.rule}
        title={`${patch.rule} · ${patch.ruleLabel}: ${patch.source} → ${patch.replacement}`}
      >
        {term}
        {mode === 'surgical' ? <span className="token-rule-tag">{patch.rule}</span> : null}
      </mark>,
    );
    cursor = index + term.length;
  });

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderLlm(text: string) {
  const pattern = new RegExp(`\\b(${llmBuzzwords.join('|')})\\b`, 'gi');
  const pieces = text.split(pattern);
  return pieces.map((piece, index) => {
    const isBuzzword = llmBuzzwords.some(
      (word) => word.toLowerCase() === piece.toLowerCase(),
    );
    return isBuzzword ? (
      <mark key={`${piece}-${index}`} className="token-buzzword" title="Generative filler · tone violation">
        {piece}
      </mark>
    ) : (
      <span key={`${piece}-${index}`}>{piece}</span>
    );
  });
}

function CadenceWave({ candidate }: { candidate: number[] }) {
  const width = 400;
  const height = 88;
  const pad = 6;
  const maxLength = Math.max(originalMetrics.cadence.length, candidate.length);
  const pointFor = (syllables: number, index: number, arrLength: number) => {
    const x = pad + (index / Math.max(maxLength - 1, 1)) * (width - pad * 2);
    const y = height - 12 - ((syllables - 1) / 3.2) * (height - 26);
    return [x, y] as const;
  };
  const sourcePoints = originalMetrics.cadence
    .map((syllable, index) => pointFor(syllable, index, originalMetrics.cadence.length).join(','))
    .join(' ');
  const candidatePoints = candidate
    .map((syllable, index) => pointFor(syllable, index, candidate.length).join(','))
    .join(' ');

  return (
    <svg className="cadence-wave" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id="cadenceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D8FF4F" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#D8FF4F" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={pad}
          x2={width - pad}
          y1={height * ratio}
          y2={height * ratio}
          className="cadence-grid"
        />
      ))}
      <polyline points={sourcePoints} className="cadence-source" />
      <polyline points={candidatePoints} className="cadence-candidate" />
    </svg>
  );
}

export function VoiceDNA() {
  const { pushToast } = useStudio();
  const scenario = useScenario();
  const [variant, setVariant] = useState<VoiceVariant>(scenario?.voiceVariant ?? 'surgical');
  const [committed, setCommitted] = useState(false);

  // Dataset A opens on the surgical patch; Dataset B opens on the model rewrite.
  useEffect(() => {
    setVariant(scenario?.voiceVariant ?? 'surgical');
    setCommitted(false);
  }, [scenario?.id, scenario?.voiceVariant]);

  const fidelity = variant === 'llm' ? llmFidelity : variant === 'source' ? {
    score: 100,
    sentenceShape: 100,
    cadence: 100,
    punctuation: 100,
    lexical: 100,
    length: 100,
  } : surgicalFidelity;

  const candidateMetrics =
    variant === 'llm' ? llmMetrics : variant === 'surgical' ? surgicalMetrics : originalMetrics;
  const candidateCadence =
    variant === 'llm' ? llmMetrics.cadence : variant === 'surgical' ? surgicalMetrics.cadence : originalMetrics.cadence;
  const fidelityTone = variant === 'llm' ? 'red' : variant === 'source' ? 'blue' : 'acid';

  const docText =
    variant === 'source' ? VOICE_ORIGINAL : variant === 'llm' ? VOICE_LLM : VOICE_SURGICAL;

  const authorize = () => {
    if (committed) return;
    setCommitted(true);
    pushToast({
      title: `Surgical patch authorised · ${surgicalFidelity.score.toFixed(1)} fidelity`,
      detail: `${tokenPatches.length} lexical tokens replaced. Sentence architecture, cadence and punctuation preserved.`,
      tone: 'clear',
    });
  };

  return (
    <div className="page page--voice">
      <ScreenHead
        index="04"
        kicker="LEXICAL PRESERVATION"
        title={
          <>
            Fix the violation. <span className="title-accent">Keep the voice.</span>
          </>
        }
        description="A surgical token patcher clears compliance errors without regenerating a single sentence. The creator's rhythm survives; the liability does not."
        badge={
          <span className="head-live">
            <StatusDot tone="acid" pulse /> MINIMUM-EDIT PATCHER
          </span>
        }
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                pushToast({
                  title: 'Voice diff exported',
                  detail: '6 atomic substitutions · cadence fingerprint 7c3a…e12b.',
                  tone: 'clear',
                })
              }
            >
              <Download size={14} strokeWidth={1.7} />
              Export diff
            </button>
            <button
              type="button"
              className={`btn ${committed ? 'btn-committed' : 'btn-primary'}`}
              onClick={authorize}
            >
              {committed ? <Check size={14} strokeWidth={2.4} /> : <AudioWaveform size={14} strokeWidth={1.8} />}
              {committed ? 'Patch committed' : 'Authorize patch'}
            </button>
          </>
        }
      />

      <div className="grid-12 voice-layout">
        <Panel className="voice-doc-panel span-7" bracket>
          <PanelHead
            kicker="Copy under review"
            title="Campaign narrative"
            meta="4 SENTENCES / 34 TOKENS"
            actions={
              <Segmented
                value={variant}
                onChange={setVariant}
                ariaLabel="Select voice comparison variant"
                size="sm"
                options={[
                  { value: 'source', label: 'Source' },
                  { value: 'surgical', label: 'Surgical patch' },
                  { value: 'llm', label: 'LLM rewrite' },
                ]}
              />
            }
          />

          <div className="voice-status-strip">
            <span className="voice-rule-chip">
              <span className="rule-dot" /> ABS-01 ×2
            </span>
            <span className="voice-rule-chip">
              <span className="rule-dot" /> UNV-04
            </span>
            <span className="voice-rule-chip">
              <span className="rule-dot" /> TON-02
            </span>
            <span className="voice-rule-chip">
              <span className="rule-dot" /> QNT-01
            </span>
            <span className="voice-status-right">
              {variant === 'llm' ? (
                <>
                  <Sparkles size={11} /> GENERATIVE DRIFT
                </>
              ) : variant === 'source' ? (
                <>
                  <StatusDot tone="red" /> 6 ILLEGAL TOKENS
                </>
              ) : (
                <>
                  <StatusDot tone="acid" /> 6 SURGICAL SWAPS
                </>
              )}
            </span>
          </div>

          <div className={`voice-document voice-document--${variant}`}>
            <div className="voice-doc-gutter">
              <span>01</span>
              <span>02</span>
              <span>03</span>
              <span>04</span>
            </div>
            <div className="voice-doc-body">
              <div className="voice-doc-eyebrow">
                <span>HELIOS / CAMPAIGN 07</span>
                <span>{variant === 'llm' ? 'MODEL OUTPUT' : variant === 'source' ? 'AUTHOR DRAFT' : 'PATCHED DRAFT'}</span>
              </div>
              <p className="voice-prose">
                {variant === 'source'
                  ? renderPatched(VOICE_ORIGINAL, tokenPatches, 'source')
                  : variant === 'surgical'
                    ? renderPatched(VOICE_SURGICAL, tokenPatches, 'surgical')
                    : renderLlm(VOICE_LLM)}
              </p>
              {variant !== 'llm' ? (
                <div className="voice-doc-notes">
                  <div>
                    <span>PROTECTED SYNTAX</span>
                    <p>Em-dash cadence · declarative rhythm · direct address</p>
                  </div>
                  <div>
                    <span>PATCH DOCTRINE</span>
                    <p>{tokenPatches.length} atomic swaps · 0 sentence rewrites · 0 model calls</p>
                  </div>
                </div>
              ) : null}
              <div className="voice-doc-signature">
                <span>— BRAND DESK</span>
                <span>HELIOS DYNAMICS / 2026</span>
              </div>
            </div>
          </div>

          {variant === 'llm' ? (
            <div className="voice-warning">
              <Sparkles size={15} strokeWidth={1.7} />
              <div>
                <strong>Generative rewrite rejected by policy.</strong>
                <span>
                  This variant replaces the author's entire syntactic architecture. Tone is generic,
                  claims are unverified, and voice fidelity collapses to {llmFidelity.score.toFixed(1)}.
                </span>
              </div>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setVariant('surgical')}>
                <RotateCcw size={12} /> Restore patch
              </button>
            </div>
          ) : (
            <div className="voice-mechanics">
              <div>
                <strong>{candidateMetrics.words}</strong>
                <span>words</span>
              </div>
              <div>
                <strong>{variant === 'source' ? 6 : tokenPatches.length}</strong>
                <span>{variant === 'source' ? 'flagged tokens' : 'surgical swaps'}</span>
              </div>
              <div>
                <strong>0</strong>
                <span>sentences rewritten</span>
              </div>
              <div>
                <strong>0.0<span>%</span></strong>
                <span>generative drift</span>
              </div>
              <span className="voice-mechanics-note">
                <CheckCircle2 size={12} /> punctuation signature intact
              </span>
            </div>
          )}

          <div className="voice-doc-foot">
            <span className="doc-foot-state">
              <LockKeyhole size={11} strokeWidth={1.7} /> LOCAL LEXICAL ENGINE / NO GENERATION
            </span>
            <span className="doc-foot-token">
              {committed ? (
                <>
                  <CheckCircle2 size={12} /> COMMITTED · 09:41:22 UTC
                </>
              ) : (
                <>HASH 7C3A…E12B</>
              )}
            </span>
          </div>
        </Panel>

        <Panel className="fingerprint-panel span-5" bracket>
          <PanelHead
            kicker="Voice fingerprint"
            title="Authorial fidelity"
            meta={<span className="meta-live"><StatusDot tone="acid" pulse /> LIVE</span>}
            actions={<Badge tone={variant === 'llm' ? 'red' : 'acid'} dot>{candidateMetrics.sentences} SENT</Badge>}
          />

          <div className="fingerprint-score">
            <RingGauge
              value={fidelity.score}
              display={fidelity.score.toFixed(1)}
              label="FIDELITY"
              sub={variant === 'llm' ? 'VOICE COLLAPSE' : 'VOICE RETAINED'}
              size={146}
              tone={fidelityTone}
            />
            <div className="fingerprint-score-copy">
              <span className="section-label">CANDIDATE</span>
              <strong>
                {variant === 'llm' ? 'Generative rewrite' : variant === 'source' ? 'Unpatched source' : 'Surgical patch'}
              </strong>
              <p>
                {variant === 'llm'
                  ? 'The author disappears. Sentence geometry and punctuation are regenerated.'
                  : variant === 'source'
                    ? 'The creator’s exact rhythm, ready for a minimum-edit compliance pass.'
                    : 'Six lexical units touched. The sentence architecture is byte-identical.'}
              </p>
              <span className={`fidelity-delta ${variant === 'llm' ? 'is-negative' : ''}`}>
                {variant === 'llm'
                  ? `${(llmFidelity.score - surgicalFidelity.score).toFixed(1)} pts vs patch`
                  : `+${(surgicalFidelity.score - llmFidelity.score).toFixed(1)} pts vs LLM`}
              </span>
            </div>
          </div>

          <div className="wave-block">
            <div className="readout-section-head">
              <span className="section-label">CADENCE WAVEFORM</span>
              <span className="section-meta">SYLLABLE / TOKEN</span>
            </div>
            <CadenceWave candidate={candidateCadence} />
            <div className="wave-legend">
              <span><i className="wave-source" /> Original rhythm</span>
              <span><i className={`wave-candidate ${variant === 'llm' ? 'is-red' : ''}`} /> {variant === 'llm' ? 'LLM rewrite' : 'Patched'}</span>
              <span className="wave-meta">{originalMetrics.words} → {candidateMetrics.words} tokens</span>
            </div>
          </div>

          <div className="fidelity-breakdown">
            <div className="readout-section-head">
              <span className="section-label">FIDELITY DECOMPOSITION</span>
              <span className="section-meta">WEIGHTED</span>
            </div>
            {[
              { label: 'Sentence geometry', value: fidelity.sentenceShape },
              { label: 'Syllabic cadence', value: fidelity.cadence },
              { label: 'Punctuation signature', value: fidelity.punctuation },
              { label: 'Lexical retention', value: fidelity.lexical },
              { label: 'Document length', value: fidelity.length },
            ].map((metric) => (
              <div className="fidelity-row" key={metric.label}>
                <span>{metric.label}</span>
                <Meter
                  value={metric.value}
                  tone={metric.value >= 85 ? 'acid' : metric.value >= 60 ? 'amber' : 'red'}
                  height={3}
                />
                <strong>{metric.value.toFixed(1)}</strong>
              </div>
            ))}
          </div>

          <div className="tone-contract">
            <div className="readout-section-head">
              <span className="section-label">TONE CONTRACT</span>
              <span className="section-meta">HEL-VOICE-4</span>
            </div>
            <div className="tone-chips">
              {toneContract.approved.map((tone) => (
                <span className="tone-chip" key={tone}>
                  <Check size={9} /> {tone}
                </span>
              ))}
              {toneContract.prohibited.map((tone) => (
                <span className="tone-chip tone-chip--banned" key={tone}>
                  {tone}
                </span>
              ))}
            </div>
          </div>

          <div className="fingerprint-foot">
            <Fingerprint size={13} strokeWidth={1.7} />
            <span>FINGERPRINT 7C3A…E12B</span>
            <span className="fingerprint-foot-right">LOCAL ONLY</span>
          </div>
        </Panel>
      </div>

      <Panel className="patch-ledger-panel">
        <PanelHead
          kicker="Atomic intervention log"
          title="Surgical patch ledger"
          meta={`${tokenPatches.length} OPERATIONS / REVERSIBLE`}
          actions={
            <span className="patch-ledger-actions">
              <Badge tone="acid" dot>MINIMUM EDIT</Badge>
              <span className="patch-commit-state">
                {committed ? <><CheckCircle2 size={11} /> COMMITTED</> : 'STAGED'}
              </span>
            </span>
          }
        />
        <div className="patch-table">
          <div className="patch-row patch-row--head">
            <span>#</span>
            <span>Illegal token</span>
            <span>Rule</span>
            <span>Replacement</span>
            <span>Rationale</span>
            <span>Conf.</span>
          </div>
          {tokenPatches.map((patch) => (
            <div className="patch-row" key={patch.id}>
              <span className="patch-id">{patch.id}</span>
              <span className="patch-token">
                <s>{patch.source}</s>
              </span>
              <span>
                <span className="rule-badge">{patch.rule}</span>
                <span className="rule-label">{patch.ruleLabel}</span>
              </span>
              <span className="patch-replacement">
                <ArrowRight size={11} strokeWidth={1.5} />
                {patch.replacement}
              </span>
              <span className="patch-rationale">{patch.rationale}</span>
              <span className="patch-confidence">
                <strong>{(patch.confidence * 100).toFixed(1)}</strong>
                <Meter value={patch.confidence * 100} height={2} />
              </span>
            </div>
          ))}
        </div>
        <div className="patch-ledger-foot">
          <span><Scale size={11} strokeWidth={1.7} /> Every edit is reversible and attributable.</span>
          <span className="patch-ledger-foot-right">TOKEN BUDGET 06 / 34 · 17.6% OF DOCUMENT</span>
        </div>
      </Panel>

      <div className="page-footline">
        <span><StatusDot tone="acid" /> VOICE DNA ENGINE NOMINAL</span>
        <span>6 ATOMIC SWAPS</span>
        <span>NO SENTENCE REGENERATED</span>
        <span className="footline-right">FIDELITY {surgicalFidelity.score.toFixed(1)} / LLM {llmFidelity.score.toFixed(1)}</span>
      </div>
    </div>
  );
}
