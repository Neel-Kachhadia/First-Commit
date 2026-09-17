const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const findings = {};
  async function run(name, viewport, reducedMotion = 'no-preference') {
    const context = await browser.newContext({ viewport, reducedMotion });
    const page = await context.newPage();
    const consoleEvents = [];
    const failed = [];
    page.on('console', m => { if (['warning','error'].includes(m.type())) consoleEvents.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => consoleEvents.push(`pageerror: ${e.message}`));
    page.on('requestfailed', r => failed.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
    await page.goto('http://127.0.0.1:3000/?visualTest=1', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const tracks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-track]')].map(el => { const r=el.getBoundingClientRect(); return [el.dataset.track,{start:r.top+scrollY,end:r.bottom+scrollY}]; })));
    const ids = ['step-up','revocation','split-defense','concurrency','causal-replay'];
    const states = [];
    for (const id of ids) {
      const b=tracks[id]; const y=Math.round(b.start+(b.end-b.start)*.5);
      await page.evaluate(y=>{scrollTo(0,y); dispatchEvent(new Event('scroll')); window.ScrollTrigger?.update?.()},y);
      await page.waitForTimeout(50);
      states.push(await page.evaluate(id=>({id,scrollY,active:document.querySelector('[data-scene="'+id+'"]')?.getAttribute('aria-hidden'), visible:[...document.querySelectorAll('[data-scene]')].filter(el=>{const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0}).map(el=>({id:el.dataset.scene,aria:el.getAttribute('aria-hidden'),pe:getComputedStyle(el).pointerEvents}))}),id));
    }
    const deep=tracks['causal-replay']; const target=Math.round(deep.start+(deep.end-deep.start)*.55);
    await page.evaluate(y=>scrollTo(0,y),target); await page.waitForTimeout(50);
    const before=await page.evaluate(()=>scrollY); await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(100);
    const after=await page.evaluate(()=>scrollY);
    const doc=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,canvas:document.querySelectorAll('canvas').length,scene:[...document.querySelectorAll('[data-scene]')].filter(el=>getComputedStyle(el).visibility!=='hidden').map(el=>el.dataset.scene)}));
    findings[name]={viewport,reducedMotion,states,refresh:{target,before,after},doc,consoleEvents,failed};
    await page.screenshot({path:path.join('output/final-audit/mobile',`${name}.png`)});
    await context.close();
  }
  fs.mkdirSync('output/final-audit/mobile',{recursive:true});
  await run('desktop-1440x900',{width:1440,height:900});
  await run('mobile-430x932',{width:430,height:932});
  await run('mobile-390x844',{width:390,height:844});
  await run('landscape-932x430',{width:932,height:430});
  await run('reduced-390x844',{width:390,height:844},'reduce');
  fs.writeFileSync('output/final-audit/reports/runtime-probe.json',JSON.stringify(findings,null,2));
  await browser.close();
})();
