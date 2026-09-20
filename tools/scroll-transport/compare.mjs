// node tools/scroll-transport/compare.mjs labelA labelB [labelC ...]   (viewport 1440x900)
import fs from "node:fs";
const labels = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const vp = process.env.VP ?? "1440x900";
const data = Object.fromEntries(labels.map((l) => [l, Object.fromEntries(JSON.parse(fs.readFileSync(`output/scroll-transport/${l}/${vp}/re-summary.json`, "utf8")).map((r) => [r.profile, r]))]));
const pick = process.env.METRIC ?? "core";
const f = (x) => (x === null || x === undefined ? "-" : typeof x === "number" ? String(x) : Array.isArray(x) ? x.join("/") : JSON.stringify(x));
const rows = {
  core: (r) => [f(r.shown60.deltaMedian), f(r.shown60.deltaP95), f(r.shown60.deltaMax), f(r.shown60.velocityPeak), f(r.shown60.velocityVariance), f(r.shown60.velocityStepMax), f(r.seekWrites), f(r.presentedFrames), f(r.staleWrites ?? "-"), f(r.settleAfterTargetStopMs ? r.settleAfterTargetStopMs.shown : "-"), f(r.inputToVisibleMs ?? "-"), f(r.shown60.signFlips)],
};
console.log(["profile", ...labels.flatMap((l) => [l + ": dMed", "dP95", "dMax", "vPeak", "vVar", "dvMax", "writes", "presented", "stale", "settle", "i2v", "flips"])].join(" | "));
for (const p of Object.keys(data[labels[0]])) console.log([p, ...labels.flatMap((l) => (data[l][p] ? rows.core(data[l][p]) : Array(12).fill("-")))].join(" | "));
