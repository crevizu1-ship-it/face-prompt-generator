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

test('recommended generation uses the reference and balanced views across all five models', async t => {
  const page = await openPage(t);
  for (const name of ['GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL']) await model(page, name).check();
  await page.locator('#mjCopyMode').selectOption('40');
  await selectOnly(page, 0);
  await selectOnly(page, 5, 0);
  await page.locator('#recommend').click();
  assert.equal(await page.locator('.result-row').count(), 40);
  assert.match(await page.locator('#info').innerText(), /무표정 32개.*얼굴 클로즈업 28개/);
  assert.deepEqual((await page.locator('#directionSummary').innerText()).match(/\d+개/g), Array(5).fill('8개'));
  const rows = await page.locator('.result-row').evaluateAll(elements => elements.map(row => ({
    tag: row.querySelector('.tagline').textContent,
    texts: Array.from(row.querySelectorAll('.prompt'), element => element.textContent),
  })));
  for (const {tag, texts} of rows) {
    assert.match(tag, /참조 헤어 유지/);
    assert.equal(texts.length, 5);
    for (const text of texts) {
      assert.match(text, /same face and hairstyle as the reference image/i);
      assert.doesNotMatch(text, /undefined|null|with\s+wearing|,\s*,/);
      assert.equal(text.includes('relaxed shoulders'), tag.startsWith('상반신'));
    }
  }
  assert.equal(await page.locator('#mjReference').isVisible(), true);
  await model(page, 'Midjourney').uncheck();
  assert.equal(await page.locator('#mjReference').isVisible(), false);
  assert.equal(await page.locator('#referenceHelp').isVisible(), true);
});

test('recommended append fills missing selected directions and random generation restores selected hair', async t => {
  const page = await openPage(t);
  await selectOnly(page, 0, 0);
  await selectOnly(page, 1, 0);
  await page.locator('#count').fill('4');
  await page.locator('#recommend').click();
  const first = await prompts(page);
  assert.ok(first.every(text => text.includes('front view')));
  const angles = bucket(page, 1);
  await angles.locator('.choice input').nth(3).check();
  await angles.locator('.choice input').nth(8).check();
  await page.locator('#appendCount').fill('2');
  await page.locator('#append').click();
  const all = await prompts(page);
  assert.deepEqual(all.slice(0, 4), first);
  assert.ok(all.slice(4).some(text => text.includes('left 3/4 view')));
  assert.ok(all.slice(4).some(text => text.includes('full right side profile')));
  assert.match(await page.locator('#directionSummary').innerText(), /정면 4개.*왼쪽 사선 1개.*오른쪽 사선 0개.*왼쪽 옆얼굴 0개.*오른쪽 옆얼굴 1개/);
  await generate(page);
  assert.equal(await page.locator('#referenceHelp').isVisible(), false);
  assert.ok((await prompts(page)).every(text => text.includes('long straight hair') && !text.includes('reference image')));
  await page.locator('#append').click();
  assert.ok((await prompts(page)).every(text => text.includes('long straight hair')));
});

test('model, plan and scene count appear between the style library and generate button on both layouts', async t => {
  const page = await openPage(t);
  assert.deepEqual(await page.locator('main h2').allTextContents(), [
    '01 · 생성 설정', '02 · 스타일 라이브러리', '03 · 생성 모델', '04 · 생성 결과',
  ]);
  for (const width of [390, 1280]) {
    await page.setViewportSize({width, height:800});
    const selectors = ['#libraries', '#models', '#mjCopyMode', '#count', '#generate', '.result-head', '#mjNext', '#results'];
    let previousBottom = 0;
    for (const selector of selectors) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box && box.y >= previousBottom - 1, selector + ' at width ' + width);
      previousBottom = box.y + box.height;
    }
  }
});

