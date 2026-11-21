# AURA-GOV

**A deterministic brand-clearance compiler.**

AURA-GOV treats every asset — a poster, a headline, a launch claim, a paragraph of copy — as a hypothesis that must survive independent audits before it ships. Four domain engines produce measurements; one compiler turns those measurements into a single, reproducible clearance report.

Everything runs in the browser tab. No backend, no model call, no upload, no telemetry.

```
raw asset ──▶ ZERO-TRUST AIRLOCK ──▶ tokenized payload
                    │
      ┌─────────────┼─────────────┬─────────────┐
      ▼             ▼             ▼             ▼
  VISUAL         TEMPORAL       VOICE        ARBITER
  CIEDE2000      claim expiry   fidelity     routing
  WCAG 2.2       evidence       cadence      confidence
  geometry       publish gate   lexical      fallbacks
      └─────────────┼─────────────┴─────────────┘
                    ▼
            CLEARANCE COMPILER
        score · verdict · trace hash
```

---

## What this is — and what it is not

This project is deliberately honest about its boundaries. The goal is that every claim on screen can be traced to a function you can read.

| Claim | Reality |
| --- | --- |
| “Deterministic clearance” | Real. Pure TypeScript functions in `src/core`, no randomness in the scoring path. The same inputs produce the same score and SHA-256 trace hash. |
| “Autonomous Multi-Engine Arbiter” | A deterministic **multi-engine ensemble** of four symbolic lanes (Voice, Visual, Airlock, Temporal), not four LLMs. Confidence is derived from each engine’s own measurements. **0 external LLM calls.** |
| “Continuous Visual Regression & DOM Drift Radar” | A real `MutationObserver` watching a sandboxed specimen. It measures CIEDE2000 drift, WCAG contrast and layout geometry, coalesces mutation bursts, and can quarantine/revert. It is not a production site crawler. |
| “Enterprise Multi-Tenant Policy Vault” | Real per-tenant policy, per-issuance random tokens, TTL expiry, RBAC and a SHA-256 chained ledger persisted in `localStorage`. It is not a KMS/HSM and does not encrypt at rest. |
| “Neuro-symbolic” | The symbolic half is real and inspectable. There is no neural network in this build; the “LLM rewrite” is a fixed counter-example used to demonstrate why generative rewriting fails brand-voice preservation. |
| “Zero network” | Real. Fonts are self-hosted, no analytics, no API calls. You can run the production build with the network disconnected. |

The numbers are computed, not screenshotted. The one place fixtures are used is the *content* being audited (poster theme, claim set, draft copy, payload); the judgement is always derived.

---

## The single source of truth

`src/core/compiler.ts` is the spine of the product. `buildClearanceReport(scenario, publishOffset)` derives, in one pass:

- the airlock analysis and sanitized egress,
- temporal evaluations at the scheduled publish date,
- visual palette drift, WCAG checks and geometry checks,
- voice fidelity metrics,
- the weighted domain scores and overall verdict,
- the six pipeline stages, six trace log lines, note list and radar axes,
- the arbiter routing table,
- a SHA-256 trace hash over the canonical report payload.

Every screen consumes that report. There is no screen-local arithmetic that can drift out of sync, which is why the Command Deck, Visual, Temporal, Voice and Airlock views always agree.

---

## The eight engines

| Module | Responsibility | Core exports |
| --- | --- | --- |
| `core/color.ts` | sRGB → CIELAB (D65), CIEDE2000 ΔE, WCAG 2.2 relative luminance and contrast | `deltaE2000`, `contrastRatio`, `wcagLevel`, `driftVerdict` |
| `core/claims.ts` | Claim model, validity windows, evidence graph, publish-horizon evaluation | `evaluateClaim`, `addDays`, `daysBetween`, `claims` |
| `core/voice.ts` | Tokenization, sentence geometry, cadence, weighted authorial fidelity | `computeVoiceMetrics`, `voiceFidelity`, `tokenPatches` |
| `core/airlock.ts` | PII/regulated-identifier detection, Luhn validation, typed vault tokens, risk scoring | `analyzePayload`, `luhnValid`, `maskValue` |
| `core/vault.ts` | Tenant policies, issuance, TTL, RBAC, SHA-256 receipt chain, persistence | `mintIssuance`, `applyTenantPolicy`, `appendReceipt`, `tamperLedger` |
| `core/arbiter.ts` | Confidence routing across four lanes with symbolic fallbacks | `runArbiterPass`, `ARBITER_THRESHOLD` |
| `core/domRadar.ts` | Live DOM mutation measurement, layout drift, quarantine | `createDomRadar`, `ROGUE_PRESETS` |
| `core/compiler.ts` | Report derivation, scoring, trace hash, stage/log/note synthesis | `buildClearanceReport`, `buildBaselineReport` |

