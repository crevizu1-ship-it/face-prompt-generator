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
const lighting = /\b(?:light|lighting|softbox|ceiling bounce|diffuse window)\b(?! rain)/;
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
const promptLimits = [160, 460, 460, 400, 360, 360];
const model = (page, name) => page.getByRole('checkbox', {name, exact:true});
const bucket = (page, index) => page.locator('#libraries details').nth(index);
async function selectOnly(page, index, choice) {
  const group = bucket(page, index);
  await group.locator('summary').evaluate(summary => { summary.parentElement.open = true; });
  await group.getByRole('button', { name: '전체 해제' }).click();
  if (choice !== undefined) await group.locator('.choice input').nth(choice).check();
}

test('portrait essentials lead every model and oversize extras are omitted as whole instructions', async t => {
  const page = await openPage(t);
  for (const input of await page.locator('#models input').all()) await input.check();
  await page.locator('#count').fill('12');
  await page.locator('.advanced summary').click();
  await page.locator('#prefix').fill('OVERSIZE' + 'x'.repeat(1000));
  await page.locator('#suffix').fill('Preserve freckles.');
  await page.locator('#recommend').click();
  const rows = page.locator('.result-row');
  for (const row of await rows.all()) {
    for (const [i, prompt] of (await row.locator('.prompt').allTextContents()).entries()) {
      const body = prompt.split(' --')[0];
      assert.match(body.slice(0, 65), /ultra-realistic|photoreal/i);
      const identity = i === 0 ? /same (?:person|face)/i : i === 5 ? /selected character/i : /reference/i;
      assert.match(body.slice(0, 120), identity);
      assert.match(body, /natural skin/i);
      assert.match(body, i === 0 ? /face[,/] ?forehead.*brows clear/i : /entire face in frame/i);
      assert.match(body, /forehead.*brows/i);
      const label = await row.locator('.variant .small').nth(i).innerText();
      assert.match(label, /공통 추가 지시.*추가 촬영 조건/);
      if (i === 0) assert.doesNotMatch(label, /의상/);
      else assert.match(label, /의상/);
      assert.doesNotMatch(body, /OVERSIZE|xxxx|Preserve freckles|undefined|null/);
      assert.ok(body.length <= promptLimits[i], body);
    }
  }
});

test('Midjourney keeps the ordered prefix and cuts all items after the first overflow', async t => {
  const page = await openPage(t);
  await page.evaluate(() => { Math.random = () => 0.4; });
  await selectOnly(page, 0, 0);
  await selectOnly(page, 1, 0);
  await selectOnly(page, 2, 1);
  await selectOnly(page, 4, 33);
  await page.locator('#count').fill('1');
  await generate(page);
  const initial = (await prompts(page))[0].split(' --')[0];
  const coastalLight = ', even coastal light';
  assert.ok(initial.includes(coastalLight), initial);
  const essential = initial.slice(0, initial.indexOf(coastalLight) + coastalLight.length);
  assert.match(essential, /front view, black T-shirt/);
  assert.match(essential, /natural skin/);
  assert.match(essential, lighting);
  const custom = 'Custom detail '.padEnd(promptLimits[0] - essential.length - 2, 'x');
  await page.locator('.advanced summary').click();
  await page.locator('#prefix').fill(custom);
  await generate(page);
  assert.equal((await prompts(page))[0], essential + ', ' + custom + ' --raw --s 0');
  const label = await page.locator('.variant .small').innerText();
  assert.match(label, /본문 160자/);
  assert.match(label, /생략한 항목.*배경/);
  await page.locator('#prefix').fill(custom + 'x\nShort cue');
  await page.locator('#suffix').fill('Short detail');
  await generate(page);
  assert.equal((await prompts(page))[0], essential + ' --raw --s 0');
  assert.match(await page.locator('.variant .small').innerText(), /공통 추가 지시.*추가 촬영 조건.*배경.*시간대.*날씨/);
});

test('first batch makes Midjourney prompts for a Soul ID dataset', async t => {
  const page = await openPage(t);
  assert.equal(await page.getByLabel('학습 툴', {exact:true}).inputValue(), 'soul');
  assert.deepEqual(await page.locator('#models :checked').evaluateAll(inputs => inputs.map(input => input.value)), ['Midjourney']);
  assert.match(await page.locator('#listWorkflow').innerText(), /Midjourney.*Higgsfield Soul ID/);
  const rows = await prompts(page);
  assert.equal(rows.length, 20);
  for (const row of rows) {
    const body = row.replace(/ --raw --s 0$/, '');
    assert.ok(body.length <= promptLimits[0], body);
    assert.match(body, /^Photoreal(?:istic)?, same (?:person|face),/);
    assert.match(body, /natural skin.*face.*forehead.*brows/i);
  }
  assert.equal(rows.filter(row => /, neutral,/.test(row)).length, 16);
  assert.equal(rows.filter(row => /, (?:face )?close-up,/.test(row)).length, 13);
  assert.equal(rows.filter(row => row.includes(framing[1])).length, 6);
  assert.equal(rows.filter(row => /head-to-toe|full-body/.test(row)).length, 1);
  for (const row of rows) {
    assert.doesNotMatch(row, /Higgsfield|Soul ID|selected character|Train new character|head-and-shoulders|soft even lighting/i);
    assert.match(row, /same (?:person|face).*face[,/] ?forehead.*--raw --s 0$/);
  }
  assert.match(await page.locator('#frameEstimate').innerText(), /13개.*6개.*전신 1개/);
});