test('Pro/Mega sizes new and appended batches in units of forty without altering existing scenes', async t => {
  const page = await openPage(t);
  const count = page.locator('#count'), appendCount = page.locator('#appendCount');
  const initial = await prompts(page);
  await page.locator('#mjCopyMode').selectOption('40');
  assert.deepEqual(await prompts(page), initial);
  for (const input of [count, appendCount]) {
    assert.equal(await input.inputValue(), '40');
    assert.equal(await input.getAttribute('step'), '40');
    assert.equal(await input.getAttribute('min'), '40');
  }
  assert.deepEqual(await page.locator('[data-count]').allTextContents(), ['40', '80', '120', '160', '200']);
  assert.match(await page.locator('#estimate').innerText(), /무표정 32개/);
  await page.locator('[data-count="120"]').click();
  assert.equal(await count.inputValue(), '120');
  await count.fill('41');
  await generate(page);
  assert.equal(await count.inputValue(), '80');
  assert.equal((await prompts(page)).length, 80);
  assert.match(await page.locator('#info').innerText(), /무표정 64개.*클로즈업 56개/);
  await appendCount.fill('9');
  await page.locator('#append').click();
  assert.equal(await appendCount.inputValue(), '40');
  assert.equal((await prompts(page)).length, 120);
  await count.fill('201');
  await generate(page);
  assert.equal((await prompts(page)).length, 200);
  await model(page, 'GPT Image').check();
  await model(page, 'Midjourney').uncheck();
  assert.equal(await page.locator('#mjCopyMode').isVisible(), false);
  assert.deepEqual(await page.locator('[data-count]').allTextContents(), ['10', '30', '50', '100']);
  await count.fill('7');
  await generate(page);
  assert.equal((await prompts(page)).length, 7);
  await model(page, 'Midjourney').check();
  assert.equal(await count.inputValue(), '40');
  await page.locator('#mjCopyMode').selectOption('10');
  await count.fill('11');
  await generate(page);
  assert.equal(await page.locator('.result-row').count(), 11);
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
  assert.deepEqual(selected, [65, 34, 60, 20, 40, 12]);
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

test('the chosen body pose follows the crop and matches across all five model prompts', async t => {
  const page = await openPage(t);
  const group = page.locator('#libraries details').filter({has:page.locator('summary', {hasText:'포즈'})});
  await group.locator('summary').click();
  await group.getByRole('button', {name:'전체 해제'}).click();
  const folded = group.getByRole('checkbox', {name:/가볍게 팔짱 끼기/});
  await folded.check();
  for (const name of ['GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL']) await model(page, name).check();
  await generate(page);
  const rows = page.locator('.result-row');
  const before = await prompts(page);
  for (let i = 0; i < 20; i++) {
    const tags = await rows.nth(i).locator('.tagline').innerText();
    const upper = tags.includes('상반신');
    assert.equal(tags.includes('가볍게 팔짱 끼기'), upper);
    assert.ok(before.slice(i * 5, i * 5 + 5).every(text => text.toLowerCase().includes('arms loosely folded') === upper));
  }
  await folded.uncheck();
  await group.getByRole('checkbox', {name:/어깨에 힘 빼기/}).check();
  await page.locator('#appendCount').fill('4');
  await page.locator('#append').click();
  const appended = await prompts(page);
  assert.deepEqual(appended.slice(0, 100), before);
  assert.equal(appended.length, 120);
  assert.ok(appended.slice(100).every(text => /relaxed shoulders/i.test(text)));
  await group.getByRole('button', {name:'전체 해제'}).click();
  await generate(page);
  assert.deepEqual(await rows.count(), 20);
  assert.ok((await prompts(page)).every(text => !/relaxed shoulders|arms loosely folded|undefined|null/i.test(text)));
  assert.equal(await page.locator('#status').innerText(), '');
  await group.getByRole('button', {name:'전체 선택'}).click();
  assert.equal(await group.locator(':checked').count(), 12);
});

test('all eligible poses are sampled evenly within each crop', async t => {
  const page = await openPage(t);
  const group = page.locator('#libraries details').filter({has:page.locator('summary', {hasText:'포즈'})});
  await group.locator('summary').click();
  const phrases = await group.locator('.choice small').allTextContents();
  for (const [ratio, poolSize] of [[100, 6], [0, 12]]) {
    await page.locator('#frameRatio').fill(String(ratio));
    await page.locator('#count').fill('24');
    await generate(page);
    const texts = await prompts(page);
    const hits = phrases.map(phrase => texts.filter(text => text.includes(phrase)).length);
    assert.equal(hits.filter(count => count > 0).length, poolSize);
    assert.ok(hits.every(count => count === 0 || count === 24 / poolSize));
  }
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

test('append preserves rows and copy marks while adding current settings to totals and exports', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async text => { window.copiedText = text; }}}));
  const before = await prompts(page);
  await page.locator('#copyAll').click();
  await page.locator('#ratio').fill('0');
  await page.locator('#frameRatio').fill('100');
  await page.locator('.advanced summary').click();
  await page.locator('#prefix').fill('additional portrait');
  await page.locator('#appendCount').fill('3');
  await page.locator('#append').click();
  const after = await prompts(page);
  assert.equal(after.length, 23);
  assert.deepEqual(after.slice(0, 20), before);
  assert.ok(after.slice(20).every(text => text.startsWith('additional portrait, face close-up') && !text.includes('neutral expression')));
  assert.equal(await page.locator('.copy.copied').count(), 20);
  assert.doesNotMatch(await page.locator('#copyAll').innerText(), /✓/);
  assert.match(await page.locator('#info').innerText(), /장면 23개.*무표정 16개.*미세 표정 7개.*클로즈업 17개.*상반신 6개/);
  assert.equal(await page.locator('.result-row').last().locator(':scope > .muted').innerText(), '23');
  await model(page, 'FLUX.2').check();
  assert.equal((await prompts(page)).length, 46);
  await model(page, 'FLUX.2').uncheck();
  await page.locator('#copyAll').click();
  assert.equal(await page.evaluate(() => window.copiedText), after.join('\n\n'));
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#save').click();
  assert.equal(await readFile(await (await downloadEvent).path(), 'utf8'), after.join('\n\n'));
  await selectOnly(page, 0);
  await page.locator('#append').click();
  assert.deepEqual(await prompts(page), after);
  assert.match(await page.locator('#status').innerText(), /하나 이상/);
});

