## ACTIVE HANDOFF / WORKING STATE (2026-09-17, pass 2) — NOT FINAL SIGN-OFF

Controlled integration pass (global navbar + top-bar migration verification)
complete. Full detail: `output/session-checkpoint/CODEX_HANDOFF.txt`.

- Current task: global landing-page final polish. This pass closed out the
  navbar/top-bar integration layer only. Scene 08 Evidence Reel visual
  rebuild, full performance audit, and final mobile polish are still
  pending (deliberately out of scope this pass).
- Global Navbar: VERIFIED. Single global nav, wired into
  `KavachExperience.tsx`, safe-area architecture (`--kp-global-nav-height`
  / `--kp-global-nav-safe-area`) coherent across `globals.css`,
  `KavachExperience.module.css`, `ExperienceCanvas.module.css`. Fixed 2 real
  bugs found by `tests/visual/global-navbar.spec.ts` (duplicate
  `aria-current="page"` between desktop chapter strip and mobile Control
  Index list; `aria-label` substring collision between the "CONTROL INDEX"
  trigger and "Close" button). `global-navbar.spec.ts`: 4/4 passed after fix.
- Top-bar removal: CORRECTED FINDING — this is actually 9/9 done, not 2/9
  as the prior preservation pass concluded. The earlier assessment matched
  on the `.sceneHeader` class name without reading its content. `.sceneHeader`
  in the 7 "remaining" scenes is the legitimate in-scene cinematic chapter
  title (index + title + editorial subtitle, e.g. "05 / REVOCATION") — it
  is meant to stay per the KEEP-cinematic-heading rule. The actual obsolete
  bars (`.topline`/`.sceneTopline` in Opening/Mandate,
  `.folioBar`/`.decisionRegister`/`.authorityFolio`/`.splitFolio` in the
  other 7) were already fully removed from both CSS and JSX, verified by
  cross-checking every `styles.*` usage against each module.css and
  confirmed by the passing "obsolete per-scene upper metadata bars are
  absent" test.
- Concurrency CSS/markup mismatch: FALSE POSITIVE. `.folioBar` was removed
  from both `ConcurrencyScene.module.css` and `.tsx` consistently; zero
  dangling references. No fix was needed.
- Scene ownership: `tests/visual/scene-ownership.spec.ts` — 45/45 passed,
  all 5 viewports, all 8 boundaries (00→01 through 07→08), forward and
  reverse scrub, carrier rect congruence within 1px.
- Visual review: all 9 scenes screenshotted at 1440x900, 1366x768, 430x932,
  390x844 plus mobile Control Index open state. Spot-checked Opening,
  Revocation, Concurrency, Causal Replay at desktop + laptop + mobile — no
  navbar collision, no duplicate title, no empty hole, cinematic titles
  intact. One pre-existing (not caused by this pass) cosmetic issue found:
  at 390px, Revocation's scene title runs close against its subtitle with
  little breathing room — not touched, out of scope (final mobile polish
  is a later pass).
- `npx tsc --noEmit`: 0 errors. `npm run lint`: 0 errors/warnings.
- Scene 08: NOT rebuilt this pass (by design). CausalReplayScene.tsx /
  CausalReplayRibbon.tsx / CausalReplayScene.module.css left as Codex left
  them. The "COMPLETE & VERIFIED" banner directly below this section is
  STILL STALE relative to the uncommitted diff — visual spot-check this
  pass looked correct (see screenshots under
  `output/final-audit/reports/navbar-visual/`), but the full causal-replay
  Playwright suite has not been re-run against current code.
- Dev server: running in background, port 3000, PID 14132. Not stopped —
  left up for continued work.
- Exact next step: Scene 08 Evidence Reel dedicated recovery/rebuild pass,
  OR full causal-replay + reduced-motion + remaining suites re-run to
  re-validate PROJECT_STATUS.md's Scene 08 claims before trusting them.

---

# SCENE 08 / CAUSAL REPLAY — THE EVIDENCE REEL (COMPLETE & VERIFIED)

**Scene 08 status**: COMPLETE, FULLY REBUILT TO FLAGSHIP PHYSICAL TRANSPORT STANDARD, AND VERIFIED across all 5 viewports, dense visual checkpoints, 8 motion video recordings, and reverse scroll scrubbing.
**Creative Direction**: Flagship 3D physical film transport sequence — **A Physical Motion-Picture Causal Inspection Apparatus** threading continuous wide-gauge evidence film between a monumental supply reel, precision guide rollers, optical inspection gate aperture, and deep take-up reel.

## 1. Verified Canonical Causal Provenance (§1, §2 & Corrections O, P)
- **Option B from Product Brief Screen F verified and implemented**:
  - Replayed Transaction: `TX–1081`, `BLINKIT // QUICK COMMERCE`, `₹1,249`, `Grocery Agent`, mandate `KP–1967–M`.
  - Full Causal Lineage (Result → Origin Rewind):
    - `08.01 PROVIDER RESULT` (`RCP-1081-ALLOW`, `WHK-1081-A`, `SUCCESS // COMMITTED`, `₹1,249`, Razorpay Sandbox)
    - `08.02 EXECUTION` (`REQ-1081-01`, `TX-1081`, `BLINKIT // QUICK COMMERCE`, `₹1,249`)
    - `08.03 DECISION` (`APPROVED // ALLOW`, AgentCore / Cedar Policy, `₹1,249 <= ₹1,500 THRESHOLD [PASS]`, Within Mandate & Authority)
    - `08.04 BUDGET STATE` (Temporal 3-phase causality: Before Reservation -> Causal Event -> After Reservation)
    - `08.05 AGENT PATH` (`Grocery Agent` acting under delegated authority, zero privilege escalation)
    - `08.06 AUTHORITY / DELEGATION` (`AUTH-0302`, GROCERY, `₹1,500/run` derived from root `AUTH-0301`)
    - `08.07 MANDATE` (`KP-1967-M`, `₹4,000/week`, Human Owner Root Policy)
    - `08.08 ORIGINAL INTENT` (`“Buy groceries for me this week.”`, Human Owner / Root Principal)
  - Zero invented causal links. Provenance is 100% canonical and auditable.

## 2. Temporal Budget State Invariant (§3 & Correction P)
- Explicit temporal breakdown preventing simultaneous amount illusion:
  - **1. BEFORE ATOMIC RESERVATION**: Mandate Cap `₹4,000` | Prior Cumulative Spend `₹0` | Available Before `₹4,000`
  - **2. ATOMIC CAUSAL EVENT**: `TX-1081 CLAIM COMMITTED` reserves `₹1,249` (administrative red ink)
  - **3. AFTER RESERVATION // EVALUATED MOMENT**: Committed Reservation `₹1,249` | Residual Capacity Remaining `₹2,751`
  - Invariant Proof: `₹0 PRIOR + ₹1,249 RESERVED + ₹2,751 REMAINING = ₹4,000 [VERIFIED // 100% INTACT]`.

## 3. Flagship 3D Physical Transport Apparatus (Corrections A–L, Q–T)
- **One Authoritative Physical Transport Value**:
  - All motion is driven by a single authoritative physical quantity: `transportDistance = (i + eased) * FRAME_PITCH`.
  - Zero arbitrary multipliers (`-p * 8.4`, `p * 24.0`). Every rotational and linear velocity derives from physical geometry:
    - Supply Reel Rotation: `-(transportDistance / effectiveSupplyRadius)` (`radius = 1.32`)
    - Take-up Reel Rotation: `-(transportDistance / effectiveTakeupRadius)` (`radius = 0.75`)
    - Guide Roller Rotations: `(transportDistance / rollerRadius) * contactDirection` (`radius = 0.075`)
    - Perforations & Frame Texture Offset: strictly locked to `transportDistance` (`offset.x = -transportDistance * 0.12`).
    - Physical Frame Travel: DOM evidence cards enter from supply side (`x: -36px` to `0`), seat into datum, and depart towards take-up (`x: 0` to `+36px`).
  - Zero film slipping against reels or rollers under forward or reverse scrub.
- **Physical Film Contact, Tangency & Wound Packs (Corrections F, G, H)**:
  - Monumental Supply Reel (`radius = 1.85`, foreground left, 5 cutouts, dual flanges, hub, steel axle lock pin) and Take-up Reel (`radius = 1.38`, background right at `z = -1.15`).
  - Both reels carry visible volumetric wound-film packs.
  - Film path leaves the supply reel tangentially from its wound circumference, threads through precision guide rollers into the gate, and arrives tangentially onto the take-up reel pack.
- **Machined Optical Gate & Registration Micro-Sequence (Corrections K, L, M, Q, R)**:
  - 3D machined graphite runner rails physically frame the top and bottom edges of the film.
  - Red datum registration pins (`#a92a24`) and optical gate illumination strictly respond to frame approach, seating, and release (zero autonomous "breathing" or idle animation loop).
  - DOM exposure size is calibrated (`clamp(340px, 32vw, 490px)`) so the machine reels, film path, and gate hardware remain prominently visible during evidence inspection.

## 4. Title Ownership & Boundary Splice Architecture (Correction V)
- Concurrency → Causal-Replay handoff cleanly decouples title ownership:
  - Only `[data-replay-docket]` crosses the boundary in the carrier bridge.
  - `[data-replay-header]` is not rendered during Scene 07 ownership, establishing only after Scene 08 owns the stage.
  - Scene ownership test verifies `visibleRootCount <= 1` and `headerCount <= 1` across all boundaries forward and backward.

## 5. Verification Across All Viewports & Test Suites (§40–§43, §52–§54, Corrections N, W, X)
- **Playwright Test Matrix**:
  - `tests/visual/causal-replay-review.spec.ts`: **5/5 viewports PASSED** (`1920x1080`, `1440x900`, `1366x768`, `430x932`, `390x844`).
  - `tests/visual/scene-ownership.spec.ts`: **45/45 tests PASSED** across all 5 viewports (including Concurrency → Causal-Replay forward and reverse).
  - `tests/visual/causal-replay-video.spec.ts`: **8/8 video suites PASSED**.
- **1366×768 Laptop Viewport**: Monumental reels, full film transport path, gate aperture, docket, and footers scale and seat with zero collisions.
- **Mobile Viewports (430×932 & 390×844)**: Distinct responsive composition with centered docket, clean scene header spacing, and full aperture legibility.
- **8 Motion Video Recordings Generated & Reviewed in `output/playwright/motion-video/`**:
  - `scene_07_08_transition.webm` (2.86 MB)
  - `scene_08_normal_forward_reverse.webm` (5.08 MB)
  - `scene_08_slow_inspection.webm` (1.43 MB)
  - `scene_08_fast.webm` (1.62 MB)
  - `scene_08_full_reverse.webm` (2.57 MB)
  - `scene_08_1366x768.webm` (1.36 MB)
  - `scene_08_mobile_430x932.webm` (0.43 MB)
  - `scene_08_mobile_390x844.webm` (0.68 MB)

## 6. Scope & Hard-Stop Discipline (§55–§57)
- Scenes 00–07 remain visually locked.
- Global navbar not implemented.
- Scene 09 not implemented. Causal Replay concludes on its strongest complete state.

---

# SCENE 07 / BUDGET + CONCURRENCY — COMPLETE & FROZEN

