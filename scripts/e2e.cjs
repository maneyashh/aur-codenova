/**
 * AURA-GOV / interactive end-to-end sweep
 * ---------------------------------------
 * Exercises every promise the product makes at runtime, at desktop width:
 *   dataset switch, arbiter stress routing, DOM drift injection + quarantine,
 *   temporal advance + persisted override, voice authorization + diff export,
 *   multi-tenant vault (switch, revoke, re-issue, tamper, verify, export,
 *   reload persistence) and the command palette.
 *
 * Usage: node scripts/e2e.cjs [baseUrl]
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:4173';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
let page;
let consoleErrors = [];
let pageErrors = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? `  ·  ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? `  ·  ${detail}` : ''}`);
  throw new Error(`${name} :: ${detail}`);
}

function assert(name, condition, detail) {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

async function text(selector) {
  return page.$eval(selector, (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).catch(() => null);
}

async function bodyText() {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
}

/** Click the first button whose visible text matches the regular expression. */
async function clickText(pattern, { wait = 450, optional = false } = {}) {
  const clicked = await page.evaluate((source, flags) => {
    const rx = new RegExp(source, flags);
    const nodes = [...document.querySelectorAll('button, [role="tab"], a')];
    const el = nodes.find((node) => rx.test((node.textContent || '').replace(/\s+/g, ' ').trim()));
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, pattern.source, pattern.flags);
  if (!clicked && !optional) fail(`click ${pattern}`, 'control not found');
  await sleep(wait);
  return clicked;
}

async function clickAria(label, { wait = 450, optional = false } = {}) {
  const clicked = await page.evaluate((target) => {
    const el = [...document.querySelectorAll('button[aria-label]')].find(
      (node) => node.getAttribute('aria-label') === target,
    );
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, label);
  if (!clicked && !optional) fail(`click aria ${label}`, 'control not found');
  await sleep(wait);
  return clicked;
}

async function waitForText(pattern, timeout = 6000) {
  try {
    await page.waitForFunction(
      (source, flags) => new RegExp(source, flags).test(document.body.innerText.replace(/\s+/g, ' ')),
      { timeout },
      pattern.source,
      pattern.flags,
    );
    return true;
  } catch {
    return false;
  }
}

async function goto(hash) {
  await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'networkidle0' });
  await sleep(500);
  await dismissGateway();
  await sleep(350);
}

async function dismissGateway() {
  await clickText(/explore without the tour/i, { wait: 450, optional: true });
}

/** Capture real Blob payloads handed to URL.createObjectURL. */
async function installDownloadTap() {
  await page.evaluate(() => {
    window.__auraDownloads = [];
    if (!window.__auraTapInstalled) {
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        try {
          window.__auraDownloads.push(blob);
        } catch {
          /* ignore */
        }
        return original(blob);
      };
      window.__auraTapInstalled = true;
    }
  });
}

