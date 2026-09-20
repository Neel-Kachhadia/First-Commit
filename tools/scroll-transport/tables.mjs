// Markdown tables for SCROLL_TRANSPORT_CONTINUITY_REPORT.md from re-analysed harness runs.
//   node tools/scroll-transport/tables.mjs
import fs from "node:fs";
const load = (label, vp = "1440x900") => {
  const f = `output/scroll-transport/${label}/${vp}/re-summary.json`;
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : [];
};
const by = (rows) => Object.fromEntries(rows.map((r) => [`${r.profile}@${r.boundary}`, r]));
const f = (x, n = 3) => (x === null || x === undefined ? "–" : typeof x === "number" ? (Math.abs(x) >= 100 ? String(Math.round(x)) : String(Math.round(x * 10 ** n) / 10 ** n)) : String(x));
const med = (a) => { const s = a.filter((x) => x !== null && x !== undefined).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

const before = by(load("before"));
const off = by(load("off"));
const after = by(load("after"));

const P = ["A_tiny", "B_medium", "C_large", "D_noisy", "E_giant", "F_fwd_rev", "G_rev_fwd", "H_signnoise", "I_stop25", "I_stop50", "I_stop75", "J_hitch", "K_osc_start", "K_osc_mid", "K_osc_end", "L_full_fast", "M_full_reverse", "N_slow_fast_slow"];
const key = (p) => `${p}@01-02`;
const row = (name, m) => `| ${name} | ${m.map((x) => f(x)).join(" | ")} |`;

console.log("### 24-A. Boundary 01-02, 1440x900 — SHOWN progress on a 60 Hz grid (median move / p95 / max jump per frame, peak velocity, velocity variance)\n");
console.log("| profile | mode | Δ median | Δ p95 | Δ max (largest jump) | peak v (/s) | v variance | max Δv/frame |");
console.log("|---|---|---|---|---|---|---|---|");
for (const p of P) {
  for (const [name, d] of [["BEFORE (old code)", before], ["OFF (same build, transport off)", off], ["AFTER", after]]) {
    const r = d[key(p)];
    if (!r) continue;
    console.log(row(`${p}`, [name, r.shown60.deltaMedian, r.shown60.deltaP95, r.shown60.deltaMax, r.shown60.velocityPeak, r.shown60.velocityVariance, r.shown60.velocityStepMax]));
  }
}

console.log("\n### 24-B. Seek pipeline (boundary 01-02, 1440x900)\n");
console.log("| profile | mode | currentTime writes | frames presented | unpresented (wasted) writes | write→present p50/p95 ms | seek service p50/p95 ms | input→visible ms | stop→still (shown, after target stops) ms | reverse lag ms |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const p of P) {
  for (const [name, d] of [["OFF", off], ["AFTER", after]]) {
    const r = d[key(p)];
    if (!r) continue;
    console.log(`| ${p} | ${name} | ${r.seekWrites} | ${r.presentedFrames} | ${r.unpresentedWrites} | ${f(r.writeToPresentMs.p50, 1)} / ${f(r.writeToPresentMs.p95, 1)} | ${f(r.seekServiceMs.p50, 1)} / ${f(r.seekServiceMs.p95, 1)} | ${f(r.inputToVisibleMs, 0)} | ${r.settleAfterTargetStopMs ? f(r.settleAfterTargetStopMs.shown, 0) : "–"} | ${f(r.reverseLagMs, 0)} |`);
  }
}

console.log("\n### 24-C. Aggregates over all 18 profiles (boundary 01-02, 1440x900)\n");
console.log("| mode | median of Δ-median | median of Δ-p95 | worst Δ-max | worst peak v | median v-variance | Σ writes | Σ presented | Σ unpresented | worst Δv/frame |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const [name, d] of [["BEFORE (old code)", before], ["OFF", off], ["AFTER", after]]) {
  const rs = P.map((p) => d[key(p)]).filter(Boolean);
  if (!rs.length) continue;
  const sum = (g) => rs.reduce((a, r) => a + (g(r) ?? 0), 0);
  console.log(`| ${name} | ${f(med(rs.map((r) => r.shown60.deltaMedian)), 4)} | ${f(med(rs.map((r) => r.shown60.deltaP95)), 4)} | ${f(Math.max(...rs.map((r) => r.shown60.deltaMax)), 4)} | ${f(Math.max(...rs.map((r) => r.shown60.velocityPeak)), 2)} | ${f(med(rs.map((r) => r.shown60.velocityVariance)), 3)} | ${sum((r) => r.seekWrites)} | ${sum((r) => r.presentedFrames)} | ${name.startsWith("BEFORE") ? "n/a" : sum((r) => r.unpresentedWrites)} | ${f(Math.max(...rs.map((r) => r.shown60.velocityStepMax)), 2)} |`);
}

// Per-transition (after-b + after) at 1440x900
const afterB = by(load("after-b"));
const offB = by(load("off-b"));
const ids = ["00-01", "01-02", "02-03", "03-04", "04-05", "05-06", "06-07"];
console.log("\n### 18. Per-transition forward/stop/reverse results, AFTER (1440x900)\n");
console.log("| transition | profile | Δ p95 | Δ max | peak v | writes | presented | unpresented | stop→still ms | reverse lag ms |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const id of ids) {
  for (const p of ["A_tiny", "B_medium", "C_large", "F_fwd_rev", "I_stop50"]) {
    const r = afterB[`${p}@${id}`] ?? after[`${p}@${id}`];
    if (!r) continue;
    console.log(`| ${id} | ${p} | ${f(r.shown60.deltaP95, 4)} | ${f(r.shown60.deltaMax, 4)} | ${f(r.shown60.velocityPeak, 2)} | ${r.seekWrites} | ${r.presentedFrames} | ${r.unpresentedWrites} | ${r.settleAfterTargetStopMs ? f(r.settleAfterTargetStopMs.shown, 0) : "–"} | ${f(r.reverseLagMs, 0)} |`);
  }
}
console.log("\n### 18-b. Same boundaries with the transport OFF (00-01, 04-05, 06-07)\n");
console.log("| transition | profile | Δ p95 | Δ max | peak v | writes | presented | unpresented |");
console.log("|---|---|---|---|---|---|---|---|");
for (const id of ["00-01", "04-05", "06-07"]) {
  for (const p of ["A_tiny", "B_medium", "C_large", "F_fwd_rev", "I_stop50"]) {
    const r = offB[`${p}@${id}`];
    if (!r) continue;
    console.log(`| ${id} | ${p} | ${f(r.shown60.deltaP95, 4)} | ${f(r.shown60.deltaMax, 4)} | ${f(r.shown60.velocityPeak, 2)} | ${r.seekWrites} | ${r.presentedFrames} | ${r.unpresentedWrites} |`);
  }
}

for (const vp of ["1920x1080", "1366x768"]) {
  const a = by(load("after", vp)); const o = by(load("off", vp));
  if (!Object.keys(a).length) continue;
  console.log(`\n### Viewport ${vp}\n`);
  console.log("| transition | profile | mode | Δ p95 | Δ max | peak v | writes | presented | unpresented | stop→still ms | reverse lag ms |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const id of ["01-02", "04-05"]) for (const p of ["B_medium", "C_large", "F_fwd_rev", "I_stop50"]) for (const [n, d] of [["OFF", o], ["AFTER", a]]) {
    const r = d[`${p}@${id}`]; if (!r) continue;
    console.log(`| ${id} | ${p} | ${n} | ${f(r.shown60.deltaP95, 4)} | ${f(r.shown60.deltaMax, 4)} | ${f(r.shown60.velocityPeak, 2)} | ${r.seekWrites} | ${r.presentedFrames} | ${r.unpresentedWrites} | ${r.settleAfterTargetStopMs ? f(r.settleAfterTargetStopMs.shown, 0) : "–"} | ${f(r.reverseLagMs, 0)} |`);
  }
}
