const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tourState(page) {
  return page.evaluate(() => ({
    hash: location.hash,
    title: document.querySelector('.tour-title')?.textContent || null,
    counter: document.querySelector('.tour-counter')?.textContent?.replace(/\s+/g, '') || null,
    cta: document.querySelector('.tour-cta')?.textContent?.replace(/\s+/g, ' ').trim() || null,
    disabled: document.querySelector('.tour-cta')?.disabled ?? null,
    settled: document.querySelector('.tour-layer')?.classList.contains('is-settled') ?? null,
    tourOpen: !!document.querySelector('.tour-layer'),
  }));
}

async function clickCta(page) {
  const point = await page.evaluate(() => {
    const btn = document.querySelector('.tour-cta');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    window.__clicks = [];
    document.addEventListener(
      'click',
      (e) => {
        window.__clicks.push({
          tag: e.target.tagName,
          cls: String(e.target.className).slice(0, 40),
          text: (e.target.textContent || '').trim().slice(0, 24),
        });
      },
      true,
    );
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!point) throw new Error('no tour CTA');
  await page.mouse.click(point.x, point.y);
  await sleep(250);
  const post = await page.evaluate(() => ({
    clicks: window.__clicks,
    cta: document.querySelector('.tour-cta')?.textContent?.replace(/\s+/g, ' ').trim(),
    disabled: document.querySelector('.tour-cta')?.disabled,
  }));
  console.log('   click ->', JSON.stringify(post));
}

async function waitFor(page, predicate, label, timeout = 12000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeout) {
    last = await tourState(page);
    if (predicate(last)) return last;
    await sleep(120);
  }
  throw new Error(`timeout waiting for ${label}: ${JSON.stringify(last)}`);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.setViewport({ width: 1440, height: 960 });

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(700);
  console.log('gateway:', await page.evaluate(() => !!document.querySelector('.sim-gateway')));

  await page.evaluate(() => document.querySelector('.crisis-card')?.click());
  await waitFor(page, (s) => s.counter === '01/05' && s.settled, 'step 1');

  const steps = ['01/05', '02/05', '03/05', '04/05', '05/05'];
  for (let i = 0; i < steps.length; i++) {
    const state = await waitFor(page, (s) => s.counter === steps[i] && s.settled, `step ${steps[i]}`);
    console.log('step', JSON.stringify(state));
    await clickCta(page);
    if (i < steps.length - 1) {
      await waitFor(page, (s) => s.counter === steps[i + 1] && s.settled, `advance to ${steps[i + 1]}`);
    }
  }

  // Final CTA applies remediation and closes the tour.
  await waitFor(page, (s) => !s.tourOpen, 'tour closed');
  await sleep(600);
  const final = await page.evaluate(() => ({
    hash: location.hash,
    variant: [...document.querySelectorAll('.segmented-item')].find((b) => b.classList.contains('is-active'))?.textContent?.trim() || null,
    tourOpen: !!document.querySelector('.tour-layer'),
    toast: document.querySelector('.toast-title')?.textContent || document.querySelector('.toast')?.textContent?.slice(0, 80) || null,
  }));
  console.log('final', JSON.stringify(final));
  await page.screenshot({ path: 'scripts/screens/tour-final.png' });

  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