test('appended scenes keep their own Midjourney parameters and fresh generation replaces the list', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async text => { window.copiedText = text; }}}));
  await page.locator('#count').fill('2');
  await generate(page);
  await page.locator('.advanced summary').click();
  await page.locator('#params').fill('--ar 4:5');
  await page.locator('#appendCount').fill('3');
  await page.locator('#append').click();
  const rows = await prompts(page);
  for (const [indices, params] of [[[0, 1], '--raw --s 0 --c 0 --ar 1:1'], [[2, 3, 4], '--ar 4:5']]) {
    await page.locator('#mjNext').click();
    const clipboard = await page.evaluate(() => window.copiedText);
    const bodies = indices.map(i => rows[i].slice(0, -params.length - 1).replaceAll(',', '\\,'));
    assert.equal(clipboard, '{' + bodies.join(', ') + '} ' + params);
  }
  await page.locator('#appendCount').fill('200');
  await page.locator('#append').click();
  assert.equal(await page.locator('.result-row').count(), 205);
  await generate(page);
  assert.equal(await page.locator('.result-row').count(), 2);
  assert.equal(await page.locator('.copy.copied').count(), 0);
});

test('bulk copy started before append only marks the scenes actually copied', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:() => new Promise(resolve => { window.finishCopy = resolve; })}}));
  await page.locator('#copyAll').click();
  await page.locator('#appendCount').fill('1');
  await page.locator('#append').click();
  await page.evaluate(() => window.finishCopy());
  assert.equal(await page.locator('.copy.copied').count(), 20);
  assert.doesNotMatch(await page.locator('.copy').last().innerText(), /✓/);
  assert.doesNotMatch(await page.locator('#copyAll').innerText(), /✓/);
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