test('Midjourney keeps the selected clothing colors and types before optional instructions', async t => {
  const page = await openPage(t);
  await selectOnly(page, 1, 0); // front view
  await selectOnly(page, 2, 0); // white T-shirt
  await bucket(page, 2).locator('.choice input').nth(13).check(); // light blue shirt
  await page.locator('#count').fill('12');
  await page.locator('.advanced summary').click();
  await page.locator('#prefix').fill('Oversize detail '.repeat(100));
  await page.locator('#recommend').click();
  const bodies = (await prompts(page)).map(text => text.replace(/ --raw --s 0$/, ''));
  assert.equal(bodies.filter(body => /same (?:person|face), front view, white T-shirt,/.test(body)).length, 6);
  assert.equal(bodies.filter(body => /same (?:person|face), front view, light blue button-up(?: shirt)?,/.test(body)).length, 6);
  for (const body of bodies) {
    assert.ok(body.length <= promptLimits[0], body);
    assert.match(body, /natural skin/);
    assert.match(body, /face.*forehead.*brows/i);
    assert.doesNotMatch(body, /Oversize detail|\bblack\b/i);
  }
});

test('random and recommended Midjourney input copies contain no forced aspect ratio or chaos', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{
    writeText:async text => { window.copiedText = text; },
  }}));
  for (const button of ['#generate', '#recommend']) {
    await page.locator(button).click();
    const rows = await prompts(page);
    for (const row of rows) assert.doesNotMatch(row, /--(?:ar|aspect|c|chaos)\b/);
    await page.locator('.copy').first().click();
    assert.equal(await page.evaluate(() => window.copiedText), rows[0]);
    await page.locator('#mjNext').click();
    const bundle = await page.evaluate(() => window.copiedText);
    assert.match(bundle, /^\{.+\} --raw --s 0$/);
    assert.doesNotMatch(bundle, /--(?:ar|aspect|c|chaos)\b/);
  }
});

test('Clean empties a recommended list and keeps selections for a new numbered list', async t => {
  const page = await openPage(t);
  const change = page.locator('#listChange');
  assert.match(await change.innerText(), /목록 #1.*새로 생성/);
  await selectOnly(page, 0, 0);
  await model(page, 'GPT Image').check();
  await page.locator('#frameRatio').fill('100');
  await page.locator('#count').fill('3');
  await page.locator('#trainingTarget').selectOption('recommended');
  await page.locator('#recommend').click();
  assert.match(await change.innerText(), /목록 #2.*추천 장면 3개 새로 생성/);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async () => {}}}));
  await page.locator('#mjNext').click();
  assert.equal(await page.locator('.copy.copied').count(), 3);
  await page.locator('#appendCount').fill('2');
  await page.locator('#append').click();
  assert.match(await change.innerText(), /목록 #2.*4–5번 추가/);
  await page.getByRole('button', {name:/목록 비우기.*Clean/}).click();
  assert.equal(await page.locator('.result-row').count(), 0);
  assert.match(await change.innerText(), /목록을 비웠습니다/);
  assert.equal(await page.locator('#info').innerText(), '');
  assert.equal(await page.locator('#listWorkflow').innerText(), '');
  assert.equal(await page.locator('#trainingTarget').inputValue(), 'recommended');
  for (const id of ['clean', 'copyArchive', 'save', 'append']) assert.equal(await page.locator('#' + id).isDisabled(), true);
  for (const id of ['mjTools', 'referenceHelp']) assert.equal(await page.locator('#' + id).isVisible(), false);
  assert.equal(await page.locator('#inputTools').isVisible(), false);
  assert.equal(await page.locator('#appendCount').inputValue(), '2');
  assert.equal(await model(page, 'GPT Image').isChecked(), true);
  assert.equal(await bucket(page, 0).locator(':checked').count(), 1);
  await generate(page);
  assert.match(await change.innerText(), /목록 #3.*랜덤 장면 3개 새로 생성/);
  assert.equal(await page.locator('.result-row').first().locator(':scope > .muted').innerText(), '01');
  assert.equal(await page.locator('.copy.copied').count(), 0);
  assert.equal(await page.locator('.copy').count(), 6);
  assert.match(await page.locator('#info').innerText(), /얼굴 클로즈업 3개/);
});

test('a pending bundle copy cannot block or mark a new list after Clean', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{
    writeText:() => new Promise(resolve => { (window.pendingCopies ??= []).push(resolve); }),
  }}));
  await page.locator('#mjNext').click();
  await page.locator('#clean').click();
  await generate(page);
  await page.locator('#mjNext').click();
  await page.evaluate(() => window.pendingCopies[0]());
  assert.equal(await page.locator('#mjNext').isDisabled(), true);
  assert.equal(await page.locator('.copy.copied').count(), 0);
  await page.evaluate(() => window.pendingCopies[1]());
  assert.equal(await page.locator('.copy.copied').count(), 4);
});

