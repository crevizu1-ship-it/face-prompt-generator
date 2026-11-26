const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile, mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const site = process.env.TEST_SITE_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const framing = ['face close-up', 'waist-up'];
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
  if (site.startsWith('file:')) {
    await page.context().setOffline(true);
    const networkRequests = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) networkRequests.push(request.url()); });
    t.after(() => assert.deepEqual(networkRequests, []));
  }
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
const model = (page, name) => page.getByRole('checkbox', {name, exact:true});
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
  assert.equal(rows.filter(row => row.includes('neutral expression')).length, 16);
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
    assert.equal(rows.filter(row => row.includes('neutral expression')).length, 6);
  }
});

test('all 40 backgrounds use their own environment, with varied compatible outdoor scenes', async t => {
  const page = await openPage(t);
  await model(page, 'Stable Diffusion XL').check();
  await model(page, 'Midjourney').uncheck();
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
      const scene = row.split('blurred sandy beach, ')[1].split('natural skin texture')[0];
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
    for (const part of ['long straight hair', 'front view, head upright', 'plain white crew-neck T-shirt', 'subtle closed-mouth smile']) assert.ok(row.includes(part));
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

test('copy checkmarks track the copied scene and model, bulk selection, and new batches', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async () => {}}}));
  const buttons = page.locator('.copy'), bulk = page.locator('#copyAll');
  await buttons.first().click();
  assert.match(await buttons.first().innerText(), /✓/);
  assert.doesNotMatch(await buttons.nth(1).innerText(), /✓/);
  await model(page, 'GPT Image').check();
  assert.match(await buttons.first().innerText(), /✓/);
  assert.doesNotMatch(await buttons.nth(1).innerText(), /✓/);
  await bulk.click();
  assert.match(await bulk.innerText(), /✓/);
  assert.ok((await buttons.allTextContents()).every(label => label.includes('✓')));
  await model(page, 'FLUX.2').check();
  assert.doesNotMatch(await bulk.innerText(), /✓/);
  assert.doesNotMatch(await buttons.nth(2).innerText(), /✓/);
  await generate(page);
  assert.ok((await buttons.allTextContents()).every(label => !label.includes('✓')));
});

test('denied copy stays unmarked, fallback success is marked and late success cannot mark a new batch', async t => {
  const page = await openPage(t);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {value:{writeText:async () => { throw Error('Denied'); }}, configurable:true});
    document.execCommand = () => false;
  });
  const button = page.locator('.copy').first();
  await button.click();
  assert.doesNotMatch(await button.innerText(), /✓/);
  assert.match(await page.locator('#status').innerText(), /복사가 제한/);
  await page.evaluate(() => { document.execCommand = () => true; });
  await button.click();
  assert.match(await button.innerText(), /✓/);
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => new Promise(resolve => { window.finishCopy = resolve; });
  });
  await page.locator('#copyAll').click();
  await generate(page);
  await page.evaluate(() => window.finishCopy());
  assert.doesNotMatch(await button.innerText(), /✓/);
  assert.doesNotMatch(await page.locator('#copyAll').innerText(), /✓/);
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

test('Midjourney clipboard bundles expand to exactly the original scenes for each plan', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: async text => { window.copiedText = text; }}
  }));
  await page.locator('#count').fill('41');
  await page.locator('.advanced summary').click();
  await page.locator('#prefix').fill('editorial, natural');
  await page.locator('#params').fill('--ar 4:5 --raw');
  for (const limit of [4, 10, 40]) {
    await generate(page);
    await page.locator('#mjCopyMode').selectOption(String(limit));
    const rows = await prompts(page);
    await page.locator('#params').fill('--other'); // unsaved edits must not affect the existing batch
    for (let i = 0; i < rows.length; i += limit) {
      await page.locator('#mjNext').click();
      const clipboard = await page.evaluate(() => window.copiedText);
      const expected = rows.slice(i, i + limit);
      if (expected.length === 1) {
        assert.equal(clipboard, expected[0]);
      } else {
        const match = clipboard.match(/^\{(.+)\} (--ar 4:5 --raw)$/);
        assert.ok(match, clipboard);
        const decoded = match[1].split(/(?<!\\), /).map(body => body.replaceAll('\\,', ',') + ' ' + match[2]);
        assert.deepEqual(decoded, expected);
      }
    }
    assert.ok(await page.locator('#mjNext').isDisabled());
    assert.equal((await page.locator('.copy.copied').count()), 41);
    await page.locator('#params').fill('--ar 4:5 --raw');
  }
});

test('next uncopied skips previously copied scenes, supports Relax and retains position on failure', async t => {
  const page = await openPage(t);
  await page.locator('#count').fill('6');
  await generate(page);
  const rows = await prompts(page);
  await page.evaluate(() => {
    window.deny = false;
    Object.defineProperty(navigator, 'clipboard', {value:{writeText: async text => {
      if (window.deny) throw Error('Denied');
      window.copiedText = text;
    }}});
    document.execCommand = () => false;
  });
  await page.locator('.copy').nth(1).click();
  await page.locator('#mjCopyMode').selectOption('1');
  await page.locator('#mjNext').click();
  assert.equal(await page.evaluate(() => window.copiedText), rows[0]);
  await page.evaluate(() => { window.deny = true; });
  await page.locator('#mjNext').click();
  assert.equal(await page.locator('.copy.copied').count(), 2);
  await page.evaluate(() => { window.deny = false; });
  await page.locator('#mjNext').click();
  assert.equal(await page.evaluate(() => window.copiedText), rows[2]);
  await model(page, 'GPT Image').check();
  await model(page, 'Midjourney').uncheck();
  assert.equal(await page.locator('#mjNext').isVisible(), false);
  await model(page, 'Midjourney').check();
  await page.locator('#mjCopyMode').selectOption('4');
  await page.locator('#mjNext').click();
  assert.equal(await page.locator('.copy.copied').count(), 6);
  assert.ok(await page.locator('#mjNext').isDisabled());
});

