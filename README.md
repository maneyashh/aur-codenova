# AURA-GOV

**Autonomous Neuro-Symbolic Brand Compiler**

A forensic clearance studio for enterprise brand governance. AURA-GOV treats every asset — a poster, a headline, a launch claim, a paragraph of copy — as a *hypothesis* that must survive four independent audits before it is allowed to ship.

Deterministic where it must be. Neural where it helps. Never the other way around.

```
                 ┌──────────────┐
   raw asset ───▶│  ZERO-TRUST  │──▶ tokenised payload (no raw PII)
                 │   AIRLOCK    │
                 └──────┬───────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  ┌───────────┐   ┌───────────┐   ┌───────────┐
  │  VISUAL   │   │ TEMPORAL  │   │   VOICE   │
  │ FORENSICS │   │   TRUTH   │   │    DNA    │
  │  ΔE · WCAG│   │ claims ×  │   │  lexical  │
  │  geometry │   │  publish  │   │  patching │
  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
        └───────────────┼───────────────┘
                        ▼
                ┌──────────────┐
                │  CLEARANCE   │  verdict · notes · evidence
                │   VERDICT    │
                └──────────────┘
```

---

## Why this exists

Enterprise brand tooling has an epistemic problem. Generative models are excellent at producing *plausible* copy and *plausible* visuals, and terrible at telling you whether either is true. So teams bolt a "brand check" onto the end of the pipeline, run it through another model, and get a second opinion with the same failure mode.

AURA-GOV inverts the architecture:

- **Claims are contracts with expiry dates**, not sentences. A claim is evaluated against the *scheduled publish date*, not the moment it was written.
- **Colour drift is arithmetic**, not vibes. CIEDE2000 and WCAG 2.2, implemented in the browser, auditable line by line.
- **Compliance repair is lexical**, not creative. Patch the minimum token set; measure exactly how much authorship survived.
- **PII never leaves the node.** Detection, tokenisation and the vault all happen locally. The external model receives placeholders.

Every number on screen is computed from a deterministic function in `src/core`. Nothing is a screenshot of a backend you can't inspect.

---

## The five modules

### 01 · Command Deck
The compiler's operating surface. A six-stage pipeline (Ingest → Airlock → Visual → Temporal → Voice → Clearance) with a live trace console, integrity stat cards, a clearance verdict panel with a weighted ring, a filterable verdict feed and a portfolio drift radar.

- **Run compilation** replays the full audit: stages illuminate in sequence, the trace console streams timestamped log lines, the ring and verdict resolve, and a toast reports the outcome.
- Verdict is *weighted*, not boolean: `CLEAR WITH NOTES · 91.4` means two open items that don't individually block shipment.

### 02 · Visual Forensics
A pixel-level interrogation of a rendered specimen (`Orbital Launch — Hero 07`).

- **ΔE heatmap** — per-region CIEDE2000 drift against the master brand palette, painted onto the poster as a thermal overlay.
- **Geometry lock** — logo clear-space, minimum size and aspect-ratio constraints checked against the G-01..G-04 ruleset.
- **Probe mode** — hover-free forensic readout of sampled regions with hex, Lab, contrast ratio and WCAG level.
- Toggleable overlays; the poster is a hand-built SVG so every measured region is addressable.

### 03 · Temporal Truth
The claim ledger, evaluated against a movable publication horizon.

- **Time machine slider** — drag the scheduled publish date from T+00 to T+75 days. Every claim re-evaluates live.
- **Claim ledger** — each claim shows its validity window, evidence status and a state badge: `VALID`, `EXPIRES ≤ 7D`, `EVIDENCE PENDING`, `CONTRADICTED`, `EXPIRED AT PUBLISH`.
- **Evidence graph** — a per-claim node graph of verified / pending / contradicted sources, with the publish gate drawn as a vertical horizon.
- The core insight: a claim that is true today can be **false on the day it ships**. The engine catches that.

### 04 · Voice DNA
Surgical compliance repair that preserves the author's fingerprint.