test('Soul ID training reserves one uncropped full-height shot and keeps it when appending candidates', async t => {
  const page = await openPage(t);
  for (const input of await page.locator('#models input').all()) await input.check();
  await selectOnly(page, 0);
  await page.locator('#recommend').click();
  assert.match(await page.locator('#info').innerText(), /무표정 16개.*클로즈업 13개.*상반신 6개.*전신 1개/);
  assert.equal(await page.locator('#soulUpload').isVisible(), true);
  const rows = page.locator('.result-row');
  const full = rows.filter({has:page.locator('.tagline', {hasText:/^전신 ·/})});
  assert.equal(await full.count(), 1);
  assert.equal(await full.locator('.prompt').count(), 6);
  for (const text of await full.locator('.prompt').allTextContents()) {
    assert.match(text, /head.to.toe|full-body/i);
    assert.match(text, /entire face in frame|face[,/] ?forehead.*clear/i);
    assert.doesNotMatch(text, /waist-up|waist up|face close-up|undefined/i);
  }
  const first = await prompts(page);
  await page.locator('#frameRatio').fill('100');
  await page.locator('#appendCount').fill('3');
  await page.getByRole('button', {name:'Soul ID 학습 후보 더 추가'}).click();
  assert.deepEqual((await prompts(page)).slice(0, first.length), first);
  assert.match(await page.locator('#info').innerText(), /클로즈업 16개.*상반신 6개.*전신 1개/);
  await page.locator('#count').fill('1');
  await page.locator('#recommend').click();
  assert.match(await page.locator('#info').innerText(), /클로즈업 0개.*상반신 0개.*전신 1개/);
  await page.locator('#trainingTarget').selectOption('recommended');
  await page.locator('#recommend').click();
  assert.equal(await full.count(), 0);
  assert.equal(await page.locator('#soulUpload').isVisible(), false);
});

test('a trained Soul character gets its own copyable prompt without an extra image reference or Midjourney parameters', async t => {
  const page = await openPage(t);
  await model(page, 'Higgsfield Soul 2.0').check();
  await model(page, 'Midjourney').uncheck();
  await page.locator('#count').fill('2');
  await page.locator('#recommend').click();
  assert.equal(await page.locator('#soulModelHelp').isVisible(), true);
  assert.equal(await page.locator('#photoReference').isVisible(), false);
  assert.equal(await page.locator('#mjTools').isVisible(), false);
  const texts = await prompts(page);
  for (const text of texts) {
    assert.match(text, /photograph of the selected character/i);
    assert.match(text, /forehead.*hairline.*brows/i);
    assert.doesNotMatch(text, /reference image|--raw|--fast|--ar/);
  }
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async text => { window.copiedText = text; }}}));
  await page.locator('.copy').first().click();
  assert.equal(await page.evaluate(() => window.copiedText), texts[0]);
  await page.getByRole('button', {name:/^Higgsfield Soul 2.0 입력용/}).click();
  assert.equal(await page.evaluate(() => window.copiedText), texts[1]);
});

test('the primary Soul input action copies one of twenty scenes, then advances', async t => {
  const page = await openPage(t);
  await model(page, 'Higgsfield Soul 2.0').check();
  await model(page, 'Midjourney').uncheck();
  const scenes = await prompts(page);
  assert.equal(scenes.length, 20);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value:{writeText:async text => { window.copiedText = text; }},
  }));
  const next = page.getByRole('button', {name:/^전체 복사$|^Higgsfield Soul 2.0 입력용/}).first();
  for (const [i, scene] of scenes.entries()) {
    await next.click();
    assert.equal(await page.evaluate(() => window.copiedText), scene);
    assert.equal(await page.locator('.copy.copied').count(), i + 1);
  }
  assert.equal(await next.isDisabled(), true);
  await page.locator('#appendCount').fill('1');
  await page.locator('#append').click();
  await next.click();
  assert.equal(await page.evaluate(() => window.copiedText), (await prompts(page))[20]);
});

test('recommended generation uses the reference and balanced views across all five reference-image models', async t => {
  const page = await openPage(t);
  await page.locator('#trainingTarget').selectOption('recommended');
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
    variants: Array.from(row.querySelectorAll('.variant'), variant => ({
      text: variant.querySelector('.prompt').textContent, label: variant.querySelector('.small').textContent,
    })),
  })));
  for (const {tag, variants} of rows) {
    assert.match(tag, /이마·눈썹 드러냄/);
    assert.equal(variants.length, 5);
    for (const [index, {text, label}] of variants.entries()) {
      assert.match(text, index === 0 ? /same (?:person|face)/i : /reference (?:person|image)/i);
      if (index > 0) assert.match(text, /hair color(?:, length and part|\/length\/part)/i);
      assert.match(text, /forehead.*brows/i);
      assert.doesNotMatch(text, /undefined|null|with\s+wearing|,\s*,/);
      assert.equal(/relaxed shoulders/i.test(text) || label.includes('포즈'), tag.startsWith('상반신'));
    }
  }
  assert.equal(await page.locator('#mjReference').isVisible(), true);
  await model(page, 'Midjourney').uncheck();
  assert.equal(await page.locator('#mjReference').isVisible(), false);
  assert.equal(await page.locator('#referenceHelp').isVisible(), true);
});

