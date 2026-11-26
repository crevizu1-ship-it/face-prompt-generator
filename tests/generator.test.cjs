const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const site = process.env.TEST_SITE_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const framing = ['face close-up portrait', 'waist-up portrait'];
const weather = /\b(?:clear|partly cloudy|overcast) skies\b|light rain outside the window/;
const time = /\b(?:morning|daytime|late afternoon|golden hour|early evening)\b/;
const lighting = /\b(?:light|lighting)\b(?! rain)/;
let browser;

before(async () => {
  browser = await chromium.launch({ channel: process.env.TEST_BROWSER || 'chrome' });
});
after(async () => { await browser?.close(); });

async function openPage(t) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  t.after(() => page.context().close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.addInitScript(() => {
    let seed = 1234;
    Math.random = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
  });
  await page.goto(site);
  await page.locator('.prompt').first().waitFor();
  return page;
}

const prompts = page => page.locator('.prompt').allTextContents();
const generate = page => page.locator('#generate').click();
const bucket = (page, index) => page.locator('#libraries details').nth(index);
async function selectOnly(page, index, choice) {
  const group = bucket(page, index);
  await group.locator('summary').evaluate(summary => { summary.parentElement.open = true; });
  await group.getByRole('button', { name: '전체 해제' }).click();
  if (choice !== undefined) await group.locator('.choice input').nth(choice).check();
}

test('first batch has 16 neutral expressions and 14 face close-ups in 20 prompts', async t => {
  const page = await openPage(t);
  const rows = await prompts(page);
  assert.equal(rows.length, 20);
  assert.equal(rows.filter(row => row.includes('neutral facial expression')).length, 16);
  assert.equal(rows.filter(row => row.includes(framing[0])).length, 14);
  assert.equal(rows.filter(row => row.includes(framing[1])).length, 6);
  for (const row of rows) assert.doesNotMatch(row, /head-and-shoulders|soft even lighting/);
  assert.match(await page.locator('#frameEstimate').innerText(), /14개.*6개/);
});

test('framing ratios round per batch, show estimates, and allow either framing alone', async t => {
  const page = await openPage(t);
  await page.locator('#count').fill('7');
  for (const [ratio, close] of [[0, 0], [35, 2], [50, 4], [100, 7]]) {
    await page.locator('#frameRatio').fill(String(ratio));
    assert.match(await page.locator('#frameEstimate').innerText(), new RegExp(close + '개.*' + (7-close) + '개'));
    await generate(page);
    const rows = await prompts(page);
    assert.equal(rows.length, 7);
    assert.equal(rows.filter(row => row.includes(framing[0])).length, close);
    assert.equal(rows.filter(row => row.includes(framing[1])).length, 7-close);
    assert.equal(rows.filter(row => row.includes('neutral facial expression')).length, 6);
  }
});

test('all 40 backgrounds use their own environment, with varied compatible outdoor scenes', async t => {
  const page = await openPage(t);
  await page.locator('#count').fill('200');
  await generate(page);
  const samples = await prompts(page);
  const backgrounds = await bucket(page, 4).locator('.choice small').allTextContents();
  assert.equal(backgrounds.length, 40);
  for (const [i, bg] of backgrounds.entries()) {
    const rows = samples.filter(row => row.includes(bg + ','));
    assert.equal(rows.length, 5, bg);
    for (const text of rows) {
      const scene = text.split(bg + ', ')[1].split(', natural skin texture')[0];
      assert.match(scene, lighting, bg);
      assert.equal(weather.test(scene), i >= 28 || i === 19, bg);
      assert.equal(time.test(scene), i >= 14, bg);
      if (i === 19) assert.match(scene, /outside the window/);
      if (/golden hour/.test(scene)) assert.match(scene, /clear skies.*warm/i);
      if (/overcast skies/.test(scene)) assert.match(scene, /diffused|low-contrast/);
      assert.doesNotMatch(scene, /backlight|silhouette|harsh|fog|storm|blizzard|downpour|neon|pitch.dark/i);
    }
    if (i >= 28) assert.ok(new Set(rows.map(row => row.split(bg + ', ')[1])).size > 1, bg);
  }
});