async function readLastDownload() {
  return page.evaluate(async () => {
    const blob = window.__auraDownloads && window.__auraDownloads[window.__auraDownloads.length - 1];
    if (!blob) return null;
    const content = await blob.text();
    return { type: blob.type, content };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 1440, height: 1000 });

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  try {
    // ---------------------------------------------------------------- boot
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await sleep(600);
    assert('gateway renders', (await bodyText()).includes('Guided walkthrough'));
    await dismissGateway();
    await installDownloadTap();

    // ------------------------------------------------------- dataset switch
    const visualBody = await bodyText();
    await clickText(/Privacy breach/i, { wait: 700 });
    const privacyBody = await bodyText();
    assert(
      'dataset B switches the scenario',
      privacyBody !== visualBody && /privacy/i.test(privacyBody),
      'privacy dataset active',
    );
    const activeDataset = await page.$eval('.dataset-switch-item.is-active', (el) =>
      (el.textContent || '').replace(/\s+/g, ' ').trim(),
    );
    assert('dataset B is selected in topbar', /B/.test(activeDataset), activeDataset);

    await clickText(/Visual crisis/i, { wait: 700 });
    const backBody = await bodyText();
    assert('dataset A restores', backBody !== privacyBody, 'visual dataset active');

    // ------------------------------------------------------------- arbiter
    await goto('command');
    const readFallbacks = () =>
      page.$$eval('.arbiter-gauge-foot span', (spans) => {
        const match = (spans[1]?.textContent || '').match(/(\d+) FALLBACKS/);
        return match ? Number(match[1]) : -1;
      });
    const nominalConfidence = await text('.arbiter-gauge-top strong');
    const nominalFallbacks = await readFallbacks();
    assert('arbiter renders a fused confidence gauge', Boolean(nominalConfidence), nominalConfidence || '');
    assert(
      'arbiter starts with a coherent routing table',
      nominalFallbacks >= 0 && (await page.$$('.arbiter-lane:not(.arbiter-lane--head)')).length === 4,
      `${nominalFallbacks} nominal fallbacks`,
    );

    await clickText(/Simulate <0\.85 Edge Case/i, { wait: 600 });
    const stressedConfidence = await text('.arbiter-gauge-top strong');
    const fallbackCount = await readFallbacks();
    assert(
      'stress mode depresses fused confidence',
      Number.parseFloat(stressedConfidence || '0') < Number.parseFloat(nominalConfidence || '0'),
      `${nominalConfidence} → ${stressedConfidence}`,
    );
    assert(
      'stress mode triggers more real fallbacks',
      fallbackCount > nominalFallbacks,
      `${nominalFallbacks} → ${fallbackCount} fallbacks`,
    );
    assert(
      'stress mode marks fallback lanes',
      (await page.$$('.arbiter-lane.is-fallback')).length === fallbackCount,
      `${fallbackCount} marked lanes`,
    );

    await clickText(/Reset to nominal/i, { wait: 500 });
    assert(
      'arbiter resets to nominal',
      (await readFallbacks()) === nominalFallbacks,
      `${await readFallbacks()} fallbacks`,
    );

    // -------------------------------------------------------------- visual
    await goto('visual');
    const readDrMetric = (index) =>
      page.$$eval('.dr-metric strong', (nodes, i) => (nodes[i]?.textContent || '').trim(), index);
    // Manual inspection first: disable autonomy so the drift stays on screen.
    await clickAria('Auto-quarantine', { wait: 300 });
    const baselineDelta = await readDrMetric(0);
    await clickText(/Inject Rogue Color Drift/i, { wait: 600 });
    const driftedDelta = await readDrMetric(0);
    assert(
      'rogue colour drift raises live ΔE2000',
      driftedDelta !== baselineDelta && Number(driftedDelta) > 2.5,
      `${baselineDelta} → ${driftedDelta}`,
    );
    assert(
      'drift resolves to a FAIL verdict',
      /FAIL/.test(await text('.dr-log')),
      'FAIL logged',
    );
    await clickText(/Auto-Quarantine & Revert DOM/i, { wait: 800 });
    const revertedDelta = await readDrMetric(0);
    assert(
      'quarantine reverts the DOM to baseline',
      Number(revertedDelta) <= 2.5,
      `ΔE back to ${revertedDelta}`,
    );

    await clickText(/Inject Unauthorized DOM Node/i, { wait: 600 });
    assert(
      'unauthorized DOM node is counted',
      Number(await readDrMetric(3)) > 0,
      `${await readDrMetric(3)} rogue node(s)`,
    );
    await clickText(/Auto-Quarantine & Revert DOM/i, { wait: 800 });
    assert(
      'quarantine removes the rogue node',
      Number(await readDrMetric(3)) === 0,
      'tree restored',
    );

    // Autonomy on: a FAIL reading should self-heal after the inspection hold.
    await clickAria('Auto-quarantine', { wait: 300 });
    await clickText(/Inject Rogue Color Drift/i, { wait: 500 });
    const autoDriftDelta = await readDrMetric(0);
    assert(
      'autonomous mode catches the drift before reverting',
      Number(autoDriftDelta) > 2.5,
      `ΔE ${autoDriftDelta}`,
    );
    await sleep(2400);
    assert(
      'autonomous quarantine self-heals the sandbox',
      Number(await readDrMetric(0)) <= 2.5,
      `ΔE back to ${await readDrMetric(0)}`,
    );
    assert(
      'auto-quarantine leaves a real event trail',
      /QUARANTINE/.test(await text('.dr-log')),
      'quarantine logged',
    );

    // ------------------------------------------------------------ temporal
    await goto('temporal');
    const publishBefore = await text('.tm-date');
    await clickText(/Advance \+14 days/i, { wait: 700 });
    const publishAfter = await text('.tm-date');
    assert('advance +14 moves the publish window', publishBefore !== publishAfter, `${publishBefore} → ${publishAfter}`);

    const blockedRow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.ledger-row')];
      const row = rows.find((r) => /BLOCKED/i.test(r.textContent || ''));
      if (!row) return null;
      row.click();
      return (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    });
    assert('a blocked claim is selectable', Boolean(blockedRow), blockedRow || '');
    await sleep(400);
    await clickText(/Quarantine claim/i, { wait: 700 });
    const overrideBody = await bodyText();
    assert('quarantine persists an operator override', /OVERRIDE QUARANTINED/.test(overrideBody), 'override visible');
    const gateAfter = await text('.tm-gate');
    assert('quarantined claim holds the publication gate', gateAfter === 'GATE HELD', gateAfter || '');

    await installDownloadTap();
    await clickText(/Export ledger/i, { wait: 600 });
    const temporalDownload = await readLastDownload();
    let temporalJson = null;
    try {
      temporalJson = JSON.parse(temporalDownload?.content || 'null');
    } catch {
      temporalJson = null;
    }
    assert(
      'temporal ledger exports real JSON',
      temporalJson?.schema === 'aura-gov/temporal-ledger/v2' && Object.keys(temporalJson.overrides || {}).length > 0,
      temporalJson ? `${temporalJson.claims.length} claims, override recorded` : 'no payload',
    );

    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(700);
    await dismissGateway();
    await sleep(400);
    assert(
      'temporal override survives reload',
      /OVERRIDE QUARANTINED/.test(await bodyText()),
      'localStorage persistence',
    );
    const reselected = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.ledger-row')].find((r) =>
        /OVERRIDE QUARANTINED/i.test(r.textContent || ''),
      );
      if (!row) return false;
      row.click();
      return true;
    });
    assert('overridden claim can be re-selected', reselected, 'row selected');
    await sleep(400);
    await clickText(/Reset override/i, { wait: 700 });
    assert(
      'reset clears the persisted override',
      !/OVERRIDE QUARANTINED/.test(await bodyText()),
      'override removed',
    );

    // --------------------------------------------------------------- voice
    await goto('voice');
    assert('voice starts staged', /STAGED/.test(await bodyText()), 'patch ledger staged');
    await clickText(/Authorize patch/i, { wait: 700 });
    const voiceBody = await bodyText();
    assert('authorize commits the surgical patch', /Patch committed/i.test(voiceBody), 'committed state');
    assert('commit records a UTC timestamp', /COMMITTED .* UTC/i.test(voiceBody), 'timestamp rendered');

    await installDownloadTap();
    await clickText(/Export diff/i, { wait: 600 });
    const voiceDownload = await readLastDownload();
    let voiceJson = null;
    try {
      voiceJson = JSON.parse(voiceDownload?.content || 'null');
    } catch {
      voiceJson = null;
    }
    assert(
      'voice diff exports real JSON',
      voiceJson?.schema === 'aura-gov/voice-diff/v2' &&
        Array.isArray(voiceJson.patches) &&
        voiceJson.patches.length > 0 &&
        /^[0-9a-f]{64}$/.test(voiceJson.fingerprint || ''),
      voiceJson ? `${voiceJson.patches.length} patches, fingerprint ${String(voiceJson.fingerprint).slice(0, 12)}…` : 'no payload',
    );

    // ------------------------------------------------------------- airlock
    await goto('airlock');
    const defaultVaultState = await text('.vault-state');
    const defaultMasked = await text('.egress-stats strong');
    const tenantCount = (await page.$$('.vault-tenant')).length;
    assert('vault lists multiple tenants', tenantCount >= 3, `${tenantCount} tenants`);

    const secondTenant = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.vault-tenant')];
      const tab = tabs[1];
      if (!tab) return null;
      tab.click();
      return (tab.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    });
    assert('tenant switch is available', Boolean(secondTenant), secondTenant || '');
    await sleep(700);
    const switchedVaultState = await text('.vault-state');
    const switchedMasked = await text('.egress-stats strong');
    assert(
      'tenant policy changes the redaction outcome',
      switchedMasked !== defaultMasked || switchedVaultState !== defaultVaultState,
      `masked ${defaultMasked} → ${switchedMasked}`,
    );

    await clickText(/Revoke tokens/i, { wait: 600 });
    const revokedState = await text('.vault-state');
    assert('revoke locks every token', /REVOKED/.test(revokedState || ''), revokedState || '');
    const reissueVisible = await clickText(/Re-issue fresh tokens/i, { wait: 700, optional: true });
    assert('re-issue restores tokens', Boolean(reissueVisible), 're-issued');
    const reissuedState = await text('.vault-state');
    assert('re-issued tokens carry a live TTL', /TTL \d+:\d\d/.test(reissuedState || ''), reissuedState || '');

    await clickText(/Tamper test/i, { wait: 700 });
    const tamperedBody = await bodyText();
    assert('tamper test breaks the SHA-256 chain', /Verify chain \(broken\)/i.test(tamperedBody), 'chain broken');
    await clickText(/Verify chain/i, { wait: 500 });
    assert(
      'verify reports the break instead of hiding it',
      /Verify chain \(broken\)/i.test(await bodyText()),
      'verification honest',
    );
    await clickText(/Reset ledger/i, { wait: 700 });
    assert(
      'ledger reset restores an intact chain',
      /Verify chain \(intact\)/i.test(await bodyText()),
      'chain intact',
    );

    await installDownloadTap();
    await clickText(/Audit trail/i, { wait: 600 });
    const auditDownload = await readLastDownload();
    let auditJson = null;
    try {
      auditJson = JSON.parse(auditDownload?.content || 'null');
    } catch {
      auditJson = null;
    }
    assert(
      'audit trail exports real receipts',
      auditJson?.schema === 'aura-gov/vault-audit/v2' &&
        Array.isArray(auditJson.ledger?.receipts) &&
        auditJson.ledger.receipts.length >= 2 &&
        auditJson.ledger.chainIntact === true,
      auditJson ? `${auditJson.ledger.receipts.length} receipts, chain intact` : 'no payload',
    );

    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(700);
    await dismissGateway();
    await sleep(500);
    const persistedReceipts = await text('.vault-ledger-label');
    assert(
      'ledger survives reload',
      /[2-9]\d* RECEIPTS/.test(persistedReceipts || ''),
      persistedReceipts || '',
    );

    // ------------------------------------------------------ command palette
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyK');
    await page.keyboard.up('Control');
    await sleep(450);
    assert('command palette opens with Ctrl+K', (await page.$('.palette, .command-palette, [role="dialog"]')) !== null, 'palette open');

    await page.keyboard.type('temporal', { delay: 25 });
    await sleep(400);
    await page.keyboard.press('Enter');
    await sleep(700);
    assert(
      'palette jumps to the temporal screen',
      /Claims that know when they expire/i.test(await bodyText()),
      'navigated',
    );

    // ----------------------------------------------------------- deep links
    // A fresh document load must honour the hash even after the gateway is
    // bypassed (this used to snap back to the command deck).
    await page.goto('about:blank');
    await page.goto(`${BASE}/#/airlock`, { waitUntil: 'networkidle0' });
    await sleep(700);
    await dismissGateway();
    await sleep(400);
    assert(
      'deep link to the vault survives the gateway',
      /Nothing leaves without a clearance/i.test(await bodyText()),
      page.url(),
    );
    await page.goto('about:blank');
    await page.goto(`${BASE}/#/voice`, { waitUntil: 'networkidle0' });
    await sleep(700);
    await dismissGateway();
    await sleep(400);
    assert(
      'deep link to Voice DNA survives the gateway',
      /Fix the violation\. Keep the voice\./i.test(await bodyText()),
      page.url(),
    );

    // ------------------------------------------------------------- wrap up
    assert('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    assert('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

    const passed = results.filter((r) => r.ok).length;
    console.log(`\nOK · ${passed}/${results.length} interactive checks passed`);
  } catch (error) {
    console.log(`\nABORTED · ${error.message}`);
    if (consoleErrors.length) console.log(`console errors: ${consoleErrors.slice(0, 5).join(' | ')}`);
    if (pageErrors.length) console.log(`page errors: ${pageErrors.slice(0, 5).join(' | ')}`);
    await page.screenshot({ path: 'scripts/screens/e2e-failure.png', fullPage: false }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