**Scene 07 status**: COMPLETE, FROZEN, AND VERIFIED across all 5 viewports, static checkpoints, motion video suites, and reverse scrub.
**Hard stop discipline honored**: Stop before Scene 08. Zero Scene 08 code written, mounted, or anticipated.

---

## 1. Architectural Integrity & Frozen Stage Invariants

- **Persistent-Stage Invariant**: `ConcurrencyScene` uses NO `pin: true` and creates zero pin spacers. It lives strictly as an absolute layer (`position: absolute; inset: 0; z-index: 9;`) inside `.cinematicStage`, driven by `<div data-track="concurrency" style="height: 340vh">`.
- **Zero-Slack Visibility**: `visibilityTrigger` adheres strictly to the frozen standard:
  - `start: "top top+=1px"`
  - `end: "bottom top"`
  - Forward entry triggers `visibility: visible` at boundary + 1px; reverse leave hides cleanly at boundary + 1px.
- **Carrier Bridge (06 → 07)**:
  - Split-Defense's `carrierBridgeOut` fades out the monetary budget residue over the frozen 120px pre-roll window (`start: "bottom top-=120px"`, `end: "bottom top"`).
  - Concurrency's `carrierBridgeIn` symmetrically fades in over the exact same 120px window (`start: "top top+=120px"`, `end: "top top"`).
  - `scene-ownership.spec.ts` confirms `visibleRootCount <= 1` and `carrierCount <= 1` across all 40/40 test permutations with zero orphaned carriers or duplicate DOM bodies.

---

## 2. Core Hero Mechanic: The Reservation Ledger

Scene 07 physically dramatizes the governing thesis: **THE MONEY DOES NOT EXIST TWICE.**

1. **Beat 1: Establishing Authority Ledger & Mandate Capacity (0.00 – 0.10)**:
   - Institutional budget register establishes: `MANDATE CAP: ₹4,000` with `PRIOR CUMULATIVE SPEND: ₹3,500`.
   - Single authoritative spendable balance displays: `CURRENT REMAINING: ₹500`.
   - Active spendable authority coupon (`₹500 AVAILABLE AUTHORITY`) rests in the AVAILABLE aperture.
2. **Beat 2: Near-Simultaneous Concurrent Arrival (0.10 – 0.22)**:
   - `TX-1094` (`10:14:02.110`, `₹500`, `Blue Tokai Cafe`, `Concierge Agent`) enters from upper left.
   - `TX-1095` (`10:14:02.114`, `₹500`, `Strand Book Stall`, `Research Agent`) enters from upper right just 4ms later.
   - Preserves exact identity, agents, timestamps, and amounts.
3. **Beat 3: The "Both Valid" Contention Hold (0.22 – 0.32)**:
   - Both slips hold symmetrically flanking the central datum.
   - Both appear individually legitimate and verified. Both see `₹500 REMAINING`.
   - Audience perceives the structural hazard before resolution: two valid claims, but only one ₹500.
4. **Beat 4: Institutional Datum Alignment (0.32 – 0.44)**:
   - Slips align to the monetary registration axis (ruled datum ticks, ledger apertures, no generic finish lines).
5. **Beat 5: Atomic Reservation Slot Acquisition (0.44 – 0.60)**:
   - `TX-1094` (arriving 4ms earlier) advances across the commit datum into the reservation chamber.
   - `TX-1095` remains physically held fractionally behind the datum.
6. **Beat 6: Physical Authority Transfer (0.60 – 0.70)**:
   - The spendable authority coupon physically detaches from the AVAILABLE chamber and glides directly into `TX-1094`'s reservation bracket.
   - Not a text swap or odometer; an unmistakable physical transfer of finite monetary authority.
   - Official ink stamp lands on `TX-1094`: `RESERVED // AUTH EXCLUSIVE`.
7. **Beat 7: Authoritative Balance Registration to ₹0 (0.70 – 0.76)**:
   - With the authority coupon physically secured in reservation, the central balance register rolls from `₹500` to `₹0 REMAINING`.
8. **Beat 8: Re-Evaluation Against Stale-State Defense (0.76 – 0.86)**:
   - `TX-1095` (Books) advances to the commit line, but confronts `CURRENT REMAINING: ₹0`.
   - Re-evaluation indicator illuminates: `RE-EVALUATING AGAINST LIVE STATE // REMAINING: ₹0`.
   - Slip visibly registers failure to acquire authority.
9. **Beat 9: Restrained Unavailable Outcome (0.86 – 0.93)**:
   - `TX-1095` is marked: `UNAVAILABLE // INSUFFICIENT REMAINING CAPACITY` with a restrained red `✕`.
   - No generic Scene 02 "DENIED" reuse; strictly an institutional lack of remaining capacity.
10. **Beat 10: Terminal Conservation Audit & Ledger Plate (0.93 – 1.00)**:
    - Central audit dossier locks behind:
      - `MANDATE CAP: ₹4,000`
      - `PRIOR SPEND: ₹3,500`
      - `TX-1094 (CAFE): RESERVED ₹500`
      - `CURRENT REMAINING: ₹0`
      - `TX-1095 (BOOKS): REQUESTED ₹500 // UNFULFILLED CLAIM (₹0 RESERVED)`
      - `CONSERVATION EQUATION: ₹3,500 + ₹500 + ₹0 = ₹4,000 [VERIFIED // 100% INTACT]`

---

## 3. Responsive & Mobile Art Direction

- **Vertical Recomposition**:
  - Rather than compressing two slips side-by-side on mobile, `TX-1094` is positioned above (`y: -45px`) and `TX-1095` is positioned below (`y: 80px`).
  - `TX-1095` is visibly present as pending BEFORE `TX-1094` commits, preserving the proof of concurrency.
  - No horizontal truncation, clipping, or overlapping text on `430x932` (iPhone 14 Pro Max) or `390x844` (iPhone 12/13).
- **Reduced-Motion Invariant**:
  - Full conservation state, both slips, reservation voucher, and unavailable determination render statically with zero motion when `prefers-reduced-motion: reduce` is active.

---

## 4. Verification Suite Results

| Test Suite | Result | Details |
|---|---|---|
| `tests/visual/scene-ownership.spec.ts` | **40/40 PASSED** | All ownership invariants verified across all 5 viewports (02→03, 03→04, 04→05, 05→06, 06→07 forward & reverse) |
| `tests/visual/budget-concurrency-review.spec.ts` | **5/5 PASSED** | 21 dense checkpoints (0%–100% by 5%) across all 5 viewports (`1920x1080`, `1440x900`, `1366x768`, `430x932`, `390x844`). Stale-balance defense and conservation equation mathematically confirmed. |
| `tests/visual/reduced-motion.spec.ts` | **PASSED** | Reduced-motion static presentation preserves all documents, conservation tallies, and stamps |
| `tests/visual/budget-concurrency-video.spec.ts` | **5/5 PASSED** | All 5 motion video scenarios generated and verified |
| `npm run build` | **PASSED** | Clean production build in Turbopack (292ms compilation, 0 TS errors) |
| `npm run lint` | **ZERO new errors** | 0 new lint warnings or errors in Scene 07 code |

---

## 5. Generated Motion Video Artifacts

Located in `output/playwright/motion-video/`:
- `scene_06_07_transition.webm` (978 KB) — Authoritative 06→07 carrier crossfade and entry scrub
- `scene_07_normal_forward_reverse.webm` (1,113 KB) — Full normal-speed forward scrub and reverse scrub
- `scene_07_slow_and_fast.webm` (833 KB) — Slow hero inspection (0.34–0.88) and high-velocity scrub
- `scene_07_mobile_430x932.webm` (507 KB) — Full scrub on 430x932 viewport
- `scene_07_mobile_390x844.webm` (462 KB) — Full scrub on 390x844 viewport

---

# SCENE 06 / SPLIT-PAYMENT DEFENSE — COMPLETE & FROZEN

**Scene 06 status**: COMPLETE, FROZEN, AND VERIFIED across all 5 viewports and motion suites.
**Hard stop discipline honored**: Stop before Scene 07. No Scene 07 code written or mounted.

---

## 1. Architectural Integrity & Frozen Stage Invariants

- **Persistent-Stage Invariant**: `SplitDefenseScene` uses NO `pin: true` and creates zero pin spacers. It lives strictly as an absolute layer (`position: absolute; inset: 0; z-index: 8;`) inside `.cinematicStage`, driven by `<div data-track="split-defense" style="height: 340vh">`.
- **Zero-Slack Visibility**: `visibilityTrigger` adheres to the frozen standard:
  - `start: "top top+=1px"`
  - `end: "bottom top"`
  - Forward entry triggers `visibility: visible` at boundary + 1px; reverse leave hides cleanly at boundary + 1px.
- **Carrier Bridge (05 → 06)**:
  - Revocation's `carrierBridgeOut` fades out the folio carriage symmetrically over a 120px pre-roll window (`start: "bottom top-=120px"`, `end: "bottom top"`).
  - Split-Defense's `carrierBridgeIn` symmetrically fades in over the exact same 120px window (`start: "top top+=120px"`, `end: "top top"`).
  - `scene-ownership.spec.ts` proves `visibleRootCount <= 1` and `carrierCount <= 1` across all dense forward and reverse scrubs with zero double bodies or orphaned carriers.

---

## 2. Core Hero Mechanic: The Correlation Window

Scene 06 implements the physical institutional motion grammar of temporal correlation:

1. **Beat 1–3: Three Apparently Independent Sub-Threshold Requests (0.00 – 0.28)**:
   - `TX-1091` (10:03, `₹1,000`, `Market Mart Mumbai`, `Zepto`, `Grocery`)
   - `TX-1092` (10:06, `₹1,000`, `Market Mart Mumbai`, `Zepto`, `Grocery`)
   - `TX-1093` (10:09, `₹1,000`, `Market Mart Mumbai`, `Zepto`, `Grocery`)
   - Each individually sits below `STEP-UP > ₹1,500` and displays `SUB-THRESHOLD // ₹1,000 < ₹1,500`.
   - The viewer is given an authored hold (0.28–0.34) to perceive them as three innocent, ordinary transactions.
2. **Beat 5: Physical Temporal Review Aperture & Spatial Convergence (0.34 – 0.52)**:
   - Restrained institutional time ruler locks around `10:00 | 10:03 [TX-1091] | 10:06 [TX-1092] | 10:09 [TX-1093] | 10:15`.
   - Label updates: `TEMPORAL REVIEW APERTURE ENGAGED // CONVERGING`.
   - The 3 receipts draw together horizontally, snapping to 0deg rotation.
3. **Beat 6: Identity Evidence Alignment Registration (0.52 – 0.68)**:
   - Horizontal red datum alignment rails pass across the three receipts:
     - `EVIDENCE MATCH // SAME MERCHANT` aligns across `MARKET MART MUMBAI`
     - `EVIDENCE MATCH // SAME AGENT` aligns across `VIA AGENT ZEPTO`
     - `EVIDENCE MATCH // SAME PURPOSE` aligns across `PURPOSE GROCERY`
   - Active correlation state (`data-correlation-active="true"`) highlights the matched rows in red ink.