test('all eight independent switch settings reach the rendered prompt', async t => {
  const page = await openPage(t);
  await selectOnly(page, 4, 33); // beach
  for (let mask = 0; mask < 8; mask++) {
    for (const [bit, id] of ['useWeather', 'useTime', 'useLighting'].entries()) {
      await page.locator('#' + id).setChecked(Boolean(mask & (1 << bit)));
    }
    await generate(page);
    const tags = await page.locator('.derived').allTextContents();
    assert.equal(tags.length, mask ? 20 : 0);
    for (const tag of tags) {
      assert.equal(tag.split(' · ').length, [1, 2, 4].filter(bit => mask & bit).length);
    }
    for (const row of await prompts(page)) {
      const scene = row.split('softly blurred sandy beach, ')[1].split('natural skin texture')[0];
      assert.equal(weather.test(scene), Boolean(mask & 1));
      assert.equal(time.test(scene), Boolean(mask & 2));
      assert.equal(lighting.test(scene), Boolean(mask & 4));
    }
  }
});

test('existing style choices, empty background, count limits and expression validation', async t => {
  const page = await openPage(t);
  const selected = await page.locator('#libraries details').evaluateAll(groups => groups.map(g => g.querySelectorAll(':checked').length));
  assert.deepEqual(selected, [65, 34, 60, 20, 40]);
  for (let i = 0; i < 4; i++) await selectOnly(page, i, 0);
  await selectOnly(page, 4);
  await page.locator('#ratio').fill('0');
  await page.locator('[data-count="30"]').click();
  await generate(page);
  const rows = await prompts(page);
  assert.equal(rows.length, 30);
  for (const row of rows) {
    for (const part of ['long straight hair', 'straight-on front view', 'plain white crew-neck T-shirt', 'very subtle closed-mouth smile']) assert.ok(row.includes(part));
    assert.doesNotMatch(row, weather);
    assert.doesNotMatch(row, time);
    assert.doesNotMatch(row, lighting);
    assert.doesNotMatch(row, /background|backdrop|undefined|, ,/);
  }
  assert.match(await page.locator('.tagline').first().innerText(), /배경 미지정/);
  await selectOnly(page, 3);
  await generate(page);
  assert.match(await page.locator('#status').innerText(), /하나 이상/);
  await page.locator('#ratio').fill('100');
  for (const [input, expected] of [['201', 200], ['0', 1]]) {
    await page.locator('#count').fill(input);
    await generate(page);
    assert.equal((await prompts(page)).length, expected);
    assert.equal(await page.locator('#status').innerText(), '');
  }
  await selectOnly(page, 0);
  await generate(page);
  assert.match(await page.locator('#status').innerText(), /하나 이상/);
  await bucket(page, 0).getByRole('button', {name: '전체 선택'}).click();
  assert.equal(await bucket(page, 0).locator(':checked').count(), 65);
});

test('custom fields, single and bulk copy, and the TXT download use the displayed text', async t => {
  const page = await openPage(t);
  await page.locator('.advanced summary').click();
  await page.locator('#prefix').fill('custom portrait');
  await page.locator('#suffix').fill('custom detail');
  await page.locator('#params').fill('--ar 4:5');
  await generate(page);
  const rows = await prompts(page);
  assert.ok(rows.every(row => row.startsWith('custom portrait, ') && row.endsWith('custom detail --ar 4:5')));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: async value => { window.copiedText = value; }}
  }));
  await page.locator('.copy').first().click();
  assert.equal(await page.evaluate(() => window.copiedText), rows[0]);
  await page.locator('#copyAll').click();
  assert.equal(await page.evaluate(() => window.copiedText), rows.join('\n\n'));
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#save').click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'face-prompts.txt');
  assert.equal(await readFile(await download.path(), 'utf8'), rows.join('\n\n'));
});

test('controls and results fit mobile and desktop in both color schemes', async t => {
  const page = await openPage(t);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({width, height: 800});
    for (const colorScheme of ['dark', 'light']) {
      await page.emulateMedia({colorScheme});
      await page.locator('#frameRatio').focus();
      await page.keyboard.press('End');
      await generate(page);
      assert.equal(await page.locator('#frameRatio').inputValue(), '100');
      assert.equal((await prompts(page)).filter(row => row.includes(framing[0])).length, 20);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  }
});