- **Three-way diff** — `Author draft` vs `Surgical patch` vs `LLM rewrite`, rendered as highlighted prose.
- **Token patch ledger** — six atomic substitutions, each with its rule (`ABS-01`, `UNV-04`, `TON-02`, `QNT-01`, `ABS-03`, `ABS-04`), rationale and confidence.
- **Authorial fidelity** — a weighted score (sentence geometry 34%, cadence 22%, length 16%, punctuation 14%, lexical retention 14%) that *deliberately penalises* beautiful rewrites.
- On the demo specimen the surgical patch scores **94.8** and the LLM rewrite **50.9**. Same compliance outcome, radically different authorship survival.

### 05 · Zero-Trust Airlock
The local sanitisation membrane between your asset and any external model.

- **Live payload editor** — type or paste; eight entity classes (codename, program, person, email, phone, secret, IP, address) are detected in real time by lexicon + pattern rules and highlighted inline.
- **Entity register** — every detected entity with its reversible vault token, detection rule and confidence.
- **Egress manifest** — the exact payload the external model would receive, plus an **inbound/outbound flow diagram**.
- **Leak simulation** — flip the toggle to bypass the airlock and watch the risk score, raw-character count and flow state turn hostile.
- **Egress approval** — a one-way commit; the button becomes `Egress approved · tokens only` and the call counter increments.

---

## Judge Simulation Mode

A cold-start onboarding layer wraps the studio on first load. It is presentation-only: scenario content lives in `src/sim/scenarios.ts`, and every verdict is still recomputed by the same deterministic engines in `src/core` — the simulation never bypasses, mocks or modifies them.

**1 · The gateway.** An un-dismissible glass panel presents two staged incidents:

| Dataset | Incident | What hydrates |
| --- | --- | --- |
| **A** | Visual & Temporal Crisis | Off-brand magenta poster (`ORBIT30`, expired 31 Oct), campaign caption, verdict `74.8 HOLD`, visual/temporal findings, publish horizon `T+21` |
| **B** | Privacy & Voice DNA Breach | Press release with 14 raw entities (people, phones, email, `sk_live_…`, internal IP, facility), verdict `81.3 BLOCK`, Airlock payload, Voice DNA default `LLM rewrite` |

Selecting a card instantly hydrates the Command Deck (asset, title, caption, verdict, notes), the Visual canvas (poster theme + recomputed ΔE palette), the Airlock ingress buffer, the Voice DNA variant and the publish horizon. Keyboard: `1`/`2` select, arrows move focus, `Enter` initialises. `Escape` is intentionally blocked.

**2 · The tour.** A three-step spotlight walks the judge through the product:

1. **Run** — highlights `Run compilation`; the step only advances after the six-stage pipeline actually seals.
2. **Prove** — highlights the trace console: *"Math, not guesses… zero external models used."*
3. **Remediate** — highlights the remediation strip and opens the surgical Voice DNA patch.

The tooltip is a frosted, softly pulsing module positioned against a measured spotlight (`data-tour` anchors) with spring movement, collision-aware flipping and a floating fallback when the target is off screen.

**3 · Architecture.** `SimulationProvider` (`src/sim/SimulationProvider.tsx`) is nested inside `StudioProvider`, so it can drive navigation, compilation, publish offset, heatmap and toasts without touching the core. Phase machine: `gateway → tour → free`. There is no persistence — every fresh load replays the judge flow. The topbar `DATASET A/B` chip and the command palette (`Switch crisis scenario`, `Restart judge tour`) re-enter it at any time.

---

## Deterministic engines

All four live in `src/core` and have zero framework dependencies. They are pure functions over plain data — portable to a worker, a CLI, or a server without modification.

| File | Responsibility | Key exports |
| --- | --- | --- |
| `color.ts` | sRGB → CIELAB (D65), CIEDE2000 ΔE, WCAG 2.2 luminance & contrast | `deltaE2000`, `contrastRatio`, `wcagLevel`, `hexToRgb` |
| `claims.ts` | Claim model, validity windows, publish-horizon evaluation | `evaluateClaim`, `addDays`, `daysBetween`, `claims` |
| `voice.ts` | Tokenisation, cadence metrics, weighted authorial fidelity | `computeVoiceMetrics`, `voiceFidelity`, `tokenPatches` |
| `airlock.ts` | Local PII/codename detection, reversible vault tokens, risk scoring | `analyzePayload`, `maskValue`, `entityTypeMeta` |