test('forehead styling applies to new recommended scenes only and leaves selected bangs available in random mode', async t => {
  const page = await openPage(t);
  for (const name of ['GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL']) await model(page, name).check();
  const setting = page.getByRole('checkbox', {name:/이마와 눈썹 드러내기/});
  assert.equal(await setting.isChecked(), true);
  await selectOnly(page, 0);
  await bucket(page, 0).getByRole('checkbox', {name:/일자 앞머리 장발/}).check();
  await page.locator('#count').fill('1');
  await page.locator('#recommend').click();
  const original = await prompts(page);
  assert.match(original[0], /forehead(?: and |, |\/)brows clear/);
  assert.ok(original.every(text => !text.includes('blunt bangs')));
  await setting.uncheck();
  await page.locator('#append').click();
  const appended = await prompts(page);
  assert.deepEqual(appended.slice(0, 5), original);
  for (const text of appended.slice(5)) {
    assert.match(text, /reference (?:image|person)|same (?:person|face)/i);
    assert.match(text, /same hair/i);
    assert.doesNotMatch(text, /forehead|hairline|blunt bangs/i);
  }
  assert.match(await page.locator('.tagline').last().innerText(), /참조 헤어 유지/);
  await setting.check();
  await generate(page);
  for (const text of await prompts(page)) {
    assert.match(text, /long hair with blunt bangs/i);
    assert.doesNotMatch(text, /forehead|hairline/i);
  }
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
  assert.ok(all.slice(4).some(text => text.includes('left 3/4')));
  assert.ok(all.slice(4).some(text => text.includes('right profile')));
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
    '01 · 생성 설정', '02 · 스타일 라이브러리', '03 · 이미지 제작 및 학습', '04 · 생성 결과',
  ]);
  for (const width of [390, 1280]) {
    await page.setViewportSize({width, height:800});
    const selectors = ['#libraries', '#models', '#trainingTarget', '#mjCopyMode', '#count', '#recommend', '.result-head', '#mjNext', '#results'];
    let previousBottom = 0;
    for (const selector of selectors) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box && box.y >= previousBottom - 1, selector + ' at width ' + width);
      previousBottom = box.y + box.height;
    }
  }
});

test('Fast presets distinguish prompts from images and split copies at the plan concurrency limit', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value:{writeText:async text => { window.copiedText = text; }},
  }));
  const mode = page.locator('#mjCopyMode');
  for (const [limit, initial, total, sizes] of [[12, 10, 40, [12,12,12,4]], [3, 3, 10, [3,3,3,1]]]) {
    await mode.selectOption(String(limit));
    assert.equal(await page.locator('#count').inputValue(), String(initial));
    assert.equal(await page.locator('#appendCount').inputValue(), String(initial));
    assert.equal(await page.locator('#count').getAttribute('step'), '1');
    assert.match(await page.locator('#fastEstimate').innerText(), new RegExp(initial + '개.*예상 ' + initial * 4 + '장'));
    if (limit === 12) {
      await page.getByRole('button', {name:'12개 · 48장', exact:true}).click();
      assert.equal(await page.locator('#count').inputValue(), '12');
    }
    await page.locator('[data-count="' + total + '"]').click();
    await page.locator('#recommend').click();
    const rows = await prompts(page);
    assert.equal(rows.length, total);
    assert.ok(rows.every(text => text.endsWith(' --fast')));
    for (const size of sizes) {
      assert.match(await page.locator('#mjHelp').innerText(), new RegExp('이번 복사 ' + size + '개.*' + size * 4 + '장'));
      await page.locator('#mjNext').click();
      const copy = await page.evaluate(() => window.copiedText);
      assert.equal((copy.match(/--fast/g) || []).length, 1);
      if (size === 1) assert.equal(copy, rows.at(-1));
      else assert.equal((copy.match(/(?<!\\), /g) || []).length, size - 1);
    }
    assert.equal(await page.locator('#mjNext').isDisabled(), true);
  }
});