All eight are framework-free TypeScript. They can run in a worker, a CLI or a server without modification.

### Colour science

`hexToRgb → linearise → XYZ → Lab`, then the full Sharma et al. CIEDE2000 formulation, including hue-angle handling, `S_L/S_C/S_H` weighting and the `R_T` rotation term. Contrast uses WCAG relative luminance with `(L1 + 0.05) / (L2 + 0.05)`.

Verified against the published Sharma reference pairs (2.0425, 2.8615, 3.4412, 1.0000) and the canonical 21:1 black/white ratio.

### Temporal logic

`evaluateClaim(claim, publishDate)` returns a state, severity and reason. Evaluation order is deliberate:

1. `publishDate > claim.expires` → **EXPIRED AT PUBLISH** (blocked)
2. any contradicted evidence → **CONTRADICTED** (blocked)
3. any pending evidence → **EVIDENCE PENDING** (watch)
4. `expires − publishDate ≤ 7d` → **EXPIRES ≤ 7D** (watch)
5. otherwise → **VALID** (clear)

Operator quarantine/clear overrides are persisted in `localStorage` and applied on top of the deterministic result, with the override shown explicitly in the UI and export.

### Voice fidelity

Sentence geometry and cadence dominate the weighting because they are what readers recognise as authorship. Lexical overlap is only 14%. The surgical patch scores in the mid-90s; the LLM rewrite collapses — same compliance outcome, radically different authorship survival.

### Airlock detection

Structured detectors for email, IP, phone, IBAN, payment card (with Luhn), SSN, date of birth, medical record number, secret-shaped strings and addresses, plus a curated lexicon for codenames and programme names. Overlaps are resolved by span; each hit becomes a typed token such as `[PERSON_01]` and the sanitized payload never contains the raw value.

---

## Round 3: the three deep features

### 1 · Autonomous Multi-Engine Arbiter

The Command Deck’s arbiter panel runs `runArbiterPass` over four lanes. Each lane’s confidence comes from real engine output:

- **Voice** — fidelity score and buzzword count,
- **Visual** — maximum ΔE and failing WCAG checks,
- **Airlock** — entity count and residual risk,
- **Temporal** — blocked claims and evidence state.

Lanes at or above `0.85` resolve in place. Lanes below it reroute to an independent symbolic cross-check, with the exact route, fallback engine and reason rendered in the table. The final per-lane score is a **fusion**: the cross-check's confidence is discounted by how far it diverges from the uncertain primary, so a fallback can never inflate the number. The gauge shows the fused mean, and “Simulate < 0.85 edge case” depresses every primary so you can watch the fused confidence drop while the routing table escalates all four lanes.

### 2 · Continuous Visual Regression & DOM Drift Radar

The Visual Forensics screen mounts a real `MutationObserver` over a specimen node. Inject a colour, node-count or geometry mutation and the radar measures:

- CIEDE2000 distance from the brand baseline,
- WCAG contrast for the mutated text and an independent worst-contrast surface,
- layout drift in pixels against a 2px tolerance,
- mutation count and coalescing window.

The verdict includes contrast failure, not just colour drift. Auto-quarantine holds the FAIL reading for 1.8s, restores the baseline and records the revert; turning it off lets you inspect the drift and revert manually. The four presets (`MUT-01` … `MUT-04`) are real DOM mutations, not animations.

### 3 · Enterprise Multi-Tenant Policy Vault

The Airlock screen hosts a local vault with three tenant profiles:

