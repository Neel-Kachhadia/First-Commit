import { chromium } from "@playwright/test";

const [vpArg = "1440x900"] = process.argv.slice(2);
const [width, height] = vpArg.split("x").map(Number);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width, height } });

await page.goto("http://127.0.0.1:3000/?intro=0", { waitUntil: "load", timeout: 60000 });
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForFunction(() => window.ScrollTrigger && document.querySelectorAll("[data-transition-track]").length === 7);

const metrics = await page.evaluate(() => {
  const vh = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const maxScrollY = docHeight - vh;

  const scenes = [
    { key: "prologue", slug: "prologue", name: "Scene00" },
    { key: "mandate", slug: "mandate", name: "Scene01" },
    { key: "decisions", slug: "decisions", name: "Scene02" },
    { key: "delegation", slug: "delegation", name: "Scene03" },
    { key: "stepUp", slug: "step-up", name: "Scene04" },
    { key: "revocation", slug: "revocation", name: "Scene05" },
    { key: "splitDefense", slug: "split-defense", name: "Scene06" },
    { key: "concurrency", slug: "concurrency", name: "Scene07" },
    { key: "causalReplay", slug: "causal-replay", name: "Scene08" },
  ];

  const transitions = [
    { id: "00-01", name: "00→01" },
    { id: "01-02", name: "01→02" },
    { id: "02-03", name: "02→03" },
    { id: "03-04", name: "03→04" },
    { id: "04-05", name: "04→05" },
    { id: "05-06", name: "05→06" },
    { id: "06-07", name: "06→07" },
  ];

  const sceneMetrics = scenes.map((s) => {
    const el = document.querySelector(`[data-track='${s.slug}']`);
    const top = el ? el.offsetTop : null;
    const height = el ? el.offsetHeight : null;
    return { ...s, top, height, heightVh: height ? height / vh : null };
  });

  const transitionMetrics = transitions.map((t) => {
    const el = document.querySelector(`[data-transition-track='${t.id}']`);
    const top = el ? el.offsetTop : null;
    const height = el ? el.offsetHeight : null;
    return { ...t, top, height, heightVh: height ? height / vh : null };
  });

  // Calculate 07 -> 08 boundary / handoff:
  const c7 = sceneMetrics.find((s) => s.key === "concurrency");
  const c8 = sceneMetrics.find((s) => s.key === "causalReplay");
  const handoff0708 = c8.top - (c7.top + c7.height);

  return {
    viewport: { width: window.innerWidth, height: vh },
    docHeight,
    maxScrollY,
    sceneMetrics,
    transitionMetrics,
    handoff0708,
  };
});

console.log(JSON.stringify(metrics, null, 2));

await browser.close();