test('Fast mode applies only to Midjourney and consistently switches speed in displayed, appended, copied and saved prompts', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value:{writeText:async text => { window.copiedText = text; }},
  }));
  await model(page, 'GPT Image').check();
  await page.locator('.advanced summary').click();
  await page.locator('#params').fill('--raw --relax --turbo --ar 4:5');
  await page.locator('#count').fill('2');
  await generate(page);
  const before = await prompts(page);
  await page.locator('#mjCopyMode').selectOption('12');
  const fast = await prompts(page);
  assert.equal(fast[1], before[1]);
  assert.equal(fast[0], before[0].replace('--raw --relax --turbo --ar 4:5', '--raw --ar 4:5 --fast'));
  await page.locator('.copy').first().click();
  assert.equal(await page.evaluate(() => window.copiedText), fast[0]);
  await page.locator('#params').fill('--fast --s 25 --fast');
  await page.locator('#appendCount').fill('1');
  await page.locator('#append').click();
  const withAppend = await prompts(page);
  assert.deepEqual(withAppend.slice(0,4), fast);
  assert.ok(withAppend[4].endsWith('--s 25 --fast'));
  assert.equal(withAppend[4].match(/--fast/g).length, 1);
  await page.locator('#archive summary').click();
  await page.locator('#copyArchive').click();
  const archived = await page.evaluate(() => window.copiedText);
  for (const text of withAppend) assert.ok(archived.includes(text));
  const event = page.waitForEvent('download');
  await page.locator('#save').click();
  assert.equal(await readFile(await (await event).path(), 'utf8'), archived);
  await page.locator('#mjCopyMode').selectOption('1');
  assert.deepEqual((await prompts(page)).slice(0,4), before);
  assert.equal(await page.locator('.copy.copied').count(), 1);
  assert.equal(await page.locator('#fastHint').isVisible(), false);
  assert.doesNotMatch(await page.locator('#copyArchive').innerText(), /✓/);
  await page.locator('#mjNext').click();
  assert.equal(await page.evaluate(() => window.copiedText), (await prompts(page))[4]);
  assert.equal(await page.locator('.copy.copied').count(), 2);
  await page.locator('#mjCopyMode').selectOption('40');
  assert.equal(await page.locator('#count').getAttribute('step'), '40');
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
  await page.locator('#trainingTarget').selectOption('recommended');
  await page.locator('#count').fill('7');
  for (const [ratio, close] of [[0, 0], [35, 2], [50, 4], [100, 7]]) {
    await page.locator('#frameRatio').fill(String(ratio));
    assert.match(await page.locator('#frameEstimate').innerText(), new RegExp(close + '개.*' + (7-close) + '개'));
    await generate(page);
    const rows = await prompts(page);
    assert.equal(rows.length, 7);
    assert.equal(rows.filter(row => row.includes(framing[0])).length, close);
    assert.equal(rows.filter(row => row.includes(framing[1])).length, 7-close);
    assert.equal(rows.filter(row => row.includes('neutral, lips closed')).length, 6);
  }
});

test('the four head turns are reserved when the learning list has only four scenes', async t => {
  const page = await openPage(t);
  await page.locator('#count').fill('4');
  await page.locator('#recommend').click();
  const bodies = await prompts(page);
  for (const angle of [/left 3\/4/, /right 3\/4/, /chin up/, /chin down/]) {
    assert.equal(bodies.filter(body => angle.test(body)).length, 1, String(angle));
  }
  assert.ok(bodies.every(body => !/(?:high|low)-angle/.test(body)));
});

test('the first Soul ID list labels a neutral close-up set and a front full-height shot', async t => {
  const page = await openPage(t);
  const rows = page.locator('.result-row');
  const baseline = rows.filter({has:page.locator('.baseline-label')});
  assert.equal(await baseline.count(), 8);
  const bodies = await baseline.locator('.prompt').allTextContents();
  assert.ok(bodies.slice(0, 7).every(body => /close-up.*neutral/.test(body)));
  assert.match(bodies.at(-1), /front view.*(?:head-to-toe|full-body).*neutral/);
  await page.locator('#appendCount').fill('3');
  await page.locator('#append').click();
  assert.equal(await baseline.count(), 8);
  assert.equal(await rows.count(), 23);
});

test('Soul ID prompts keep varied studio lighting within the Midjourney character limit', async t => {
  const page = await openPage(t);
  await selectOnly(page, 4, 0);
  await page.locator('#count').fill('12');
  await page.locator('#recommend').click();
  const studioLights = ['front softbox', 'left softbox fill', 'right softbox fill', 'clamshell light'];
  const bodies = (await prompts(page)).map(text => text.replace(/ --raw --s 0$/, ''));
  for (const light of studioLights) {
    assert.equal(bodies.filter(body => body.includes(light)).length, 3, light);
  }
  for (const body of bodies) assert.ok(body.length <= promptLimits[0], body);
  await page.locator('#useLighting').uncheck();
  await page.locator('#recommend').click();
  assert.ok((await prompts(page)).every(text => studioLights.every(light => !text.includes(light))));
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
    const rows = samples.filter(row => row.includes(bg));
    assert.equal(rows.length, 5, bg);
    for (const scene of rows) {
      assert.match(scene, lighting, bg);
      assert.equal(weather.test(scene), i >= 28 || i === 19, bg);
      assert.equal(time.test(scene), i >= 14, bg);
      if (i === 19) assert.match(scene, /outside the window/);
      if (/golden hour/.test(scene)) {
        assert.match(scene, /clear skies/);
        assert.match(scene, /warm/i);
      }
      if (/overcast skies/.test(scene)) assert.match(scene, /diffused|diffuse|low-contrast|overcast light/);
      assert.doesNotMatch(scene, /backlight|silhouette|harsh|fog|storm|blizzard|downpour|neon|pitch.dark/i);
    }
    if (i >= 28) assert.ok(new Set(rows.map(row => row.split(bg + ', ')[1])).size > 1, bg);
  }
});