### Colour science
`hexToRgb → linearise → XYZ → Lab`, then the full Sharma et al. CIEDE2000 formulation (hue-angle handling, `S_L/S_C/S_H` weighting, `R_T` rotation term). Contrast uses WCAG relative luminance with the standard `(L1 + 0.05) / (L2 + 0.05)` ratio.

### Temporal logic
`evaluateClaim(claim, publishDate, today)` returns a state, severity and human-readable reason. Evaluation order is deliberate:

1. `publishDate > claim.expires` → **EXPIRED AT PUBLISH** (blocked)
2. any `CONTRADICTED` evidence → **CONTRADICTED** (blocked)
3. any `PENDING` evidence → **EVIDENCE PENDING** (watch)
4. `expires − publishDate ≤ 7d` → **EXPIRES ≤ 7D** (watch)
5. otherwise → **VALID** (clear)

### Voice fidelity
Sentence geometry and cadence dominate the weighting because they are what readers actually recognise as "the author". Lexical overlap is only 14% — swapping a word is cheap; rewriting a rhythm is not.

### Airlock detection
Ordered regex passes for structured entities (email, IP, phone, secret-shaped strings, addresses) plus a curated lexicon for codenames and program names. Overlaps are resolved by span, then each hit is replaced with a typed vault token (`⟦CODENAME-01⟧`) and a reverse mapping is retained in memory for the session.

---

## Design system

A forensic instrument, not a dashboard. The reference points are Palantir Foundry's density and Linear's restraint — near-black surfaces, warm ivory type, and a single acid accent used only where the system is making a judgement.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#070908` | App background |
| `--surface` | `#0b0e0c` | Panel surface |
| `--text` | `#ecefe7` | Primary ivory |
| `--acid` | `#d8ff4f` | Verdict / active / clearance |
| `--amber` | `#ffb547` | Watch state |
| `--red` | `#ff5c5c` | Block / leak / contradiction |
| `--blue` | `#8ab4ff` | Evidence / neutral data |
| `--teal`, `--violet`, `--rose` | — | Entity classes in the Airlock |

**Type:** Space Grotesk (display / numerals), Inter (body), JetBrains Mono (micro-labels, IDs, evidence). Micro-labels run as small as 5px with wide tracking — legible at 1× because they're uppercase mono, and they create the instrument-panel texture.

**Structure:** 12-column grid with `span-4/5/6/7/8/12` utilities, hairline `rgba` borders, a faint engineering grid on the app shell, bracketed panel corners on primary surfaces, and a sticky sidebar rail.

**Motion:** compilation stages illuminate sequentially, a scanline sweeps the Airlock editor, status dots pulse on live state, and the verdict ring animates from zero. No decorative animation that doesn't encode state.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit only
```

**Stack:** Vite 8 · React 19 · TypeScript 7 · lucide-react · motion (spring physics). No UI framework, no CSS-in-JS, no state library. Styling is hand-written CSS with custom properties; studio state is a single React context (`src/state/studio.tsx`) and the judge layer is a second, nested context (`src/sim/SimulationProvider.tsx`).

The demo is fully local-first — there is no backend, no network call, and no telemetry. Every verdict is computed in the browser at render time.

---

## Interactions worth trying

| Action | Where |
| --- | --- |
| `Ctrl/⌘ + K` | Global command palette — jump to any module or action |
| Select Dataset A / B | Gateway — hydrate a full crisis scenario, then follow the tour |
| `Run compilation` | Command Deck — replays the full six-stage audit |
| `Switch crisis scenario` | Command palette — reopens the sandbox gateway |
| `Restart judge tour` | Command palette — replays the three-step walkthrough |
| Drag the publish horizon | Temporal Truth — watch claims expire *before* they ship |
| Click any ledger row | Temporal Truth — retargets the evidence graph and inspector |
| Switch to `LLM rewrite` | Voice DNA — fidelity collapses, warning banner appears |
| `Authorize patch` | Voice DNA — commits the surgical diff |
| Type in the payload editor | Airlock — entities are detected as you type |
| `Preview leak` | Airlock — bypasses the membrane, turns the egress hostile |
| `Approve sanitized egress` | Airlock — one-way commit, calls counter increments |

**Deep links:** every screen is addressable — `#/command`, `#/visual`, `#/temporal`, `#/voice`, `#/airlock`. State survives refresh; the back/forward buttons work.

