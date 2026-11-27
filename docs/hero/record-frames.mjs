// Step the embedded example frame by frame (virtual clock) and save PNGs.
// node scripts/record-frames.mjs <base> <example> <outdir> <width> <frames> <stepsPerFrame> [dpr]
import { mkdirSync } from 'node:fs'
import { launch } from './browser.mjs'
const [base, name, out, width, frames, per, dpr = '1', height = '560'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const browser = await launch()
const page = await browser.newPage({ viewport: { width: +width + 40, height: 900 }, deviceScaleFactor: +dpr })
await page.goto(base + '/?capture=__none__').catch(() => {})
await page.setContent('')
await page.goto(base + '/playground-blank-404').catch(() => {})
await page.evaluate(({ base, name, width, HEIGHT }) => new Promise((res) => {
  document.body.style.margin = '0'
  const f = document.createElement('iframe')
  f.id = 'f'; f.style.cssText = `border:0;width:${width}px;height:${HEIGHT}px;display:block`
  window.__status = null
  window.addEventListener('message', (e) => { if (e.data?.type === 'stageshow:status') { window.__status = e.data; if (e.data.ready !== false) res() } })
  f.src = base + '/?embed=' + name
  document.body.appendChild(f)
}), { base, name, width: +width, HEIGHT: +height })
await page.waitForTimeout(1500)
const f = page.frameLocator('#f')
const post = (data) => page.evaluate((d) => document.getElementById('f').contentWindow.postMessage({ type: 'stageshow:control', ...d }, location.origin), data)
// Pause, then restart from frame 0 is not exposed; record from the paused point.
await post({ playing: false })
await page.waitForTimeout(300)
const step = async () => {
  const before = await page.evaluate(() => window.__status?.frame ?? -1)
  await post({ step: true })
  await page.waitForFunction((b) => (window.__status?.frame ?? -1) > b, before, { timeout: 5000 })
}
const el = page.locator('#f')
for (let i = 0; i < +frames; i++) {
  for (let k = 0; k < +per; k++) await step()
  await el.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.png` })
}
await browser.close()
console.log('frames', frames, '->', out)