test('all eight independent switch settings reach the rendered prompt', async t => {
  const page = await openPage(t);
  await model(page, 'Stable Diffusion XL').check();
  await model(page, 'Midjourney').uncheck();
  await selectOnly(page, 4, 33); // beach
  await selectOnly(page, 0, 0);
  await selectOnly(page, 1, 0);
  await selectOnly(page, 2, 1); // avoid clothing colors such as "light blue"
  await page.locator('#frameRatio').fill('100');
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
    for (const scene of await prompts(page)) {
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
    for (const part of ['long straight hair', 'front view', 'white T-shirt', 'subtle closed-mouth smile']) assert.ok(row.includes(part));
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
  await selectOnly(page, 0, 0);
  await selectOnly(page, 1, 0);
  await selectOnly(page, 2, 1);
  await selectOnly(page, 4);
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
  await model(page, 'Stable Diffusion XL').check();
  await model(page, 'Midjourney').uncheck();
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
  await selectOnly(page, 0, 0);
  await selectOnly(page, 1, 0);
  await selectOnly(page, 2, 16); // ivory blouse
  await selectOnly(page, 4);
  await page.locator('.advanced summary').click();
  await page.locator('#prefix').fill('custom portrait');
  await page.locator('#suffix').fill('custom detail');
  await page.locator('#params').fill('--ar 4:5');
  await generate(page);
  const rows = await prompts(page);
  assert.ok(rows.every(row => row.startsWith('Photorealistic,') && row.includes('custom portrait, custom detail') && row.endsWith(' --ar 4:5')));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: async value => { window.copiedText = value; }}
  }));
  await page.locator('.copy').first().click();
  assert.equal(await page.evaluate(() => window.copiedText), rows[0]);
  await page.locator('#archive summary').click();
  await page.locator('#copyArchive').click();
  assert.equal(await page.evaluate(() => window.copiedText), rows.join('\n\n'));
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#save').click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'face-prompts.txt');
  assert.equal(await readFile(await download.path(), 'utf8'), rows.join('\n\n'));
});

test('copy checkmarks track the copied scene and model, bulk selection, and new batches', async t => {
  const page = await openPage(t);
  await model(page, 'Gemini (Nano Banana)').check();
  await model(page, 'Midjourney').uncheck();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async () => {}}}));
  const buttons = page.locator('.copy'), bulk = page.locator('#copyArchive');
  await buttons.first().click();
  assert.match(await buttons.first().innerText(), /✓/);
  assert.doesNotMatch(await buttons.nth(1).innerText(), /✓/);
  await model(page, 'FLUX.2').check();
  assert.match(await buttons.first().innerText(), /✓/);
  assert.doesNotMatch(await buttons.nth(1).innerText(), /✓/);
  await page.locator('#archive summary').click();
  await bulk.click();
  assert.match(await bulk.innerText(), /✓/);
  assert.equal(await page.locator('.copy.copied').count(), 1);
  assert.match(await page.getByRole('button', {name:/^FLUX.2 입력용/}).innerText(), /1번 장면/);
  assert.match(await page.getByRole('button', {name:/^Gemini .*입력용/}).innerText(), /2번 장면/);
  await model(page, 'Stable Diffusion XL').check();
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
  await page.locator('#mjNext').click();
  await generate(page);
  await page.evaluate(() => window.finishCopy());
  assert.doesNotMatch(await button.innerText(), /✓/);
  assert.doesNotMatch(await page.locator('#copyArchive').textContent(), /✓/);
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

test('Standard copies only the latest appended scenes in groups of ten', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: async text => { window.copiedText = text; }},
  }));
  await page.locator('#mjCopyMode').selectOption('10');
  const next = page.locator('#mjNext');
  const progress = page.locator('#mjProgress');
  await next.click();
  assert.equal(await page.locator('.copy.copied').count(), 10);
  await page.locator('#appendCount').fill('12');
  await page.locator('#append').click();
  const all = await prompts(page);
  assert.match(await progress.innerText(), /21–32번.*0 \/ 12개/);
  for (const [start, end] of [[20, 30], [30, 32]]) {
    await next.click();
    const payload = await page.evaluate(() => window.copiedText);
    const match = payload.match(/^\{(.+)\} (--raw --s 0)$/);
    assert.ok(match, payload);
    const copied = match[1].split(/(?<!\\), /).map(body => body.replaceAll('\\,', ',') + ' ' + match[2]);
    assert.deepEqual(copied, all.slice(start, end));
  }
  const checkedRows = await page.locator('.copy.copied').evaluateAll(buttons => buttons.map(button => Number(button.dataset.index)));
  assert.deepEqual(checkedRows, [...Array.from({length:10}, (_, i) => i), ...Array.from({length:12}, (_, i) => i + 20)]);
  assert.match(await progress.innerText(), /21–32번.*12 \/ 12개/);
  assert.ok(await next.isDisabled());
  await page.locator('#appendCount').fill('1');
  await page.locator('#append').click();
  assert.match(await progress.innerText(), /33번.*0 \/ 1개/);
  await next.click();
  assert.equal(await page.evaluate(() => window.copiedText), (await prompts(page))[32]);
  assert.ok(await next.isDisabled());
});

