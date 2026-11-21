/**
 * Production smoke test: loads the built app in headless Chrome, walks every
 * screen at desktop, tablet and mobile widths, and fails on console errors,
 * horizontal overflow, missing content, or any third-party network request.
 *
 * Usage: npm run preview -- --port 4173  (in another shell), then
 *        node scripts/smoke.cjs [baseUrl] [screenshotDir]
 */
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || path.join('scripts', 'screens');
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const SCREENS = ['command', 'visual', 'temporal', 'voice', 'airlock'];

const PASSES = [
  { label: 'desktop', suffix: 'desktop', width: 1440, height: 960, scale: 1, mobile: false },
  { label: 'tablet', suffix: 'tablet', width: 1024, height: 768, scale: 1, mobile: false },
  { label: 'compact', suffix: 'compact', width: 768, height: 1024, scale: 1, mobile: false },
  { label: 'mobile', suffix: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dismissGateway(page) {
  return page.evaluate(() => {
    const target = [...document.querySelectorAll('button')].find((button) =>
      /explore without the tour/i.test(button.textContent || ''),
    );
    if (target) {
      target.click();
      return true;
    }
    return false;
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  const failures = [];
  const external = [];

  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(BASE) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
    }
  });

  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, 'gateway-desktop.png') });

  const skipped = await dismissGateway(page);
  if (!skipped) failures.push('could not dismiss the gateway');
  await sleep(900);

  for (const pass of PASSES) {
    await page.setViewport({
      width: pass.width,
      height: pass.height,
      deviceScaleFactor: pass.scale,
      isMobile: pass.mobile,
    });
    await sleep(pass.mobile ? 900 : 450);
    // A device-metrics change can reload the document and reopen the gateway.
    await dismissGateway(page);
    await sleep(500);

    for (const screen of SCREENS) {
      await page.goto(`${BASE}/#/${screen}`, { waitUntil: 'networkidle0' });
      await sleep(650);
      const metrics = await page.evaluate(() => {
        const wide = [...document.querySelectorAll('body *')]
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.right > window.innerWidth + 2;
          })
          .slice(0, 6)
          .map((node) => `${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]}`);
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          title: document.querySelector('h1')?.textContent?.trim() || '',
          textLength: document.body.innerText.length,
          wide,
        };
      });
      if (metrics.scrollWidth > metrics.innerWidth + 1) {
        failures.push(
          `${pass.label} ${screen}: horizontal overflow ${metrics.scrollWidth} > ${metrics.innerWidth} (${metrics.wide.join(', ')})`,
        );
      }
      if (metrics.textLength < 400) failures.push(`${pass.label} ${screen}: page looks empty`);
      await page.screenshot({
        path: path.join(OUT, `${screen}-${pass.suffix}.png`),
        fullPage: true,
      });
      console.log(
        `${pass.label.padEnd(8)} ${screen.padEnd(8)}: ${metrics.title} · scrollWidth ${metrics.scrollWidth}/${metrics.innerWidth}`,
      );
    }
  }

  if (external.length) {
    failures.push(`third-party requests: ${[...new Set(external)].join(', ')}`);
  }

  await browser.close();

  if (failures.length) {
    console.error('\nFAILURES');
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
  }
  console.log(`\nOK · screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