| Tenant | Posture | What changes |
| --- | --- | --- |
| `TENANT-FINTECH` | Strict | Maximum redaction, short TTL, high residual-risk scrutiny |
| `TENANT-HIPAA` | Clinical | PHI identifiers redacted, clinical egress policy |
| `TENANT-RETAIL` | Pragmatic | Minimal necessary redaction, longer TTL |

Every issuance mints **new random token suffixes**, so token values are not predictable across runs. Tokens expire on a real TTL countdown. The RBAC segmented control gates issue/revoke/tamper/verify capabilities (`OPERATOR` vs `AUDITOR`). Every action appends a SHA-256 receipt linked to the previous hash; the ledger persists in `localStorage` under `aura-gov.vault.ledger.v2`. “Tamper” corrupts a receipt and “Verify” locates the first broken link. The audit trail exports as JSON.

---

## Judge walkthrough

The sandbox opens on a gateway with two staged incidents:

| Dataset | Incident | What hydrates |
| --- | --- | --- |
| **A** | Visual & Temporal Crisis | Off-brand poster, expired promo claim, ΔE/WCAG/geometry findings, publish horizon `T+09` |
| **B** | Privacy & Voice DNA Breach | Unredacted press release with regulated identifiers, LLM rewrite selected, publish horizon `T+03` |

Selecting a dataset hydrates every screen through the compiler. The five-step guided walkthrough then:

1. **Execute the six-stage deterministic scan** — the stage pipeline actually runs.
2. **Autonomous Multi-Engine Arbiter** — inspect confidence and reroutes.
3. **Continuous DOM Drift Radar** — inject a mutation, watch measurement and quarantine.
4. **Enterprise Multi-Tenant Policy Vault** — switch tenants, re-issue, tamper, verify.
5. **Surgical Voice DNA patch** — apply six lexical substitutions and seal remediation.

You can skip the tour at any time (“Explore without the tour”) or restart it from the command palette. The simulation layer only drives navigation and fixtures; it never bypasses the engines.

---

## Screens

**01 · Command Deck** — compiler operating surface: six-stage pipeline, live trace console, weighted clearance ring, verdict feed, portfolio drift radar, arbiter routing table. “Run compilation” replays the audit and produces the same trace hash for the same inputs.

**02 · Visual Forensics** — hand-built SVG specimen with addressable regions. Palette drift, WCAG checks, geometry rules, probe readout, heatmap overlay, DOM drift radar, auto-quarantine, JSON export.

**03 · Temporal Truth** — claim ledger against a movable publish horizon (`T+00` … `T+75`). Evidence graph, inspector, persisted quarantine/clear overrides, gate state, JSON ledger export.

**04 · Voice DNA** — three-way diff (author draft / surgical patch / LLM rewrite), six-token patch ledger with rules and rationale, weighted fidelity gauge, commit state, JSON diff export.

**05 · Zero-Trust Airlock** — live payload editor, entity register with rule and confidence, sanitized egress manifest, flow diagram, leak simulation, egress approval, multi-tenant vault, RBAC, TTL, SHA-256 receipt chain and audit export.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit only
npm test           # vitest run
```

**Stack:** Vite 8 · React 19 · TypeScript 7 · lucide-react · motion. No UI framework, no CSS-in-JS, no state library. Styling is hand-written CSS with custom properties; studio state is a React context, and the sandbox layer is a second, nested context.

**Fonts:** Inter, JetBrains Mono and Space Grotesk are self-hosted variable WOFF2 files in `public/fonts` (SIL OFL). There are no third-party requests at runtime.

**Persistence:** only the vault ledger (`aura-gov.vault.ledger.v2`) and temporal overrides (`aura-gov.temporal.overrides.v1`) are stored locally. Clearing site data resets the demo.

---

## Tests and CI

`npm test` runs 25 assertions against the real engines:

- CIEDE2000 against Sharma reference pairs and drift thresholds,
- WCAG contrast ratios and level assignment,
- SHA-256 against FIPS 180-4 vectors and Node `crypto` across lengths and Unicode,
- airlock detection of regulated identifiers, Luhn validation, sanitization and masking,
- vault issuance uniqueness, tenant redaction, TTL expiry and receipt-chain tamper detection,
- temporal expiry-before-publish behaviour,
- compiler invariants: stage/log counts, cross-screen agreement, determinism, PII block verdict,
- arbiter fusion: fallbacks never inflate confidence and stress mode lowers the fused mean.

`.github/workflows/ci.yml` runs typecheck, tests and a production build on every push and pull request.

### Runtime verification

With `npm run preview -- --port 4173` serving the production build, three headless-Chrome scripts exercise the real UI:

```bash
npm run smoke  # all five screens at 1440 / 1024 / 768 / 390, overflow + console + network checks
npm run tour   # the full five-step guided walkthrough, ending on the Voice patch
npm run e2e    # 47 interactive assertions: dataset switch, arbiter stress, radar injection,
               # quarantine, temporal override + reload persistence, voice commit + export,
               # tenant/RBAC/TTL/tamper/verify/export, palette, deep links