test('custom Midjourney permutations or repeat flags remain available as individual prompts', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async text => { window.copiedText = text; }}}));
  await page.locator('.advanced summary').click();
  for (const params of ['--ar {1:1,4:5}', '--repeat 2', '--relax']) {
    await page.locator('#params').fill(params);
    await generate(page);
    await page.locator('#mjCopyMode').selectOption('10');
    await page.locator('#mjNext').click();
    assert.equal(await page.evaluate(() => window.copiedText), (await prompts(page))[0]);
    assert.equal(await page.locator('.copy.copied').count(), 1);
  }
});

test('five model formats share the current scene, work offline and export by model', async t => {
  const page = await openPage(t);
  await page.context().setOffline(true);
  await page.locator('#count').fill('2');
  await selectOnly(page, 0, 0);
  await selectOnly(page, 2, 3);
  await selectOnly(page, 4, 33);
  await page.locator('#ratio').fill('100');
  await generate(page);
  const firstPass = await prompts(page);
  const tags = await page.locator('.tagline').allTextContents();
  const models = ['Midjourney', 'GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL'];
  for (const name of models.slice(1)) await model(page, name).check();
  assert.deepEqual(await page.locator('.tagline').allTextContents(), tags);
  const rows = page.locator('.result-row');
  assert.equal(await rows.count(), 2);
  const exported = [];
  for (let i = 0; i < 2; i++) {
    const row = rows.nth(i);
    assert.deepEqual(await row.locator('.model-name').allTextContents(), models);
    const texts = await row.locator('.prompt').allTextContents();
    assert.equal(texts[0], firstPass[i]);
    assert.equal(new Set(texts).size, 5);
    for (const [j, text] of texts.entries()) {
      assert.match(text, /long straight hair/i);
      assert.match(text, /navy (?:blue )?T-shirt/i);
      assert.match(text, /beach/i);
      assert.match(text, /neutral/i);
      assert.equal(text.includes('--raw'), j === 0);
      exported.push('[' + String(i + 1).padStart(2,'0') + ' · ' + models[j] + ']\n' + text);
    }
    const before = texts[4].split(/\s+/).length;
    assert.ok(texts[0].split(' --')[0].split(/\s+/).length < before);
  }
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: async value => { window.copiedText = value; }}
  }));
  await rows.first().locator('.copy').nth(2).click();
  assert.equal(await page.evaluate(() => window.copiedText), await rows.first().locator('.prompt').nth(2).innerText());
  await page.locator('#copyAll').click();
  assert.equal(await page.evaluate(() => window.copiedText), exported.join('\n\n'));
  const event = page.waitForEvent('download');
  await page.locator('#save').click();
  assert.equal(await readFile(await (await event).path(), 'utf8'), exported.join('\n\n'));
  for (const name of models) await model(page, name).uncheck();
  assert.equal((await prompts(page)).length, 0);
  assert.ok(await page.locator('#copyAll').isDisabled());
  await model(page, 'Midjourney').check();
  assert.deepEqual(await prompts(page), firstPass);
});

test('model formats preserve custom text and omit unselected environment fields', async t => {
  const page = await openPage(t);
  for (const name of ['GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL']) await model(page, name).check();
  await page.locator('#count').fill('1');
  await selectOnly(page, 4);
  await page.locator('.advanced summary').click();
  const prefix = 'Use this exact visual style: ' + 'delicate detail '.repeat(20) + 'from the reference.';
  await page.locator('#prefix').fill(prefix);
  await page.locator('#suffix').fill('Keep the tiny freckle.');
  await page.locator('#params').fill('--ar 4:5');
  await generate(page);
  const texts = await prompts(page);
  assert.equal(texts.length, 5);
  for (const [i, text] of texts.entries()) {
    assert.ok(text.includes(prefix));
    assert.ok(text.includes('Keep the tiny freckle.'));
    assert.equal(text.includes('--ar 4:5'), i === 0);
    assert.doesNotMatch(text, /undefined|null|backdrop|setting:|outside the window|studio lighting/i);
  }
});

test('the downloadable HTML starts by itself offline and formats all five models', async t => {
  const page = await openPage(t);
  const downloadEvent = page.waitForEvent('download', {timeout: 5000});
  const [download] = await Promise.all([downloadEvent, page.getByRole('link', {name:'오프라인용 HTML 저장'}).click()]);
  const dir = await mkdtemp(path.join(tmpdir(), 'face-prompts-'));
  t.after(() => rm(dir, {force:true, recursive:true}));
  const filename = path.join(dir, 'offline.html');
  await download.saveAs(filename);
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(filename).href);
  for (const name of ['GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL']) await model(page, name).check();
  await page.locator('#count').fill('200');
  await generate(page);
  assert.equal(await page.locator('.result-row').count(), 200);
  assert.equal((await prompts(page)).length, 1000);
});