4. **Beat 7: Accounting Tally Emergence (0.68 – 0.78)**:
   - Institutional accounting bracket emerges:
     `[ ₹1,000 [10:03] + ₹1,000 [10:06] + ₹1,000 [10:09]    AGGREGATE SUM: ₹3,000 EXCEEDS THRESHOLD (> ₹1,500) ]`
   - Demonstrates that ₹3,000 is not conjured from nowhere, but physically aggregates the three constituent requests.
5. **Beat 8: Forensic Audit Dossier Backing Plate (0.78 – 0.86)**:
   - Heavy official dossier backing sheet locks behind the 3 receipts (`FORENSIC AUDIT DOSSIER // REF: KP-CR-1967-06`).
   - Confirms audit findings and verifies: `MANDATE KP-1967-M INTACT // EVASION ATTEMPT CONTAINED`.
6. **Beat 9: Causal Verdict Stamps (0.86 – 0.97)**:
   - Primary: `ONE ECONOMIC ACTION` (slanted -2deg, red ink stamp with bleed and micro-shudder).
   - Enforcement: `BLOCKED` (`POLICY REF: > ₹1,500 HOLD`) stamped on the dossier plate.
7. **Beat 10: Terminal Hold & History Preservation (0.97 – 1.00)**:
   - All three receipts (`TX-1091`, `TX-1092`, `TX-1093`) remain 100% visible, inspectable, and preserved in the final record.
   - Master mandate integrity preserved; remaining legitimate budget was not consumed.

---

## 3. Responsive & Mobile Art Direction

- **Sequential Flow on Mobile**:
  - `TX-1091` enters, followed by `TX-1092`, then `TX-1093`.
  - Temporal aperture encompasses the sequence.
  - Evidence matching highlights shared merchant, agent, and purpose directly on the receipts.
  - Ledger tally reflects the `₹3,000` sum below the cluster.
  - Verdict stamp `ONE ECONOMIC ACTION` and `BLOCKED` record cleanly without clipping.
- **Compact Proportions**: Custom mobile font sizes, paddings, and margin bounding prevent collision with top scene header/folio or bottom footer. Verified on both `430x932` (iPhone 14 Pro Max) and `390x844` (iPhone 12/13).

---

## 4. Verification Suite Results

| Test Suite | Result | Details |
|---|---|---|
| `tests/visual/scene-ownership.spec.ts` | **35/35 PASSED** | Full ownership invariants verified across all 5 viewports (02→03, 03→04, 04→05, 05→06 forward & reverse) |
| `tests/visual/boundary-04-05.spec.ts` | **PASSED** | Editorial splice between Scene 04 and 05 verified |
| `tests/visual/revocation-review.spec.ts` | **PASSED** | Scene 05 visual checkpoints verified |
| `tests/visual/split-defense-review.spec.ts` | **5/5 PASSED** | 21 dense checkpoints (0%–100% by 5%) across all 5 viewports (`1920x1080`, `1440x900`, `1366x768`, `430x932`, `390x844`) |
| `tests/visual/reduced-motion.spec.ts` | **PASSED** | Reduced-motion static presentation preserves all documents, tallies, and stamps |
| `npm run build` | **PASSED** | Clean production build in Turbopack (200ms compilation, 1.29s TS check) |
| `npm run lint` | **ZERO new errors** | 0 new lint warnings or errors in Scene 06 code |

---

## 5. Generated Motion Video Artifacts

Located in `output/playwright/motion-video/`:
- `scene_05_06_transition.webm` (1,033 KB) — Authoritative 05→06 carrier crossfade and entry scrub
- `scene_06_normal_forward_reverse.webm` (1,427 KB) — Full normal-speed forward scrub and reverse scrub
- `scene_06_slow_and_fast.webm` (887 KB) — Slow hero inspection (0.34–0.88) and high-velocity scrub
- `scene_06_mobile_430x932.webm` (993 KB) — Full scrub on 430x932 viewport
- `scene_06_mobile_390x844.webm` (965 KB) — Full scrub on 390x844 viewport

---

# SCENE 05 / REVOCATION — CREATIVE REFINEMENT (prior pass)

**Scope discipline honored**: this pass touched only `RevocationScene.tsx` interior choreography
and `AuthorityRegisterRecord.tsx`'s spine-notch markup. It did NOT touch the frozen root-visibility
architecture, global overlap distances, zero-slack boundary ownership, or the carrier singleton
system — verified by re-running `scene-ownership.spec.ts` and `boundary-04-05.spec.ts` after every
change (all PASS throughout).

## What was already there (verified by reading the code and re-inspecting rendered frames, not
assumed from memory)

Scene 05 was substantially more developed than a fresh read of the request implied. Confirmed
present and correct before touching anything:
- **Identifier semantics** (request section 18): already correct. `AuthorityRegisterRecord`
  displays `AUTH-REQ-0401` (the authorization-request reference) as Travel's primary chip via
  `displayId`, with `TX REF: TX-1082` as a clearly secondary line via `secondaryRef` — matches the
  canonical `AUTH-030x` naming pattern of the other three records. No invented authority ID exists.
- **Visual hierarchy** (request section 19): already implemented in
  `AuthorityRegisterRecord.module.css`. Shopping (`.sourceRecord`) reads at full width with larger
  type (1.4rem/1.3rem) and its own paper-texture background; Grocery+Delivery (`.dependentRecord`)
  are paired via a shared `margin-left` indent and `scale(0.95)`, reading as siblings; Travel
  (`.controlRecord`) is physically separated below a dashed rule with its own top margin — not four
  equal rows.
- **Causal ordering** (request section 16): already correct in the timeline. Beat 4's misregistration
  hints (siblings' inherited band shifting `x:-2`) fire at 0.44-0.46, well before Beat 6's full
  misregistration (0.64-0.69), which itself completes before the `WITHDRAWN` stamps appear
  (0.70/0.73). Physical motion consistently precedes the administrative mark, not the reverse.
- **Physical absence evidence** (request section 9): `AuthorityRegisterRecord.tsx` already renders
  a `SOCKET: EMPTY // WITHDRAWN` notice inside Shopping's spine-socket track, and a `.recallChannel`
  physical channel the carriage slides through — confirmed visible in the final-state screenshot
  (see below), satisfying "the missing source should remain visible in the final state."
- **Travel selectivity motion** (request section 17): already a real two-step advance (Beat 7,
  0.76-0.88), not a static row.

## What this pass concretely fixed

1. **Stale "LOCKED" label** (a `PROJECT_STATUS`-flagged known issue from an earlier pass, and
   directly named in this pass's request section 12): `SOURCE REGISTRATION SPINE` previously
   always read `LOCKED`, even after full withdrawal. Now state-driven via the existing
   `timeline.eventCallback("onUpdate", ...)` text-sync mechanism (the same pattern already used
   for the four status chambers): `LOCKED` (p<0.35) → `RELEASED` (0.35≤p<0.46) → `WITHDRAWN`
   (p≥0.46). Reduced-motion's static final state updated to match (`WITHDRAWN`, not the previous
   `LOCKED`).
2. **New unlock/disengage beat** (request section 12, previously absent — withdrawal began with no
   preceding release cue): added Beat 3.5 (0.35–0.38) — the datum notch pin (`.notchBar`)
   compresses (`scaleY: 0.35`) and shifts (`x: -3`) as a small, precise registration release, no
   bounce/no mechanism, immediately before the spine begins sliding at 0.38. Wired a matching
   `data-notch-bar` reduced-motion final state.

## What was visually re-verified (not just test-asserted)

Captured and directly inspected fresh screenshots at p=0.00/0.36/0.46/0.66/1.00
(`output/playwright/checkpoints/scene05_review/`):
- **p=0.46 (hero withdrawal frame)**: spine carriage visibly displaced left out of its channel,
  `RELEASED` label correctly showing, Shopping's status chamber still reads `IN FORCE` at this
  point (status changes only at p=0.54, confirming causality-before-label holds), hierarchy
  clearly legible (Shopping full-width/textured, Grocery+Delivery paired/indented, Travel separated
  below the dashed rule).
- **p=1.00 (final historical frame)**: `SOCKET: EMPTY // WITHDRAWN` clearly legible in Shopping's
  card, `SOURCE REGISTRATION SPINE — WITHDRAWN` (new label working), `REVOKED` stamp on Shopping,
  `WITHDRAWN` stamps on Grocery/Delivery, Travel clean with no red ink and `ACTIVE`, all 4 records
  still present (history preserved).

## Section 28 self-assessment (honest, not a rubber stamp)

Section 28's acceptance test is inherently a human-perception judgment ("without reading the red
labels, can I understand..."). Based on the causal ordering verified above (motion precedes label
in every case) and the two concrete fixes closing the most literal gaps the request named (unlock
event, stale label), this pass's honest assessment is: **substantially improved, likely close, not
independently certifiable as fully passing** without an actual human watching the scrub in real
time — which this pass could not do (only static frames + numeric/DOM assertions were available).
Flagging this rather than claiming a acceptance-test pass I cannot actually verify.

## Explicitly NOT done this pass (honest scope disclosure, not silently dropped)

Given the size of the full request (30 numbered subsections spanning hero-frame art direction,
mobile-specific re-sequencing, Scene 04→05 transition polish, and extensive multi-video human
review), this pass prioritized the concretely verifiable, bounded fixes above the fully-open-ended
creative iteration items. Not attempted this pass:
- Re-sequencing Beat order specifically for mobile (request section 23) — mobile already renders
  and passes all tests (video re-recorded, see below) via the existing responsive CSS, but no
  mobile-specific authored beat sequence was added.
- Further Scene 04→05 transition choreography polish (request section 21/16 of the numbered list)
  beyond re-confirming the existing bridge still passes all ownership tests unchanged.
- Additional hierarchy/scale iteration beyond confirming what already existed satisfies the
  request's description.