```

The scripts use the locally installed Chrome via `puppeteer-core`; they are not part of CI because they need a browser binary.

---

## Interactions

| Action | Where |
| --- | --- |
| `Ctrl/⌘ + K` | Command palette — navigation, dataset switch, exports, tour restart |
| `G 1` … `G 5` | Jump to a screen |
| `Run compilation` | Command Deck — replay the six-stage audit |
| Drag the publish horizon | Temporal Truth — watch claims expire before they ship |
| Click a ledger row | Temporal Truth — retarget evidence graph and inspector |
| `Quarantine claim` / `Clear for publish` | Temporal Truth — persisted override |
| Switch to `LLM rewrite` | Voice DNA — fidelity collapses, warning appears |
| `Authorize surgical patch` | Voice DNA — commit the diff |
| Type in the payload editor | Airlock — entities detected as you type |
| `Simulate leak` | Airlock — bypass the membrane, turn egress hostile |
| Switch tenant / re-issue / tamper / verify | Airlock vault |
| `Simulate < 0.85 edge case` | Command Deck arbiter |
| Inject mutation / auto-quarantine | Visual Forensics radar |

**Deep links:** `#/command`, `#/visual`, `#/temporal`, `#/voice`, `#/airlock`. A cold load honours the hash even after bypassing the gateway. Back/forward work; state survives refresh.

**Responsive:** full rail ≥1200px → icon rail ≤1200px → stacked panels ≤1000px → fixed bottom bar ≤760px. All data tables and controls are reflowed rather than horizontally scrolled, and the shell is verified for no horizontal overflow at 390px.

**Accessibility:** every interactive control is a real button with a label, the command palette is keyboard-driven with a visible focus ring, status is never conveyed by colour alone (labels and icons accompany tone), and the type scale has a 9px floor for information-bearing micro-labels enforced in `src/styles/legibility.css`.

---

## Project layout

```
src/
├── core/                 deterministic engines + compiler + tests
│   ├── compiler.ts       single source of truth for every screen
│   ├── color.ts          CIEDE2000 / WCAG
│   ├── claims.ts         temporal engine
│   ├── voice.ts          fidelity engine
│   ├── airlock.ts        PII detection + sanitization
│   ├── vault.ts          tenants, tokens, ledger, SHA-256
│   ├── arbiter.ts        confidence routing
│   ├── domRadar.ts       MutationObserver measurement
│   └── __tests__/        vitest suite
├── screens/              five operating surfaces
├── components/           shell, UI primitives, palette
├── sim/                  sandbox gateway, tour, scenarios
├── state/                studio context, navigation
├── styles/               hand-written CSS, tokens, responsive, legibility
└── lib/                  download helpers
```

---

## Known limits

- No backend, database, authentication or multi-user sync. The vault and ledger are local to the browser profile.
- The ledger is tamper-evident (chained hashes), not tamper-proof; a user with devtools can rewrite the whole chain. That is stated in the UI.
- The DOM radar watches a sandboxed specimen, not arbitrary production pages.
- The arbiter routes between symbolic engines; it does not call external models.
- The claim set, poster, draft copy and payload are demo fixtures. The evaluation of them is real.

These boundaries are deliberate. The interesting claim is not “we built everything”; it is “every number you see is computed by code you can audit”.
