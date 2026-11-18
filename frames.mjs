import { chromium } from 'playwright';
const [file, ...ts] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
await p.goto('file://' + file);
const d = await p.evaluate(async () => { const v = document.querySelector('video'); v.pause(); await new Promise(r => v.readyState >= 1 ? r() : v.onloadedmetadata = r); return v.duration; });
console.log('duration', d);
for (const t of ts) {
  await p.evaluate(async (t) => { const v = document.querySelector('video'); v.currentTime = t; await new Promise(r => v.onseeked = r); }, Number(t));
  await p.locator('video').screenshot({ path: `${file}.${t}.png` });
}
await b.close();