test('the main Midjourney action pastes one permutation and archiving never advances its queue', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: async text => { window.copiedText = text; }},
  }));
  const action = page.getByRole('button', {name:/미드저니 입력용 묶음 복사/});
  assert.equal(await action.isVisible(), true);
  assert.equal(await page.locator('#singleInputs button:visible').count(), 0);
  assert.equal(await page.locator('#copyArchive').isVisible(), false);
  await model(page, 'GPT Image').check();
  await page.locator('#archive summary').click();
  await page.locator('#copyArchive').click();
  assert.match(await page.evaluate(() => window.copiedText), /\[01 · GPT Image\]/);
  assert.match(await page.locator('#copyArchive').innerText(), /✓/);
  assert.equal(await page.locator('#mjProgress').innerText(), '0 / 20개 복사됨');
  await action.click();
  const text = await page.evaluate(() => window.copiedText);
  assert.equal(text.split('\n').length, 1);
  assert.equal(text.match(/--raw/g).length, 1);
  assert.equal(text.match(/(?<!\\), /g).length, 3);
  assert.doesNotMatch(text, /GPT Image|\[01/);
  assert.equal(await page.locator('#mjProgress').innerText(), '4 / 20개 복사됨');
  await model(page, 'Midjourney').uncheck();
  assert.equal(await page.getByRole('button', {name:/^GPT Image 입력용/}).isVisible(), true);
  assert.equal(await action.isVisible(), false);
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

test('six model formats share the current scene, work offline and export by model', async t => {
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
  const models = ['Midjourney', 'GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL', 'Higgsfield Soul 2.0'];
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
    assert.equal(new Set(texts).size, models.length);
    for (const [j, text] of texts.entries()) {
      assert.match(text, /long straight hair/i);
      assert.match(text, /navy (?:blue )?T-shirt/i);
      if (j === 0 && !/beach/i.test(text)) assert.match(await row.locator('.variant .small').first().innerText(), /생략한 항목.*배경/);
      else assert.match(text, /beach/i);
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
  await page.locator('#archive summary').click();
  await page.locator('#copyArchive').click();
  assert.equal(await page.evaluate(() => window.copiedText), exported.join('\n\n'));
  const event = page.waitForEvent('download');
  await page.locator('#save').click();
  assert.equal(await readFile(await (await event).path(), 'utf8'), exported.join('\n\n'));
  for (const name of models) await model(page, name).uncheck();
  assert.equal((await prompts(page)).length, 0);
  assert.ok(await page.locator('#copyArchive').isDisabled());
  await model(page, 'Midjourney').check();
  assert.deepEqual(await prompts(page), firstPass);
});

test('append preserves rows and copy marks while adding current settings to totals and exports', async t => {
  const page = await openPage(t);
  await generate(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async text => { window.copiedText = text; }}}));
  const before = await prompts(page);
  await page.locator('#mjCopyMode').selectOption('10');
  await page.locator('#mjNext').click();
  await page.locator('#mjNext').click();
  await page.locator('#ratio').fill('0');
  await page.locator('#frameRatio').fill('100');
  await selectOnly(page, 0, 0);
  await selectOnly(page, 1, 0);
  await selectOnly(page, 2, 16);
  await selectOnly(page, 4);
  await page.locator('.advanced summary').click();
  await page.locator('#prefix').fill('additional portrait');
  await page.locator('#appendCount').fill('3');
  await page.locator('#append').click();
  const after = await prompts(page);
  assert.equal(after.length, 23);
  assert.deepEqual(after.slice(0, 20), before);
  assert.ok(after.slice(20).every(text => text.startsWith('Photorealistic,') && text.includes('close-up') && text.includes('additional portrait') && !text.includes('neutral, lips closed')));
  assert.equal(await page.locator('.copy.copied').count(), 20);
  assert.doesNotMatch(await page.locator('#copyArchive').textContent(), /✓/);
  assert.match(await page.locator('#info').innerText(), /장면 23개.*무표정 16개.*미세 표정 7개.*클로즈업 17개.*상반신 6개/);
  assert.equal(await page.locator('.result-row').last().locator(':scope > .muted').innerText(), '23');
  await model(page, 'FLUX.2').check();
  assert.equal((await prompts(page)).length, 46);
  await model(page, 'FLUX.2').uncheck();
  await page.locator('#archive summary').click();
  await page.locator('#copyArchive').click();
  assert.equal(await page.evaluate(() => window.copiedText), after.join('\n\n'));
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#save').click();
  assert.equal(await readFile(await (await downloadEvent).path(), 'utf8'), after.join('\n\n'));
  await selectOnly(page, 0);
  await page.locator('#append').click();
  assert.deepEqual(await prompts(page), after);
  assert.match(await page.locator('#status').innerText(), /하나 이상/);
});