**Responsive:** full rail ≥1200px → 76px icon rail ≤1200px → stacked panels ≤1000px → fixed bottom module bar ≤760px. Data tables collapse their least-critical columns ≤620px rather than scrolling horizontally. The evidence graph becomes horizontally pannable on phones.

---

## Project layout

```
src/
├── App.tsx                  shell, keyboard handling, screen routing
├── main.tsx                 mount
├── components/
│   ├── ui.tsx               Panel, Badge, Meter, Segmented, Toggle, StatCard, Sparkline…
│   ├── Sidebar.tsx          brand block, module nav, operator card
│   ├── Topbar.tsx           breadcrumb, search, UTC clock, system state
│   ├── CommandPalette.tsx   Ctrl/⌘+K navigation + actions
│   └── Logo.tsx             AURA mark
├── core/                    deterministic engines (framework-free)
│   ├── color.ts
│   ├── claims.ts
│   ├── voice.ts
│   └── airlock.ts
├── data/
│   ├── brand.ts             palette, geometry rules, specimen regions
│   └── overview.ts          pipeline stages, compile logs, feed, radar
├── screens/                 the five modules
│   ├── Overview.tsx
│   ├── VisualForensics.tsx
│   ├── TemporalTruth.tsx
│   ├── VoiceDNA.tsx
│   └── Airlock.tsx
├── sim/                     judge simulation layer (presentation only)
│   ├── SimulationProvider.tsx  gateway → tour → free state machine
│   ├── scenarios.ts            Dataset A/B content + recomputed palettes
│   ├── WelcomeModal.tsx        un-dismissible sandbox gateway
│   ├── TourLayer.tsx           measured spotlight + floating tooltip
│   ├── types.ts                scenario / tour types
│   └── sim.css                 gateway, cards, tour, chip
├── state/
│   ├── studio.tsx           context: screen, hash routing, toasts, compile, publish offset
│   └── navigation.ts        screen metadata
└── styles/
    ├── tokens.css           design tokens
    ├── shell.css            app frame, sidebar, topbar, page grid
    ├── ui.css               shared primitives
    ├── screens.css          command deck
    ├── visual.css           visual forensics
    ├── temporal.css         temporal truth
    ├── voice.css            voice dna
    ├── airlock.css          zero-trust airlock
    └── responsive.css       all breakpoints
```

---

## Design decisions

**Why no charting library?** Every visualisation here is bespoke — a ΔE heatmap over a poster, a claim-vs-time ruler, an evidence graph with a publish horizon, a cadence waveform. A charting library would have been more code to fight than to write.

**Why a pinned `TODAY`?** `TODAY = '2026-11-12'` makes the demo reproducible: the same claim states, the same ΔE values, the same fidelity scores on every machine, forever. Swap it for `new Date()` to make the engine live.

**Why does the Airlock keep the raw text in memory?** Because the tokens are *reversible* — the point is that the model never sees the raw value, not that the operator can't. The vault is session-scoped and never serialised.

**Why penalise the LLM rewrite so hard?** Because the failure mode is real. A rewrite can be more compliant and less yours. The fidelity score is designed to make that trade-off visible instead of hiding it behind "brand-safe".

---

## Roadmap

- **Real asset ingestion** — image upload → canvas sampling → automatic region segmentation, replacing the hand-authored specimen regions.
- **Evidence connectors** — pull claim evidence from internal ledgers and research APIs, with signed timestamps.
- **Server-side vault** — move the Airlock vault to a KMS-backed session store so tokens can be re-hydrated across devices.
- **Rule authoring** — let governance teams define geometry, tone and claim rules as data, not code.
- **Audit export** — signed, timestamped clearance receipts (PDF + JSON) suitable for regulatory review.
- **Diff-aware recompilation** — only re-run stages whose inputs changed.

---

## Status

Foundation build. All five modules are functional, fully responsive, keyboard-navigable, and type-clean. The judge simulation layer adds an un-dismissible scenario gateway and a three-step guided tour. `npm run build` passes; no runtime errors in Chrome.

Not yet implemented: persistence, authentication, real model calls, and asset upload. The Airlock's external model is represented by the egress manifest rather than an actual request — by design, for a local-first demo.
