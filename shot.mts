import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2 });
const hz = Number(process.argv[3] ?? 0);
if (hz > 0) {
  await p.addInitScript((f) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const a = new AudioContext(); await a.resume();
      const d = a.createMediaStreamDestination();
      [1,0.65,0.45,0.3,0.2,0.12].forEach((amp,i) => {
        const o = a.createOscillator(), g = a.createGain();
        o.frequency.value = f*(i+1); g.gain.value = amp*0.15;
        o.connect(g); g.connect(d); o.start();
      });
      return d.stream;
    };
  }, hz);
}
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
if (hz > 0) { await p.getByRole('button', { name: 'listen' }).click(); await p.waitForTimeout(2200); }
else await p.waitForTimeout(700);
await p.screenshot({ path: process.argv[2] });
console.log('saved');
await b.close();