test('switching the image tool reformats existing shots; a new training target applies to the next list', async t => {
  const page = await openPage(t);
  const workflow = page.locator('#listWorkflow');
  const newList = page.getByRole('button', {name:'일반 얼굴 학습용 프롬프트 생성'});
  const midjourney = await prompts(page);
  const tags = await page.locator('.tagline').allTextContents();
  await model(page, 'GPT Image').check();
  await model(page, 'Midjourney').uncheck();
  assert.match(await workflow.innerText(), /GPT Image.*Higgsfield Soul ID/);
  assert.deepEqual(await page.locator('.tagline').allTextContents(), tags);
  const gpt = await prompts(page);
  assert.ok(gpt.every(text => text.startsWith('Create a ') && text.includes('single subject') && !text.includes('--raw')));
  assert.equal(await page.locator('#mjTools').isVisible(), false);
  await page.locator('#trainingTarget').selectOption('recommended');
  assert.deepEqual(await prompts(page), gpt);
  assert.match(await workflow.innerText(), /GPT Image.*Higgsfield Soul ID/);
  await page.locator('#appendCount').fill('1');
  await page.locator('#append').click();
  assert.match((await prompts(page)).at(-1), /entire face in frame/);
  await model(page, 'Midjourney').check();
  await model(page, 'GPT Image').uncheck();
  assert.deepEqual((await prompts(page)).slice(0, midjourney.length), midjourney);
  await newList.click();
  assert.match(await workflow.innerText(), /Midjourney.*일반 얼굴 학습/);
  assert.ok((await prompts(page)).every(text => text.endsWith('--raw --s 0') && !/head-to-toe|single subject/.test(text)));
  assert.equal(await page.locator('#soulUpload').isVisible(), false);
  await generate(page);
  assert.match(await workflow.innerText(), /Midjourney.*자유 랜덤/);
});

test('appended scenes keep their own Midjourney parameters and fresh generation replaces the list', async t => {
  const page = await openPage(t);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async text => { window.copiedText = text; }}}));
  await page.locator('#count').fill('2');
  await generate(page);
  await page.locator('.advanced summary').click();
  await page.locator('#params').fill('--ar 4:5 --chaos 17');
  await page.locator('#appendCount').fill('3');
  await page.locator('#append').click();
  const rows = await prompts(page);
  assert.ok(rows.slice(0, 2).every(row => row.endsWith(' --raw --s 0')));
  const params = '--ar 4:5 --chaos 17';
  await page.locator('#mjNext').click();
  const clipboard = await page.evaluate(() => window.copiedText);
  const bodies = rows.slice(2).map(row => row.slice(0, -params.length - 1).replaceAll(',', '\\,'));
  assert.equal(clipboard, '{' + bodies.join(', ') + '} ' + params);
  await page.locator('#appendCount').fill('200');
  await page.locator('#append').click();
  assert.equal(await page.locator('.result-row').count(), 205);
  await generate(page);
  assert.equal(await page.locator('.result-row').count(), 2);
  assert.equal(await page.locator('.copy.copied').count(), 0);
  assert.equal(await page.locator('#mjProgress').innerText(), '0 / 2개 복사됨');
});

test('archiving before append leaves input scenes available and the expanded archive unmarked', async t => {
  const page = await openPage(t);
  await model(page, 'GPT Image').check();
  await model(page, 'Midjourney').uncheck();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value:{writeText:() => new Promise(resolve => { window.finishCopy = resolve; })}}));
  await page.locator('#archive summary').click();
  await page.locator('#copyArchive').click();
  await page.locator('#appendCount').fill('1');
  await page.locator('#append').click();
  await page.evaluate(() => window.finishCopy());
  assert.equal(await page.locator('.copy.copied').count(), 0);
  assert.doesNotMatch(await page.locator('.copy').last().innerText(), /✓/);
  assert.doesNotMatch(await page.locator('#copyArchive').innerText(), /✓/);
});

test('model formats preserve custom text and omit unselected environment fields', async t => {
  const page = await openPage(t);
  for (const name of ['GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL', 'Higgsfield Soul 2.0']) await model(page, name).check();
  await page.locator('#count').fill('1');
  await selectOnly(page, 0, 0);
  await selectOnly(page, 1, 0);
  await selectOnly(page, 2, 16);
  await selectOnly(page, 4);
  await page.locator('.advanced summary').click();
  const prefix = 'Keep the uneven smile.';
  await page.locator('#prefix').fill(prefix);
  await page.locator('#suffix').fill('Keep the tiny freckle.');
  await page.locator('#params').fill('--ar 4:5');
  await generate(page);
  const texts = await prompts(page);
  assert.equal(texts.length, 6);
  for (const [i, text] of texts.entries()) {
    assert.ok(text.includes(prefix));
    assert.ok(text.includes('Keep the tiny freckle.'));
    assert.equal(text.includes('--ar 4:5'), i === 0);
    assert.doesNotMatch(text, /undefined|null|backdrop|setting:|outside the window|studio lighting/i);
  }
});

test('the downloadable HTML starts by itself offline and formats all six models', async t => {
  const page = await openPage(t);
  const downloadEvent = page.waitForEvent('download', {timeout: 5000});
  const [download] = await Promise.all([downloadEvent, page.getByRole('link', {name:'오프라인용 HTML 저장'}).click()]);
  const dir = await mkdtemp(path.join(tmpdir(), 'face-prompts-'));
  t.after(() => rm(dir, {force:true, recursive:true}));
  const filename = path.join(dir, 'offline.html');
  await download.saveAs(filename);
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(filename).href);
  for (const name of ['GPT Image', 'Gemini (Nano Banana)', 'FLUX.2', 'Stable Diffusion XL', 'Higgsfield Soul 2.0']) await model(page, name).check();
  await page.locator('#count').fill('200');
  await generate(page);
  assert.equal(await page.locator('.result-row').count(), 200);
  assert.equal((await prompts(page)).length, 1200);
});