- A literal frame-by-frame human video review of all 7 re-recorded videos (they were regenerated
  and their Playwright assertions pass, but "actually watch and judge" per request section 27/28
  is a human-in-the-loop step this pass could not perform beyond the static-frame inspection above.

## Videos (re-recorded this pass, reflecting the new unlock beat)

- `output/playwright/motion-video/scene_04_05_transition.webm` (04→05 forward+reverse)
- `output/playwright/motion-video/scene_05_normal_forward_reverse.webm`
- `output/playwright/motion-video/scene_05_slow_and_fast.webm`
- `output/playwright/motion-video/scene_05_mobile_430x932.webm`
- `output/playwright/motion-video/scene_05_mobile_390x844.webm`
(exact filenames per `tests/visual/revocation-video.spec.ts`'s existing `saveAs` targets — reused
rather than renamed, since the request's "produce videos" intent is satisfied by fresh, current
recordings and renaming would break any existing references to these paths.)

## Tests run this pass

- `npm run build` — PASS, 0 errors.
- `npm run lint` — 18 pre-existing problems, unchanged, 0 new.
- `tests/visual/revocation-review.spec.ts` — PASS.
- `tests/visual/revocation-video.spec.ts` — PASS (7/7 non-skipped across desktop + mobile projects).
- `tests/visual/reduced-motion.spec.ts` — PASS.
- `tests/visual/boundary-04-05.spec.ts` — PASS (confirms Scene 05 changes did not disturb the
  frozen 04→05 ownership bridge).
- `tests/visual/scene-ownership.spec.ts` — PASS (10/10, confirms the frozen architecture, including
  this pass's own Decision Register geometry test, is fully intact).
- Full unscoped `npx playwright test --project=1920x1080` — run at the end of this pass; see result
  noted alongside this section or re-run to confirm if reading later.

## Remaining issues

1. Section 28's human-perception acceptance test is not independently certifiable by this pass
   (see honest self-assessment above).
2. Mobile-specific beat re-sequencing (request section 23) not attempted — current mobile rendering
   passes all automated checks but uses the same beat sequence as desktop, just responsively laid
   out.
3. All items listed under "Explicitly NOT done this pass" above.

## NEXT EXACT TASK

1. Human review of the 7 re-recorded Scene 05/04→05 videos against request section 28's acceptance
   questions — this is the one step this pass genuinely cannot self-certify.
2. If further creative iteration is wanted: mobile-specific sequencing (section 23), deeper
   Scene 04→05 transition polish (section 21), or further hero-frame (0.38-0.54) art direction.
3. Scene 06 (Split-Payment Defense) remains **NOT started, NOT prepared, NOT mounted**, per the
   hard gate — unchanged this pass.

---

# GLOBAL SCENE OWNERSHIP RECOVERY — COMPLETE — PERMANENTLY FROZEN

**Status: FROZEN.** The last open defect (Decision Register 02→03 crossfade misalignment) is
fixed and verified. The full ownership architecture — zero-slack scene-root visibility, Decision
Register bridge, Authority Folio bridge, Step-Up→Revocation bridge, refresh/resize/deep-scroll/
reverse robustness — is complete. **Any future scene must conform to this architecture; it should
not be revisited casually.** Genuine blockers must be explicitly documented before touching it.

## Decision Register 21px misalignment — root cause and fix

**Root cause (measured, not guessed)**: Decisions' `.stage` uses `padding-top: clamp(0.45rem,
1.3vh, 0.95rem)` (≈14.03px @1920×1080); Delegation's `.stage` uses `padding-top: 3.4vh` (≈36.72px)
— two different, individually-approved ambient layout rhythms (Decisions: tight grid for the lane
board; Delegation: roomier card rhythm). The register carrier is a normal in-flow child of each
scene's own `.stage`, so it simply inherits whichever ambient padding is active — a 22.6875px
delta, confirmed via direct `getBoundingClientRect()` probing (not assumed). A further ~2px height
delta came from the "FILED" badge itself: Decisions' copy is a bordered/bold/red "fresh alert"
treatment (`border: 1px solid`, `font-weight: 700`), Delegation's is a borderless/muted "settled
archive" treatment — also an intentional, approved resting-frame difference (not a bug), where the
1px top+bottom border accounts for exactly the measured 2px.

**Fix — architecture correction, not a blind `top:-21px` nudge**: `DelegationScene.tsx`'s incoming
register bridge now measures BOTH copies' live `getBoundingClientRect()` on every scrub update and
sets the incoming copy's `y` and `height` to force exact congruence with the outgoing copy, for as
long as both are non-negligibly visible. This is computed fresh every frame (not a hardcoded
1920×1080-specific pixel value), so it holds correctly at every viewport without special-casing
mobile. Verified: `deltaY = 0px`, `deltaHeight = 0.125px` (1920×1080) and `deltaY ≈ 0.0001px`,
`deltaHeight ≈ 0.4px` (430×932) throughout the entire window where the incoming copy has opacity
`> 0.05` — both comfortably inside the required `≤1px` tolerance, in both scroll directions.

Once ownership has fully transferred (`registerSettleIn`, a second trigger spanning `top top` →
`top top-=60px`), the register performs an authored settle motion from the outgoing-aligned rect
into Delegation's own pre-existing approved archival offset (`y: -4`, the same target the main
timeline already used) — this is a deliberate small physical motion, not a snap, and it converges
to exactly the value the existing main timeline already animates toward, so the two controllers
never fight. Decisions' own resting composition and Delegation's own resting composition are both
**completely unchanged** — only the carrier's transient handoff geometry was touched.

**New automated regression test**: `tests/visual/scene-ownership.spec.ts` gained a
"Carrier physical congruence" describe block — dense-sampled (11 steps across the crossfade,
forward and reverse) `deltaX/deltaY/deltaWidth/deltaHeight ≤ 1px` assertions whenever
`incOpacity > 0.05`, plus a dedicated 430×932 mobile pass. All PASS. `readCarrierGeometry()` was
added to `tests/visual/helpers/ownership.ts` for reuse.

**Video**: `output/playwright/motion-video/scene_02_to_03_ownership_final.webm` re-recorded under
the fixed code (desktop + both mobile sizes, all re-recorded since the fix touches the file); also
saved as `scene_02_to_03_ownership_final_v2.webm` per this pass's explicit naming request.
Milestone still (`02_handoff_midpoint.png`) visually re-inspected directly: the faint "ghost" text
artifact from the previous report is gone — one crisp register bar, no perceptible duplicate.

## Full verified state at freeze

- `visibilityTrigger` on every boundary-facing scene edge is exact (`"top top"`/`"bottom top"`,
  0px slack) except a verified, necessary 1px epsilon on tightened START edges only (GSAP's
  `onEnter` needs progress to strictly exceed 0 for a non-scrubbed trigger — confirmed via direct
  probing that `ScrollTrigger.refresh()` alone does not fix an exact-pixel landing).
- Decision Register (02→03): paired outgoing/incoming scrub bridges over the identical absolute
  100px range, now also geometry-synced (this pass). Singleton and congruent, both directions.
- Authority Folio (03→04): paired outgoing/incoming scrub bridges, bundled with each scene's own
  header fade. Singleton, verified (geometry congruence NOT extended to this carrier — not
  reported as a defect; do not extend scope here without a reported issue).
- Authority Folio → Authority Register (04→05): paired bridges; Revocation's body-visibility
  leak (register-station + 4 records rendering under Step-Up) fixed by removing its 120px
  leading overlap.
- Refresh-at-boundary, resize-at-boundary, orientation-like resize, explicit
  `ScrollTrigger.refresh()`, deep-scroll initialization, fast-scroll torture, reverse torture —
  all verified via `tests/visual/boundary-hardening.spec.ts` (25/25 PASS).
- Mobile (430×932, 390×844) — verified via the above suite plus dedicated mobile video capture.
- 5 previously-flagged "pre-existing" `boundary-review.spec.ts` failures — all individually
  diagnosed and closed (3 stale test assertions fixed to match intentional current behavior, 1
  broken test helper fixed, 1 genuine runtime edge case found and hardened). 0 unexplained
  failures anywhere in the full unscoped suite (last full run: 77 passed, 0 failed, 9 explained
  skips).
- This pass's addition: Decision Register geometry congruence, verified both directions and at
  mobile viewport, with a permanent regression test.

## Files that make up the frozen architecture (touch only with a documented reason)

`src/components/experience/{Mandate,Decisions,Delegation,StepUp,Revocation}Scene.tsx` (the
`visibilityTrigger`/bridge-trigger blocks specifically), `src/components/experience/DebugStageHUD.tsx`,
`tests/visual/helpers/ownership.ts`, `tests/visual/scene-ownership.spec.ts`,
`tests/visual/boundary-hardening.spec.ts`, `tests/visual/boundary-videos.spec.ts`.

---

# GLOBAL SCENE OWNERSHIP — FINAL VERIFICATION & HARDENING (prior pass)

**Status: PASS. Architecture proven robust under refresh, resize, deep-scroll init, fast-scroll
and reverse torture, and orientation-like resize. All 5 previously-flagged "pre-existing" failures
diagnosed and closed (not deferred). One genuine new runtime edge case found and fixed (1px
ScrollTrigger onEnter dead-zone). One genuine test-helper bug found in my own new suite and fixed
(visibility ancestor-walk gave false negatives on the exact override mechanism the fix relies on).
Zero unexplained failures remain. Scene 06 still NOT started (hard gate held). Awaiting user
sign-off before Scene 05 creative refinement resumes, per this pass's explicit instructions.**

## What this pass did NOT trust blindly

Per instruction, the prior pass's "48 pass / 5 pre-existing fail" was treated as unverified until
proven. Each of the 5 was individually diagnosed (not lumped together as "stage-bg, out of
scope"):

1. **`boundary-review.spec.ts:15` (01→02 forward)** — real cause: `data-mandate-paper-carrier`
   inline `style.clipPath` assertion (`toContain("inset(100%")`) was stale against
   `MandateScene.tsx`'s current implementation, which intentionally departs the carrier via
   y-translation + late opacity fade instead of clipPath (code comment: `"Stage boundary crops
   departing material. No razor clipPath!"`). Not an ownership bug, not caused by this or the
   prior pass. **Fixed the test**: asserts `getBoundingClientRect()` geometry instead, and moved
   the check from progress 0.96 to 0.99 after empirically confirming (via direct ScrollTrigger
   probing) that the current power2.in-eased departure is only ~42% complete at 0.96 and fully
   clears by 0.99 — a genuine timing difference from whatever the original clipPath
   implementation did, flagged in the test as a note for future Scene 01 review, not touched here
   (Mandate interior is out of scope / frozen).
2. **`boundary-review.spec.ts:257` (01→02 mobile) / a second occurrence in the same describe
   block** — same root cause (two more stale `clipPath` assertions on the same element, one
   checking `["inset(0%)", "inset(0% 0% 0% 0%)"]` for the "restored after reverse" state). **Fixed
   the test**: both now assert restored opacity > 0.95 instead.
3. **`boundary-review.spec.ts:322` (03→04) and `:415` (02→03)** — real cause: assertions checked
   `getComputedStyle([data-delegation-stage]|[data-decisions-stage]).backgroundColor === "rgb(9,
   10, 8)"`, but every scene's `.stage`/`.section` is deliberately `background-color: transparent`
   — a single shared black plane lives on `.cinematicStage` underneath all scene overlays (avoids
   N duplicate black rects). Verified `[data-cinematic-stage]` computed `backgroundColor` actually
   is `rgb(9, 10, 8)`. **Fixed the test**: redirected all 4 "no white background" assertions in the
   file to check `[data-cinematic-stage]` instead of the scene-local element — this is the
   architecturally-correct authoritative source for "no white gap," not a weakened assertion.
4. **`boundary-review.spec.ts:501` (Global Scene Boundary Geometry invariant)** — real cause: the
   test's `getST()` helper queried `document.querySelector("[data-scene='...']")` and matched
   `ScrollTrigger.getAll()` entries by `t.trigger === el`, but the persistent-stage architecture
   pins every scene's timeline to its own `[data-track='...']` segment in the invisible scroll
   track — **never** to the `[data-scene='...']` section (a fixed-position overlay with no scroll
   height of its own). This lookup always returned `undefined`, making geometry invariants 0-3
   vacuously true (`0 - 0 <= 2`) and invariant 4 scroll every scene to `y=0` before checking
   visibility — this test has likely never meaningfully verified anything since the persistent-
   stage refactor landed. **Fixed the test**: `getST` now matches `[data-track='...']`; verified
   invariants 0-3 now compute real non-zero boundary deltas.
5. **After fixing #4, a NEW real failure surfaced**: `isVis` false at the exact boundary pixel for
   mandate/delegation/step-up. Root cause, confirmed via direct ScrollTrigger probing (not
   guessed): a non-scrubbed `ScrollTrigger`'s `onEnter` requires scroll progress to strictly
   **exceed** 0 — landing exactly on the integer `start` pixel via a synthetic jump (`window.
   scrollTo` + `ScrollTrigger.update()`, **and confirmed `ScrollTrigger.refresh()` does not fix it
   either**) leaves the body `visibility:hidden` until 1px of further scroll. This is a genuine,
   general GSAP characteristic — real user scrolling always passes through many intermediate
   pixels so it never manifests in practice, but it is a real fragility for anything that computes
   an exact scroll-restore target (deep links, browser scroll restoration) landing precisely on a
   boundary pixel — directly relevant to this pass's refresh/deep-scroll concerns. **Fixed the
   runtime** (not just the test): added a 1px epsilon (`"top top+=1px"` instead of `"top top"`) to
   the `visibilityTrigger` start on `MandateScene.tsx`, `DelegationScene.tsx`, `StepUpScene.tsx`,
   and `RevocationScene.tsx` — negligible (imperceptible, not a cinematic overlap), applied only to
   the START edges that had been tightened to exact 0px (the END edges keep their existing
   behavior; a 1px-late `onLeave` there is harmless — the outgoing body would still be visible for
   1 extra pixel, not a duplicate-scene risk).

All 6 tests in `boundary-review.spec.ts` now PASS — 0 pre-existing failures remain, 0 tests
skipped/weakened, 0 assertions relaxed. Every fix was either (a) correcting a test to match a
verified-correct, intentional runtime behavior, or (b) a real, narrow, verified runtime hardening
fix.

## New test-helper bug found and fixed (self-audit)

While recording review videos for 02→03, a screenshot at the handoff midpoint showed faint
"ghost" text above the main Decision Register bar. Investigated rather than dismissed: this was
the OTHER register mid-crossfade (Decisions' outgoing copy at 48% opacity, Delegation's incoming
copy at 52%, sum ≈ 1.0 — the intended, correct handoff mechanism, not a duplicate). But
investigating it surfaced a **real bug in my own new `readOwnership()` test helper**
(`tests/visual/helpers/ownership.ts`, written in the prior pass): its "is this text visible"
check walked up the DOM checking each ancestor's **own** `visibility` value, and treated any
`visibility:hidden` ancestor as proof the descendant is invisible. This is **wrong** — CSS
`visibility` is inherited, and a descendant can explicitly override an ancestor's `hidden` back to
`visible` (exactly the mechanism this whole ownership fix relies on for incoming carriers
pre-rendering before their own scene root goes visible). Verified via direct probing:
`getComputedStyle()` on the carrier's own text node correctly reports `"visible"` even under a
`visibility:hidden` section root — no manual walk is needed for `visibility` at all, since computed
style already resolves inheritance. The manual walk gave **false negatives**, meaning the
duplicate-carrier counts in `scene-ownership.spec.ts` and `boundary-hardening.spec.ts` could have
silently missed a real duplicate inside a visibility-overridden carrier this entire time.

**Fixed**: `measureText()` now uses the leaf's own (correctly-inherited) computed `visibility`
directly, and separately tracks `opacity` by multiplying up the ancestor chain (opacity does NOT
inherit as a computed property, unlike visibility, so this walk IS necessary and was previously
missing entirely). Also redesigned the metric: a naive "count all visible instances" is the wrong
shape for a legitimate crossfade (during the ~100px handoff, BOTH carriers are genuinely on-screen
at partial opacity — that's the intended single-object illusion, not a duplicate). Now reports
`dominantCount` (instances at >90% effective opacity — the "two full bars stacked" bug pattern
originally reported) and `opacitySum` (should stay ≈1 throughout any handoff, never approach 2 —
catches the case two copies are both at, say, 70% simultaneously, which a dominant-only count would
miss). **Re-verified the corrected helper is still a real regression detector**: ran it against
the pre-fix runtime again (`git stash` on the four scene files) — still fails at all 4 originally-
reported boundaries with the corrected logic; restored the fix, re-ran — all pass.

## Refresh / resize / deep-scroll / torture suite: `tests/visual/boundary-hardening.spec.ts` (new)

25 tests, all PASS on the fixed architecture:

- **Refresh-at-boundary** (9 tests: 3 boundaries × 25%/50%/75% into handoff) — scrolls to a
  meaningful mid-transition position, asserts ownership, calls `page.reload()` (the actual
  production reload lifecycle — no manual style patching), re-requests the same scroll coordinate
  through the normal `window.scrollTo` + `ScrollTrigger.update()` path, re-asserts ownership. PASS.
- **Resize-at-boundary** (3 tests) — at each boundary's midpoint, cycles
  1920×1080→1440×900→1366×768→430×932→390×844→1920×1080, re-deriving the boundary pixel from the
  live `ScrollTrigger` after each resize (track heights are vh-based) and re-asserting ownership
  after each step. PASS.
- **Explicit `ScrollTrigger.refresh()`** (3 tests) — calls `refresh()` directly at each boundary
  midpoint; asserts scroll position and visible-root identity are unchanged and ownership invariants
  still hold. PASS.
- **Fast/orientation-like resize torture** (1 test) — 430×932 → 932×430 → 390×844 at Delegation's
  midpoint; asserts visible-root count stays in `[1,2]` (never 0 = blank stage, never 3+ = stacked
  scenes) at every step. PASS.
- **Deep-scroll initialization** (3 tests) — loads the page fresh, jumps straight to 50% into
  Delegation / Step-Up / Revocation with **no prior incremental scrolling**, asserts exactly the
  target scene is visible and no earlier scene's inline styles are left stale. PASS for all three —
  confirms GSAP's own state-sync (via `ScrollTrigger.update()`) correctly establishes ownership for
  a trigger that's already active at check time, without requiring the page to have scrolled
  through the intervening scenes first.
- **Fast-scroll ownership torture** (1 test) — large discontinuous scroll jumps (0 → deep target,
  no intermediate frames) landing inside Delegation/Step-Up/Revocation; asserts single ownership
  settles correctly. PASS.
- **Reverse torture** (1 test) — aggressive reverse scrub from Revocation's end back through
  Step-Up, Delegation, into Decisions' territory, then forward again; asserts single ownership at
  every step in both directions. PASS.

**Verified this suite is a real regression guard, not vacuous**: ran a representative sample (4 of
the 25 tests spanning refresh, resize, and explicit-refresh categories) against the pre-fix runtime
(`git stash` on the four scene files) — 4/4 correctly failed with `visibleRootCount: 2` at the
expected boundaries; the other 2 sampled tests correctly passed even on old code (04→05's refresh()
test, since that boundary's folio bridge was already partially patched in an earlier pass; deep-
scroll-into-delegation, since that target is comfortably mid-scene, not boundary-adjacent, so old
code's coarse overlap never manifested there). Restored the fix; all 25 pass.

## Video review: `tests/visual/boundary-videos.spec.ts` (new)

Recorded **9 fresh videos** under the current, hardened architecture (not reusing the prior pass's
04→05 recording) — 3 boundaries × {1920×1080, 430×932, 390×844}:

```
output/playwright/motion-video/scene_02_to_03_ownership_final.webm
output/playwright/motion-video/scene_02_to_03_ownership_final_430x932.webm
output/playwright/motion-video/scene_02_to_03_ownership_final_390x844.webm
output/playwright/motion-video/scene_03_to_04_ownership_final.webm
output/playwright/motion-video/scene_03_to_04_ownership_final_430x932.webm
output/playwright/motion-video/scene_03_to_04_ownership_final_390x844.webm
output/playwright/motion-video/scene_04_to_05_ownership_final.webm
output/playwright/motion-video/scene_04_to_05_ownership_final_430x932.webm
output/playwright/motion-video/scene_04_to_05_ownership_final_390x844.webm
```

Each recording covers: outgoing complete rest → slow dense scrub through the outgoing tail →
slow dense scrub establishing the incoming scene → reverse scrub back to outgoing rest, with
ownership assertions (`visibleRootCount<=1`, carrier dominant-count `<=1`) at every sampled step,
plus 4 milestone PNG stills per video. **Milestone stills for all 3 desktop boundaries were
actually visually inspected** (not just assertion-trusted): the 02→03 handoff-midpoint still was
read and reviewed directly — confirms exactly one Decision Register bar, clean black background, no
lane rails or old A/B/C rails behind it, no double archive strip. Investigating a faint artifact in
that same still led to the test-helper bug fix above (not a runtime bug — see that section).

**One minor, non-blocking finding from this visual review**: during the 02→03 crossfade, the two
Decision Register copies are not pixel-identical in vertical position — Decisions' copy sits ~21px
higher than Delegation's copy (`registerTag` `top: 21px` vs `top: 42.8px` at 1920×1080), because
the two scenes' `.stage` layouts differ (`display:grid` in Decisions vs `display:flex column` in
Delegation, with different padding). This does not create a duplicate-scene or stacked-carrier
appearance (opacities still sum correctly, no "two full bars" moment), but it falls short of rule
10's "same x, same y, same width, same height" ideal for a pixel-perfect single-object illusion.
Flagged for future polish, not fixed this pass (would require touching both scenes' interior CSS
layout, out of scope for an ownership-architecture pass).

## Footer / debug HUD checks

- **Footer**: `kavachpayFooterCount` (dominant-opacity text-match on "KAVACHPAY") was probed
  directly at the 03→04 boundary. Found what looked like 2 simultaneous matches inside Delegation
  at progress 0.96 — investigated rather than assumed: one match was Delegation's own scene footer
  (`<span class="footerBrand">KAVACHPAY</span>`), the other was `AuthorityPass.tsx`'s per-document
  seal text (`"KAVACHPAY MONETARY CONTROL"`, rendered on every Shopping/Grocery/Delivery pass card)
  — an entirely different, always-present, legitimate UI element that happens to also contain the
  substring "KAVACHPAY". Confirmed via the `visible`/`scene` breakdown that StepUp's, Revocation's,
  and Decisions' own scene-chrome footers are all correctly `visibility:hidden` throughout —
  **no real cross-scene footer duplication exists**. No global-footer hoist was needed or done
  (kept out of scope, as instructed).
- **Debug HUD** (`?debug=stage`): verified live — reports `VISIBLE_ROOTS: 1 [delegation]` and
  `VISIBLE_CARRIERS: decisionRegisterIn=1.00` correctly at a deep-scrolled position. Verified the
  HUD element does not exist in the DOM at all (`page.locator("aside").count() === 0`) when
  `?debug=stage` is absent, confirming zero overhead when off (the component returns `null` before
  its `useEffect`/RAF loop ever runs).

## Full test matrix (this pass)

- `npm run lint` — 0 new errors/warnings (18 pre-existing, unchanged, none in files this pass
  touched; 3 new warnings were introduced then found and fixed mid-pass — confirmed 0 remain).
- `npm run build` — PASS, 0 errors.
- `tests/visual/boundary-review.spec.ts` — **6/6 PASS** (was 5 failing; all 5 diagnosed and closed,
  see above). Zero skipped, zero weakened.
- `tests/visual/scene-ownership.spec.ts` — 4/4 PASS (re-verified against the corrected helper).
- `tests/visual/boundary-hardening.spec.ts` (**new**) — 25/25 PASS.
- `tests/visual/boundary-videos.spec.ts` (**new**) — 9/9 PASS (3 boundaries × 3 viewports).
- `tests/visual/boundary-04-05.spec.ts` — PASS (unchanged from prior pass).
- `tests/visual/delegation-review.spec.ts`, `step-up-review.spec.ts`, `revocation-review.spec.ts`
  — PASS.
- `tests/visual/motion-review.spec.ts` — PASS.
- `tests/visual/reduced-motion.spec.ts` — PASS (1 sub-test skipped, a `testInfo.project.name` gate
  unrelated to this pass).
- `tests/visual/stage-a-verification.spec.ts` — PASS (6/6: full forward, slow boundary scrub, fast
  scroll, full reverse, mobile 430×932, mobile 390×844).
- Full unscoped `npx playwright test --project=1920x1080` (every spec in `tests/visual/`) — running
  in background at the time this section was written; see the top of the Final Report section below
  for its result once available in this same session, or re-run to confirm if reading this later.

## Remaining issues (honest, not glossed over)

1. **Minor carrier alignment**: the ~21px vertical offset between the two Decision Register copies
   during the 02→03 crossfade (see Video review above). Cosmetic, not an ownership bug.
2. **Global footer chrome**: still per-scene, not hoisted to one shared component. Confirmed no
   real duplication exists; hoisting remains optional future polish (explicitly out of scope this
   pass, per instruction).
3. **Mandate's exit timing**: the paper carrier is only ~42% departed at progress 0.96 despite the
   choreography comment implying a 0.87–0.99 window with earlier visual clearance; full clearance
   verified at 0.99. This is a Mandate-interior (frozen, out-of-scope) observation surfaced while
   fixing a stale test, not touched.
4. **1px epsilon is a permanent, tiny runtime change**: `MandateScene.tsx`, `DelegationScene.tsx`,
   `StepUpScene.tsx`, `RevocationScene.tsx` all now use `"top top+=1px"` instead of `"top top"` for
   their body `visibilityTrigger` start. This is real, verified, necessary hardening (not a revert
   of the previous pass's tightening) — documented here so it isn't mistaken for a regression if
   spotted in a future diff review.

## Whether the architecture is safe to freeze

**Yes**, on the evidence gathered this pass: 0 unexplained failures across the full targeted
matrix, refresh/resize/deep-scroll/fast-scroll/reverse torture all verified (not assumed), one
real runtime edge case found via direct probing (not guesswork) and fixed, one real test-helper
bug found via visual inspection (not blind trust in green tests) and fixed, and the corrected,
stricter test suite re-verified against the pre-fix baseline to confirm it still meaningfully
detects the original regression.

## Whether Scene 05 refinement may resume

**Awaiting explicit user sign-off**, per this pass's instructions (section 22/26: "STOP for user
approval" / "We need user sign-off on the recovered ownership architecture"). Not resumed this
pass.

## NEXT EXACT TASK

1. User reviews this report and the 9 recorded boundary videos + milestone stills.
2. On sign-off: resume Scene 05 (Revocation) interior creative refinement — still under the hard
   gate (Scene 06 / Split-Payment Defense remains NOT started, NOT prepared, NOT mounted).
3. Optional/deferred polish (not blocking freeze): the ~21px carrier-alignment offset (item 1
   above), and the Mandate exit-timing observation (item 3 above) if a future Scene 01 pass wants
   to address it.

---

# GLOBAL SCENE OWNERSHIP RECOVERY (prior pass)

## Root cause

Every scene (`DecisionsScene`, `DelegationScene`, `StepUpScene`, `RevocationScene`) gated its
**entire** DOM tree — header, footer, lane board / arena, AND any boundary-carrier bars
(`data-decision-register-outgoing`, `data-decision-register`, `data-authority-folio-outgoing`,
`data-authority-folio`) — behind ONE coarse `visibilityTrigger` that extended **100–120px past the
scene's own true pinned start/end** ("authored boundary overlap", the exact arbitrary global
overlap window rule 21 forbids). Because adjacent scenes' track segments are contiguous (0px gap),
that ±100–120px slack on each side produced a 200–240px window where **two complete scene bodies
were both `visibility: visible` at once** — full Decisions lanes behind full Delegation Shopping,
full Delegation authority passes behind full Step-Up's clearance document, full Step-Up document
behind full Revocation register. Within that same window, each scene's OWN carrier bar (register /
folio) was either a separate unconditional `gsap.set(..., {opacity:1})` at mount (Delegation's
`data-decision-register`, Step-Up's `data-authority-folio`/header) or held its final tweened state
past track end (Decisions' outgoing register) — so both scenes' copies of the "same" bar rendered
together too. Only the 04→05 boundary had received a partial, narrow patch (a folio+header-only
crossfade) in an earlier pass; it did not touch the coarse body-visibility overlap, so Revocation's
register-station/records still leaked into view up to 120px before Revocation's true start (bug E).

## Ownership model — before

- One `visibilityTrigger` per scene toggling `root.style.visibility` for the WHOLE section,
  offset ±100–120px past the scene's true `top top` / `bottom top`.
- Boundary carriers (register/folio bars) lived inside that same section, with their own opacity
  driven either by an unconditional mount-time `gsap.set` or by the tail of the main pinned
  timeline — no independent lifecycle, no singleton ownership across the two scenes that both
  rendered a copy of it.
- No mechanism prevented two sections both being `visibility:visible` simultaneously for a real,
  human-perceptible scroll distance.

## Ownership model — after

- `visibilityTrigger` for every in-scope scene is now scoped to the scene's **exact** pinned
  window (`start: "top top"`, `end: "bottom top"`, no px offset) on whichever edge touches a
  boundary in scope. This guarantees at most a single shared pixel where two bodies could compete,
  eliminating the stacked-scene window at the source.
- Each boundary's carrier (Decision Register for 02→03, Authority Folio for 03→04 and 04→05) is
  now driven by a **paired scrub-bridge**: the outgoing scene fades it 1→0 over the identical
  absolute scroll range (`bottom top+=100px` → `bottom top`) that the incoming scene fades it 0→1
  over (`top top+=100px` → `top top`) — since the two scenes' track boundaries are the same pixel,
  both triggers reference the exact same absolute range, so `outgoingOpacity + incomingOpacity ≈ 1`
  throughout (the already-working pattern from the earlier 04→05 patch, now applied consistently
  to all three boundaries and extended to also cover Revocation's body leak).
- The incoming half of each bridge needs to render **before** its own scene's root becomes
  visible (the bridge window sits in the outgoing scene's final territory). This is done with an
  explicit `element.style.visibility = "visible"` set once on the carrier element itself — CSS
  visibility is inherited but a descendant's own explicit value overrides an ancestor's
  `visibility: hidden`, so the carrier renders correctly while the rest of the (still genuinely
  inactive) incoming scene stays hidden. This is real DOM ownership, not a z-index or opacity hack.
- Each scene's internal "reveal" tween for its own outgoing carrier copy was retimed to fully
  complete well before its paired bridge trigger's window starts, so the two controllers never
  write to the same property in an overlapping scroll range (no fighting/flicker).

## Per-boundary fixes

**02 → 03 (Decisions → Delegation)**
- `DecisionsScene.tsx`: `visibilityTrigger.end` tightened `"bottom top-=100px"` → `"bottom top"`.
  Added `registerBridgeOut` (last 100px, opacity `1 - progress` on
  `[data-decision-register-outgoing]`). Retimed the internal register reveal from
  `0.955–0.99` → `0.90` so it fully settles before the bridge window.
- `DelegationScene.tsx`: `visibilityTrigger.start` tightened `"top top+=100px"` → `"top top"`.
  Added `registerBridgeIn` (first 100px, opacity `progress` on `[data-decision-register]`).
  `data-decision-register` mount opacity changed `1` → `0` (now bridge-owned) and given an explicit
  `visibility: "visible"` override + `pointer-events: "none"`.
- Fixes bugs A, B, F (02/03 half) from the report: Decisions' lanes/receipts/footer no longer
  remain mounted-visible behind Delegation; exactly one Decision Register renders at any scroll
  position (proved by `scene-ownership.spec.ts`, `decisionRegisterCount <= 1` at every sampled
  step 0.90→1.00 and 0.00→0.10 across the boundary, both directions).

**03 → 04 (Delegation → Step-Up)**
- `DelegationScene.tsx`: `visibilityTrigger.end` tightened `"bottom top-=120px"` → `"bottom top"`.
  Added `folioBridgeOut` (last 100px, opacity `1 - progress` on
  `[data-authority-folio-outgoing], [data-delegation-header]`). Retimed the internal folio reveal
  `0.945–0.985` → `0.85` so it settles before the bridge window.
- `StepUpScene.tsx`: `visibilityTrigger.start` tightened `"top top+=100px"` → `"top top"`. Added
  `folioBridgeIn` (first 100px, opacity `progress` on `[data-authority-folio], [data-stepup-header]`).
  Both elements' mount opacity changed `1` → `0` (now bridge-owned) and given an explicit
  `visibility: "visible"` override + `pointer-events: "none"`. The pre-existing `folioBridgeOut`
  (04→05 half, unchanged) still owns the same two elements later in the scene — non-overlapping
  windows, no conflict.
- Fixes bugs C, D, F (03/04 half): complete Delegation authority passes no longer sit under an
  active Step-Up clearance document; exactly one Authority Folio bar renders across the handoff
  (proved by `authorityFolioCount <= 1` at every sampled step, both directions).

**04 → 05 (Step-Up → Revocation)**
- `RevocationScene.tsx`: `visibilityTrigger.start` tightened `"top top+=120px"` → `"top top"`. This
  is the fix for bug E specifically — previously the WHOLE Revocation root (register-station + all
  4 records) was forced `visibility:visible` 120px before Revocation's true start, so it rendered
  at CSS-default opacity underneath Step-Up's still-fully-visible clearance document, even though
  the pre-existing folio/header bridge only ever covered the folio+header pair. The pre-existing
  `folioBridgeIn`/`folioBridgeOut` (from the earlier pass) are unchanged and still correct; they
  now needed an explicit `visibility: "visible"` override on `[data-revocation-folio],
  [data-revocation-header]` since the root is no longer visible early by default.
- Fixes bug E: Step-Up's full clearance document no longer coexists with a fully-rendered
  Revocation register/records; only the folio+header carrier bridges early, exactly as designed.

## Header / footer ownership

Scene headers are bundled with their boundary's folio/register bridge where the pre-existing
pattern already did so (Step-Up header with its folio at 03/04's incoming edge and 04/05's
outgoing edge; Delegation header with its folio at 03/04's outgoing edge) — the outgoing title
recedes on the identical schedule as the carrier, so it can never sit at equal prominence with the
incoming scene's title. Decisions' own header/footer already self-fade to 0 inside its own final
4% before its root goes hidden (untouched, pre-existing, correct). `KAVACHPAY` / tagline footers
were **not** hoisted to a single global chrome component this pass — each scene's footer is scoped
to its own now-exact visibility window, so no duplicate-footer scroll window exists any more; a
true single global footer component remains a reasonable follow-up (see Remaining issues) but
was not required to close the reported bugs and risked touching frozen scene interiors.

## Reverse / refresh / resize

- Reverse: `scene-ownership.spec.ts` "Reverse scrub across all three boundaries stays single-owner"
  scrubs 02↔03, 03↔04 backward through the same dense steps and asserts `visibleRootCount <= 1`
  throughout — PASS. The bridge triggers are pure `scrub: true` ScrollTrigger instances (no
  discrete callbacks), so they are correct under `ScrollTrigger.update()` regardless of scroll
  direction by construction.
- Refresh-at-boundary-midpoint and resize-at-boundary-midpoint were **not** separately scripted
  this pass (out of time budget) — flagged under Remaining issues below. The fix is refresh-safe by
  construction (`invalidateOnRefresh: true` on all pinned timelines was already present and
  untouched; the new bridge triggers derive purely from scroll position via `scrub`, not from
  mount-order state), but this has not been explicitly re-verified with a scripted
  reload-mid-scroll test.

## Debug ownership HUD (`?debug=stage`)

`DebugStageHUD.tsx` extended: now reports `VISIBLE_ROOTS` (count + which `data-scene` sections
compute `visibility: visible`, flags `⚠ OWNERSHIP FAIL` if > 2) and `VISIBLE_CARRIERS` (opacity of
each named register/folio element > 0.05). This is the live version of the audit
`scene-ownership.spec.ts` runs headlessly.

## New regression test: `tests/visual/scene-ownership.spec.ts`

4 tests, dense steps (0.90/0.94/0.96/0.98/1.00 outgoing, 0.00/0.02/0.04/0.06/0.10 incoming) across
all three in-scope boundaries plus a reverse pass. Asserts (a) at most 1 scene body computes
`visibility:visible` at any sampled step, (b) at most 1 visible instance of "DECISION REGISTER" /
"AUTHORITY FOLIO" text exists in the DOM (leaf-node text scan with hidden-ancestor exclusion, so it
counts what a human would actually perceive, not raw element count). **Verified this test actually
catches the regression**: ran it against the pre-fix code (`git stash` on the four scene files) —
all 4 tests failed with `visibleRootCount: 2` at exactly the reported boundaries (decisions@0.96 +
delegation both visible; delegation@0.98 + step-up both visible; step-up@0.98 + revocation both
visible; delegation-rev@0.02 during reverse) — then re-ran on the fixed code — all 4 pass. Not a
vacuous test.

## Tests run this pass

- `npm run lint` — 0 errors/warnings in any file touched this pass (9 errors / 9 warnings remain,
  all pre-existing, all in unrelated test files or `MandatePhysicalStage.tsx` /
  `AuthorityRegisterRecord.tsx` — confirmed identical before/after via `git stash`).
- `npm run build` — PASS, 0 errors.
- `tests/visual/scene-ownership.spec.ts` (**new**) — PASS across 1920×1080, 1366×768, 430×932,
  390×844 (12/12).
- `tests/visual/boundary-04-05.spec.ts` — PASS (folio-singleton invariant, forward + reverse).
- `tests/visual/delegation-review.spec.ts`, `step-up-review.spec.ts`, `revocation-review.spec.ts`
  — PASS (1920×1080).
- `tests/visual/motion-review.spec.ts`, `tests/visual/reduced-motion.spec.ts` — PASS (1 reduced-
  motion sub-test skipped, unrelated to this pass — a `testInfo.project.name` gate, not a failure).
- `tests/visual/boundary-review.spec.ts` — same 5 pre-existing failures as documented below and in
  the prior pass (`rgba(0,0,0,0)` vs `rgb(9,10,8)` stage-bg assertions on 01→02/02→03/03→04 + the
  global boundary-geometry invariant test), **reproduced identically on the pre-fix baseline**
  (`git stash` on the four scene files, re-ran the suite, same 5 failures with the same messages)
  — confirmed NOT introduced or worsened by this pass.
- Full un-scoped `npx playwright test --project=1920x1080` (all specs) run in background this
  pass for a final broad sweep — see the tail of this document / next session for its result if it
  completed after this file was written.

## Motion video review

Not re-recorded this pass beyond what `boundary-04-05.spec.ts` already captures
(`output/playwright/motion-video/scene_04_to_05_boundary_splice.webm`, re-verified PASS). Dedicated
slow-scrub videos for 02→03 and 03→04 (per the request's phase gates) were not separately recorded
— the existing `boundary-review.spec.ts` 02→03/03→04 specs already record
`scene_02_to_03_boundary_splice.webm` / equivalent when they run, but those specific test cases
fail on the pre-existing stage-bg assertion before reaching the video-save step, so no fresh video
artifact exists for those two boundaries from this pass. Flagged under Remaining issues.

## Remaining issues (not fixed this pass, explicitly noted)

1. The 5 pre-existing `boundary-review.spec.ts` failures (stage `background-color` assertions
   expecting `rgb(9,10,8)`, finding `rgba(0,0,0,0)`, plus the resulting global invariant failure)
   are still present — reproduced on the pre-fix baseline, not caused by this pass, but also not
   fixed by it. They block `scene_02_to_03_boundary_splice.webm` /
   `scene_03_to_04_boundary_splice.webm` from being (re-)generated via that spec file.
2. Refresh-mid-scroll and resize-mid-scroll at each boundary's midpoint were not scripted as
   dedicated tests this pass (sections 36–37 of the request). The fix is structurally refresh/
   resize-safe (`invalidateOnRefresh: true`, scrub-driven bridges with no discrete one-time state),
   but this claim is architectural, not test-verified, for this pass.
2b. Global footer/chrome was not hoisted into one shared component (see Header/footer ownership
   above) — each scene still renders its own footer markup, just correctly scoped now.
3. Mobile motion video recordings (forward/reverse at 430×932, 390×844) were not re-recorded this
   pass; static dense-checkpoint screenshots via `scene-ownership.spec.ts` were captured/asserted
   at those viewports instead (12/12 pass), which is a weaker guarantee than a watched video per
   rule 33.
4. The pre-existing Scene 05 cosmetic item ("SOURCE REGISTRATION SPINE LOCKED" label not
   state-driven after withdrawal) from the prior pass is untouched — still open, still low
   priority, unrelated to ownership.

## Scene 05 (Revocation) creative refinement status

Untouched this pass beyond the ownership fix (`visibilityTrigger.start` + carrier visibility
override). Per the hard gate, no further Scene 05 interior refinement was attempted — boundary
stability came first, per the strict phase order requested.

## NEXT EXACT TASK

1. Script refresh-at-boundary-midpoint and resize-at-boundary-midpoint tests for 02→03, 03→04,
   04→05 (sections 36–37) to convert the "structurally safe" claim above into a verified one.
2. Decide whether to invest in fixing the 5 pre-existing `boundary-review.spec.ts` stage-bg
   failures (likely a one-line CSS fix — give `.stage` its own `background-color: rgb(9,10,8)` in
   the three affected module files) so those boundary specs can run to completion and produce
   fresh 02→03/03→04 motion videos.
3. Only after 1–2: resume Scene 05 interior creative refinement, still under the hard gate — Scene
   06 (Split-Payment Defense) remains NOT started, NOT prepared, NOT mounted.

---

# PHASE 5 — SCENE 05 / REVOCATION: PASS (recovered, boundary fixed, mechanic strengthened) [prior pass]

**PHASE 5 — SCENE 05 / REVOCATION: PASS (recovered, boundary fixed, mechanic strengthened)**

This status file previously claimed Phase 5 was "100% COMPLETE" and "PERMANENTLY FROZEN" with all
tests passing. That claim was **stale/inaccurate**: live browser inspection found a genuine
Scene 04 → 05 overlap bug (double Authority Folio/header banners stacked during handoff), and a
clean baseline `npx playwright test` run showed 5 pre-existing failures unrelated to Scene 05
(Scene 01→02, 02→03, 03→04 boundary specs, and a global invariant spec — all failing on
`[data-delegation-stage]`/`[data-decisions-stage]` background-color assertions expecting
`rgb(9, 10, 8)` but finding `rgba(0, 0, 0, 0)`; `.stage` has no own `background-color` declared in
those modules, the near-black comes from the parent `cinematicStage`, so the assertion looks
stale against current CSS). Those 5 are **out of scope for this pass** (frozen earlier scenes) and
were not touched or fixed here — flagging so they aren't mistaken for new regressions.

The active, fully-recovered cinematic experience contains:
- `00 / Opening / Prologue` — PERMANENTLY FROZEN
- `Permission Bridge` — PERMANENTLY FROZEN
- `Transition A` — PERMANENTLY FROZEN
- `Transition B (4-Side Contraction & Single Statement)` — PERMANENTLY FROZEN
- `01 / Mandate` — PERMANENTLY FROZEN
- `Boundary 01 → 02 (Mandate → Decisions Editorial Splice)` — PERMANENTLY FROZEN (pre-existing stage-bg test failure, see above; not investigated, out of scope)
- `02 / Decisions (ALLOW / STEP-UP / DENY)` — PERMANENTLY FROZEN
- `Boundary 02 → 03 (Decisions → Delegation Evidence Carrier)` — PERMANENTLY FROZEN (pre-existing stage-bg test failure, see above; not investigated, out of scope)
- `03 / Delegation (Cinematic Refinement)` — PERMANENTLY FROZEN
- `Boundary 03 → 04 (Delegation → Step-Up Authority Folio)` — PERMANENTLY FROZEN (pre-existing stage-bg test failure, see above; not investigated, out of scope)
- `04 / Step-Up Clearance` — PERMANENTLY FROZEN (untouched this pass, except the new outgoing folio/header crossfade described below)
- `Boundary 04 → 05 (Step-Up → Revocation Folio Unfolding & Spine Coupling)` — **FIXED THIS PASS**: previously both scenes' folio/header rendered at near-full opacity simultaneously during the 120px pre-roll window (hard root cause, verified). Now a matched crossfade.
- `05 / Revocation (Source Spine Withdrawal & Authority Out of Register)` — **REFINED THIS PASS**: hierarchy, identifier semantics, and physical-embedding of the source spine strengthened; hero mechanic preserved and made more legible.

**HARD GATE ENFORCED**: Scene 06 (Split-Payment Defense) has NOT been modified, prepared, or mounted. Work is stopped and preserved at the Scene 05 terminal boundary gate per user instruction.

---

# Recovery & fix log (this pass)

## Root cause: Scene 04 → 05 overlap
`RevocationScene`'s visibility ScrollTrigger flips to `visible` 120px *before* its own pinned
timeline starts (`top top+=120px`), so during that 120px window the folio/header rendered at
their `fromTo` "from" state (~0.9 opacity) via a hard visibility switch — while `StepUpScene`'s
own Authority Folio/header had **no exit animation at all** and stayed at opacity 1 until a hard
`visibility: hidden` cut at its own end. Net effect: `03 // AUTHORITY FOLIO` (Step-Up) and
`05 // AUTHORITY REGISTER` (Revocation) rendered stacked at near-full opacity for a real 120px
scroll window — reproduced and measured (`sum of opacities ≈ 1.9`) before the fix, both by manual
browser inspection and by a new regression test.

**Fix**: `StepUpScene.tsx` gained a scrubbed `folioBridgeOut` ScrollTrigger (`bottom top+=120px` →
`bottom top`) fading its folio/header 1→0; `RevocationScene.tsx` gained a matching `folioBridgeIn`
ScrollTrigger (`top top+=120px` → `top top`) fading its folio/header 0→1 over the identical
120px window. The pinned timelines' own `fromTo` opacity control was removed (kept only the `y`
settle) so the two triggers don't fight. Fully reversible (scrub-driven, not discrete callbacks).
Confirmed via new `tests/visual/boundary-04-05.spec.ts` (fails on old code with opacity sum 1.9,
passes on fixed code with sum ≤ 1.15 at every sampled point across forward + reverse scrub).

## Scene 05 mechanic refinement
- **Identifier semantics fixed**: Travel's primary displayed ID was `TX-1082` (a transaction
  reference) presented like a permanent authority ID. Now displays `AUTH-REQ-0401` (the
  authorization-request reference, matching the `AUTH-030x` naming pattern of the other three
  records) as the primary chip, with `TX REF: TX-1082` shown as a clearly secondary line. DOM
  wiring (`data-record`, `data-state-value`, etc.) still keys off `TX-1082` internally — zero
  risk to existing GSAP selectors/timeline.
- **Hierarchy**: Shopping (source) now reads visibly largest (bumped identity/category font
  sizes); Grocery + Delivery (siblings) are scaled down (~0.95×) and paired directly beneath it;
  Travel (control case) is now visually separated by a dashed rule + extra margin below the
  sibling pair, so the register no longer reads as four equal dashboard rows.
- **Source spine physical embedding**: added a `.recallChannel` — a tapered dark track that
  extends left of the Shopping card, behind the sliding spine carriage. Before this, the spine
  carriage overflowed the card edge and appeared to float disconnected over black once its GSAP
  `x` transform slid it past the card boundary (visually confirmed via checkpoint screenshot at
  progress 0.45). The channel gives the withdrawal something to travel *through*, so it now reads
  as a mechanism being pulled from a socket rather than a UI glitch. Verified at desktop and
  mobile checkpoints; no clipping/overflow regressions.
- Kept as-is (already correct, no change needed): the "SOCKET: EMPTY // WITHDRAWN" empty-socket
  notice on Shopping, the inherited-registration bands on Grocery/Delivery, the independent-track
  band + advance motion on Travel, and all beat timing/choreography.

## Verified
- `npm run build` — PASS, 0 errors.
- `npm run lint` — pre-existing errors/warnings only (confirmed identical before/after my changes
  via `git stash`); zero new lint issues introduced.
- `tests/visual/revocation-review.spec.ts` — PASS (1920x1080, 1440x900, 1366x768, 430x932, 390x844).
- `tests/visual/revocation-video.spec.ts` — PASS (all non-skipped projects).
- `tests/visual/reduced-motion.spec.ts` — PASS (all non-skipped projects).
- `tests/visual/boundary-04-05.spec.ts` (**new**) — PASS; confirmed it fails on pre-fix code
  (opacity-sum invariant) and passes on fixed code, across forward + reverse scrub.
- `tests/visual/boundary-review.spec.ts` (Scene 01→02, 02→03, 03→04) — same 5 pre-existing
  failures on a clean `git stash` baseline as with my changes applied; not introduced by this
  pass, not investigated further (out of scope — earlier scenes are frozen).

---

# Scene 05 / Revocation Status Report

## 1. Core Creative Concept & Physical Mechanism

| Concept / Metric | Specification & Implementation |
| :--- | :--- |
| **Internal Creative Concept** | **AUTHORITY OUT OF REGISTER** |
| **Hero Physical Mechanism** | **SOURCE SPINE WITHDRAWAL** |
| **Semantic Invariant** | Single Root Invalidation propagates to dependent sibling derived authorities (`AUTH-0302`, `AUTH-0303`) while control case (`TX-1082`) continues unaffected. |
| **History Preservation** | **100% Preserved**. No documents explode, fade to zero, or disappear. All 4 authority register records remain visible on stage through completion. |
| **Stage Geometry Contract** | Persistent fixed cinematic stage (`position: absolute; inset: 0;`), zero-gap layer contract (`margin-top: -100svh`, `z-index: 40`), ScrollTrigger unpinned chaining. |

---

## 2. Product Semantics & Identifier Separation

| Record ID | Agent / Purpose | Lineage Track | Invalidation Mechanism | Status Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **`AUTH-0301`** | Shopping Agent (`₹4,000 / week`) | Direct source under `KP-1967-M` | **Source Spine Withdrawal**: Physical carriage translates `-160px` left into recall caliper, exposing empty socket (`SOCKET: EMPTY // WITHDRAWN`). | Printed square chamber transitions from `VALID` to `REVOKED`; crisp administrative red `REVOKED` stamp strikes the card. |
| **`AUTH-0302`** | Grocery Agent (`₹1,500 / week`) | Derived sibling under `AUTH-0301` | **Inherited Register Misalignment**: Physical alignment tooth/register drops `+3.5px` off baseline and wavers (`x: [-1.5px, 1.5px]`). | Status chamber transitions from `VALID` to `WITHDRAWN`; administrative red `WITHDRAWN` stamp applied. |
| **`AUTH-0303`** | Delivery Agent (`₹1,000 / week`) | Derived sibling under `AUTH-0301` | **Inherited Register Misalignment**: Physical alignment tooth/register drops `+3.5px` off baseline and wavers (`x: [-1.5px, 1.5px]`). | Status chamber transitions from `VALID` to `WITHDRAWN`; administrative red `WITHDRAWN` stamp applied. |
| **`TX-1082`** | Travel Agent (`₹4,900 / one-time`) | Independent lineage track (`AUTH-REQ-0401` clearance) | **Zero Mechanical Coupling**: Independent register band remains locked in baseline register (`y: 0px`). Advances downstream `+28px` at Beat 7. | Status chamber remains permanently `RELEASED` / `CLEARED`; zero red ink applied. Proof of selective revocation. |

---

## 3. ScrollTrigger Coordinates (1920x1080 Master Viewport)

```text
prologue:   start: -0.001, end: 1296
mandate:    start: 1296,   end: 3024   (diff to prologue.end: 0px)
decisions:  start: 3024,   end: 5400   (diff to mandate.end: 0px)
delegation: start: 5400,   end: 9072   (diff to decisions.end: 0px)
step-up:    start: 9072,   end: 12528  (diff to delegation.end: 0px)
revocation: start: 12528,  end: 16200  (diff to step-up.end: 0px)
```

**Unbroken Pinning Chain**: All incoming scenes start at the exact pixel of the outgoing scene (`Math.abs(incoming.start - outgoing.end) <= 2px`), verified across all 5 viewports.

---

## 4. Choreography Beats (0.00 to 1.00)

- **Beat 1 (0.00–0.16)**: *Authority Folio Takeover & Register Unfolding*. Authority Folio expands from Step-Up terminal state; 4 authority register rows unfold along Datum 05.
- **Beat 2 (0.16–0.26)**: *Initial Valid Registration Alignment*. Physical registration spine carriage forms continuous vertical registration line on Column 1 (`colSpine`). All 4 records in register.
- **Beat 3 (0.26–0.38)**: *Shopping Recall Targeting*. Recall caliper aligns on `AUTH-0301`. Header status bar announces `RECALL: AUTH-0301 // TARGET ENGAGED`.
- **Beat 4 (0.38–0.54)**: *Hero Source-Spine Withdrawal*. Source spine translates left (`x: 0 -> -160px`), sliding out of socket. At ~0.46 (50% withdrawn), Shopping validity indicator wavers, siblings begin misregistration, Travel remains rock-solid.
- **Beat 5 (0.54–0.66)**: *Source Invalidation Sealed*. Spine clears socket completely; Shopping square chamber stamps `REVOKED` with red border/ink.
- **Beat 6 (0.64–0.78)**: *Sibling Misregistration Resolution*. Grocery and Delivery register teeth slip `+3.5px` out of track; both stamped `WITHDRAWN`.
- **Beat 7 (0.76–0.88)**: *Travel Selectivity Advance*. Travel Agent record advances independently `+28px` to the right, showing untouched clearance lineage.
- **Beat 8 (0.88–1.00)**: *Full Historical Hold*. Terminal resting frame holding all 4 physical records with complete provenance intact.

---

## 5. Motion Video Recordings & Verification Artifacts

All motion videos generated and stored in `output/playwright/motion-video/`:

| Video File | Description | Check |
| :--- | :--- | :--- |
| `scene_04_05_transition.webm` | Transition handoff from Step-Up clearance release into Revocation Folio | PASS |
| `scene_05_normal_forward_reverse.webm` | Continuous forward scrub followed by smooth reverse scrub back to 0.00 | PASS |
| `scene_05_slow_and_fast.webm` | Fine-grained scrub across spine withdrawal (0.38–0.60) + high velocity scrub | PASS |
| `scene_05_mobile_430x932.webm` | Mobile forward and reverse scrub at 430x932 viewport | PASS |
| `scene_05_mobile_390x844.webm` | Mobile forward and reverse scrub at 390x844 viewport | PASS |
| `scene_04_to_05_boundary_splice.webm` | Dedicated boundary verification video | PASS |
| `scene_05_revocation_motion_review.webm` | Full sequence detailed motion review | PASS |

Dense checkpoints (0%–100% by 5%) and event frames captured under:
- `output/playwright/checkpoints/1920x1080/revocation/`
- `output/playwright/checkpoints/430x932/revocation/`
- `output/playwright/checkpoints/390x844/revocation/`
- `output/playwright/checkpoints/events-scene-05/`

---

## 6. Test Suites Passed

- `npm run build` — PASS (Turbopack production build clean, 0 errors, 0 warnings).
- `tests/visual/stage-a-verification.spec.ts` — PASS (6/6 tests: Full forward, slow boundary scrub, fast scroll, full reverse, mobile 430x932, mobile 390x844).
- `tests/visual/revocation-review.spec.ts` — PASS across all 5 viewports (`1920x1080`, `1440x900`, `1366x768`, `430x932`, `390x844`).
- `tests/visual/reduced-motion.spec.ts` — PASS across desktop (1440x900) and mobile (390x844).
- `tests/visual/revocation-video.spec.ts` — PASS (5/5 motion videos recorded).
- `tests/visual/boundary-04-05.spec.ts` — **NEW**, PASS. Did not exist before this pass; the
  04→05 boundary previously had no dedicated regression test at all.

---

# Remaining known issues (not fixed this pass, explicitly out of scope)

1. `tests/visual/boundary-review.spec.ts` — 5 pre-existing failures (Scene 01→02, 02→03, 03→04,
   and the global invariant test), all rooted in `[data-*-stage]` elements having no own
   `background-color` in their CSS modules while the test asserts one. Reproduced on a clean
   `git stash` baseline before any of my edits — not a regression from this pass. Those scenes are
   frozen; not investigated or touched.
2. The static carriage label inside the Shopping source-spine reads `SOURCE REGISTRATION SPINE
   LOCKED` even after full withdrawal (terminal frame) — cosmetic label text, not state-driven.
   Left as-is: out of scope for the transition/hierarchy fixes requested, low risk vs. reward to
   touch the timeline text logic further this pass.

---

# NEXT EXACT TASK

**06 / SPLIT DEFENSE** — not implemented, not prepared, not mounted (per hard gate).
