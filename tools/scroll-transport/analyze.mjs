// Re-analyse stored harness runs with the CURRENT analysis code (so BEFORE and AFTER always use identical metrics).
//   node tools/scroll-transport/analyze.mjs <label> [viewport]
import fs from "node:fs";
import path from "node:path";
process.argv[1] = "analyze.mjs";
const { analyze } = await import("./harness.mjs");
const [label, vp = "1440x900"] = process.argv.slice(2);
const dir = path.join("output", "scroll-transport", label, vp);
const out = [];
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json") && n !== "summary.json" && !n.startsWith("re-"))) {
  const { run } = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  out.push(analyze(run));
}
fs.writeFileSync(path.join(dir, "re-summary.json"), JSON.stringify(out, null, 2));
console.log(out.length, "runs re-analysed ->", path.join(dir, "re-summary.json"));
