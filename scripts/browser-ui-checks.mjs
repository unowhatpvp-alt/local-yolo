/** Actual application interactions for CI. No inference, cache or browser API replacements. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {createCanvas, loadImage} from '@napi-rs/canvas';

const CHECKS = ['modelSelection25', 'modelSwitching', 'downloadProgress', 'cacheRecognition',
  'cachedReload', 'localOnnxImport', 'imageExport', 'jsonExport', 'videoPauseReplay',
  'fileReplacementCleanup', 'responsivePhone', 'responsiveTablet',
  'permissionDeniedOrUnavailable', 'noMediaNetworkRequests'];
const taskOrder = ['detect', 'segment', 'pose', 'classify', 'obb'];
const sizeOrder = ['N', 'S', 'M', 'L', 'X'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function validateUi({page, context, out, baseUrl, models}) {
  await mkdir(out, {recursive: true});
  const report = {schemaVersion: 1, startedAt: new Date().toISOString(),
    scope: 'Actual CI Chromium application controls; no physical-device claims.',
    checks: Object.fromEntries(CHECKS.map(id => [id, {status: 'pending', observations: []}])),
    regressions: {}, requests: []};
  let current = 'modelSelection25';
  const requests = [];
  const onRequest = request => {
    if (/^https?:/.test(request.url())) requests.push({url: request.url(), method: request.method(), type: request.resourceType()});
  };
  context.on('request', onRequest);
  const save = () => writeFile(join(out, 'actual-ui-checks.json'), JSON.stringify(report, null, 2) + '\n');
  const pass = async (id, ...observations) => {
    report.checks[id] = {status: 'pass', observations, observedAt: new Date().toISOString()};
    console.log('ACTUAL_UI_PASS', id, JSON.stringify(observations));
    await save();
  };
  const load = async () => {
    await page.locator('#load-model').click();
    await page.locator('#workbench').waitFor({state: 'visible', timeout: 180000});
  };
  const result = async () => page.waitForFunction(() =>
    /^\d+ /.test(document.querySelector('#result-summary').textContent) &&
      !document.querySelector('#overlay-canvas').hidden, null, {timeout: 120000});
  const upload = async path => {
    await page.locator('#file-input').setInputFiles(path);
    await result();
  };
  const exportFile = async (id, name) => {
    if (await page.locator('#results-menu-toggle').getAttribute('aria-expanded') !== 'true') {
      await page.locator('#results-menu-toggle').click();
    }
    const downloaded = page.waitForEvent('download', {timeout: 30000});
    await page.locator(id).click();
    const download = await downloaded;
    const target = join(out, name);
    await download.saveAs(target);
    // PNG intentionally leaves the menu available for a second export.
    if (await page.locator('#results-menu-toggle').getAttribute('aria-expanded') === 'true') {
      await page.locator('#results-menu-toggle').click();
    }
    await page.locator('#results-options-panel').waitFor({state: 'hidden'});
    return {path: target, suggestedFilename: download.suggestedFilename(), bytes: await readFile(target)};
  };
  const exportJson = async name => {
    const downloaded = await exportFile('#save-json', name + '.json');
    return {...downloaded, value: JSON.parse(downloaded.bytes.toString('utf8'))};
  };
  const select = async model => {
    await page.locator('#task-picker-button').click();
    await page.locator('#task-options > button').nth(taskOrder.indexOf(model.task)).click();
    await page.locator('#task-picker-menu').waitFor({state: 'hidden'});
    await page.locator('#size-picker-button').click();
    await page.locator('#size-options > button').nth(sizeOrder.indexOf(model.size)).click();
    await page.locator('#size-picker-menu').waitFor({state: 'hidden'});
  };
  const setThreshold = async value => page.locator('#confidence').evaluate((element, threshold) => {
    element.value = String(threshold);
    element.dispatchEvent(new Event('input', {bubbles: true}));
    element.dispatchEvent(new Event('change', {bubbles: true}));
  }, value);
  const blobUnavailable = async url => page.evaluate(async value => {
    try { const response = await fetch(value); return {revoked: !response.ok, status: response.status}; }
    catch (error) { return {revoked: true, actualError: error.message}; }
  }, url);
  try {
    assert.equal(models.length, 25);
    const nano = models.find(model => model.id === 'yolo26-detect-n');
    assert(nano);
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto(baseUrl);
    await page.locator('#load-model').waitFor({state: 'visible'});
    if (await page.locator('html').getAttribute('lang') !== 'en') await page.locator('#language-toggle').click();
    const selections = [];
    for (const model of models) {
      await select(model);
      const observed = {
        id: model.id, name: await page.locator('#model-name').textContent(),
        bytesLabel: await page.locator('#model-size').textContent(),
        enabled: await page.locator('#load-model').isEnabled(),
        checkedTasks: await page.locator('#task-options [aria-checked=true]').count(),
        checkedSizes: await page.locator('#size-options [aria-checked=true]').count(),
      };
      assert.equal(observed.name, model.name);
      assert.equal(observed.bytesLabel, (model.bytes / 1048576).toFixed(1) + ' MB');
      assert(observed.enabled);
      assert.equal(observed.checkedTasks, 1); assert.equal(observed.checkedSizes, 1);
      selections.push(observed);
    }
    await pass('modelSelection25', {selectionCount: selections.length, selections, inferenceScope: 'Selection only; actual per-model inference remains the independent matrix.'});
    // Trusted Playwright keyboard events exercise the real document focus handling.
    for (const [trigger, menu, choices] of [
      ['#task-picker-button', '#task-picker-menu', '#task-options > button'],
      ['#size-picker-button', '#size-picker-menu', '#size-options > button'],
    ]) {
      await page.locator(trigger).focus();
      await page.locator(trigger).press('ArrowDown');
      await page.waitForFunction(selector => document.querySelector(selector).classList.contains('is-open'), menu);
      assert(await page.locator(choices).first().evaluate(element => element === document.activeElement));
      await page.keyboard.press('Escape');
      await page.locator(menu).waitFor({state: 'hidden'});
      assert(await page.locator(trigger).evaluate(element => element === document.activeElement));
      await page.locator(trigger).press('ArrowUp');
      await page.waitForFunction(selector => document.querySelector(selector).classList.contains('is-open'), menu);
      assert(await page.locator(choices).last().evaluate(element => element === document.activeElement));
      await page.keyboard.press('Escape');
      await page.locator(menu).waitFor({state: 'hidden'});
    }
    report.regressions.menuKeyboard = {status: 'pass', viewport: '1280x900', firstLastAndEscapeFocus: true, observations: ['Actual ArrowDown/ArrowUp/ Escape on both desktop model menus.']};
    await page.locator('#language-toggle').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
    assert.equal(await page.locator('#source-local span').textContent(), '导入本地 ONNX');
    await page.locator('#language-toggle').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#source-local span').textContent(), 'Import local ONNX');
    const initialTheme = await page.locator('html').getAttribute('data-theme');
    await page.locator('#theme-toggle').click();
    const changedTheme = await page.locator('html').getAttribute('data-theme');
    assert.notEqual(initialTheme, changedTheme);
    if (changedTheme !== 'light') await page.locator('#theme-toggle').click();
    report.regressions.languageTheme = {status: 'pass', languages: ['zh-CN', 'en'], initialTheme, changedTheme, finalTheme: 'light'};
    await select(nano);
    current = 'downloadProgress';
    await page.locator('#settings-open').click();
    const row = page.locator('#cache-list .cache-row').filter({hasText: new RegExp('^' + nano.name + ' ·')});
    if (await row.count()) {
      await row.locator('button').click();
      await row.waitFor({state: 'detached'});
    }
    await page.locator('#settings-close').click();
    await page.waitForFunction(() => !document.querySelector('#model-cache-state').textContent.includes('Cached'));
    await page.evaluate(() => {
      window.__actualUiProgress = [];
      const capture = () => {
        const progress = document.querySelector('#load-progress');
        window.__actualUiProgress.push({time: performance.now(), phase: document.body.dataset.phase,
          value: progress.value, visible: !progress.hidden, text: document.querySelector('#load-status').textContent});
      };
      const observer = new MutationObserver(capture);
      observer.observe(document.querySelector('#load-progress'), {attributes: true});
      observer.observe(document.querySelector('#load-status'), {childList: true, subtree: true, characterData: true});
      window.__actualUiProgressObserver = observer;
      capture();
    });
    const requestStart = requests.length;
    await load();
    const progress = await page.evaluate(() => {
      window.__actualUiProgressObserver.disconnect();
      return window.__actualUiProgress;
    });
    const modelRequests = requests.slice(requestStart).filter(request => request.url === nano.url);
    assert(modelRequests.length > 0, 'Uncached UI load must perform an actual pinned model request.');
    assert(progress.some(item => /Downloading model/.test(item.text) && item.visible));
    assert(progress.some(item => item.value > 0 && item.visible));
    await pass('downloadProgress', {model: nano.id, actualRequests: modelRequests, mutationObservations: progress});
    current = 'permissionDeniedOrUnavailable';
    await page.waitForFunction(() => document.querySelector('#stage').classList.contains('has-error'), null, {timeout: 60000});
    const cameraError = await page.locator('#stage-message').textContent();
    assert.match(cameraError, /camera|permission|HTTPS|unavailable/i);
    assert(await page.locator('#stage-empty').isVisible());
    await pass('permissionDeniedOrUnavailable', {actualError: cameraError, fakeCamera: false});
    current = 'cacheRecognition';
    await page.locator('#switch-model').click();
    await page.waitForFunction(() => document.querySelector('#model-cache-state').textContent.includes('Cached'));
    await pass('cacheRecognition', {model: nano.id, label: await page.locator('#model-cache-state').textContent()});
    current = 'cachedReload';
    const cachedRequestStart = requests.length;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#model-cache-state').textContent.includes('Cached'));
    await load();
    assert.equal(requests.slice(cachedRequestStart).filter(request => request.url === nano.url).length, 0);
    await page.locator('#mode-file').click();
    await upload(resolve('tests/fixtures/bus.jpg'));
    await pass('cachedReload', {model: nano.id, realImageSummary: await page.locator('#result-summary').textContent(), pinnedWeightNetworkRequests: 0});
    current = 'imageExport';
    const png = await exportFile('#save-image', 'actual-ui-bus.png');
    assert.equal(png.bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const pngGeometry = {width: png.bytes.readUInt32BE(16), height: png.bytes.readUInt32BE(20)};
    const canvasGeometry = await page.locator('#overlay-canvas').evaluate(canvas => ({width: canvas.width, height: canvas.height}));
    assert.deepEqual(pngGeometry, canvasGeometry);
    await pass('imageExport', {filename: png.suggestedFilename, ...pngGeometry, bytes: png.bytes.length, sha256: sha(png.bytes), actualDownload: true});
    current = 'jsonExport';
    const busJson = await exportJson('actual-ui-bus');
    assert(busJson.value.items.some(item => item.label === 'bus'));
    assert.equal(busJson.value.task, 'detect');
    assert(['WASM', 'WebGPU'].includes(busJson.value.backend));
    await pass('jsonExport', {filename: busJson.suggestedFilename, bytes: busJson.bytes.length, sha256: sha(busJson.bytes), task: busJson.value.task, backend: busJson.value.backend, count: busJson.value.items.length, actualDownload: true});
    // Establish both outcomes with real inference, then cause two changes in one JS task.
    // The second change necessarily occurs before the Worker's first reply can run.
    current = 'busyConfidenceRegression';
    await setThreshold(.99);
    await page.waitForFunction(() => document.querySelector('#result-summary').textContent.startsWith('0 '), null, {timeout: 60000});
    const highCanvas = await page.locator('#overlay-canvas').evaluate(canvas => canvas.toDataURL());
    await setThreshold(.01);
    await page.waitForFunction(() => /^[1-9]\d* /.test(document.querySelector('#result-summary').textContent), null, {timeout: 60000});
    const lowCanvas = await page.locator('#overlay-canvas').evaluate(canvas => canvas.toDataURL());
    assert.notEqual(highCanvas, lowCanvas, 'The actual high/low threshold fixture outcomes must differ.');
    await page.locator('#confidence').evaluate(element => {
      for (const value of [.01, .99]) {
        element.value = String(value);
        element.dispatchEvent(new Event('input', {bubbles: true}));
        element.dispatchEvent(new Event('change', {bubbles: true}));
      }
    });
    await page.waitForFunction(expected => document.querySelector('#result-summary').textContent.startsWith('0 ') &&
      document.querySelector('#overlay-canvas').toDataURL() === expected, highCanvas, {timeout: 60000});
    const queued = await exportJson('actual-ui-busy-threshold');
    assert.equal(queued.value.items.length, 0);
    report.regressions.busyConfidence = {status: 'pass', source: 'Actual bus image and actual model Worker; no delayed/fake inference.',
      synchronousChanges: [.01, .99], finalThreshold: .99, finalResults: 0,
      highRenderSha256: sha(Buffer.from(highCanvas.split(',')[1], 'base64')),
      lowRenderSha256: sha(Buffer.from(lowCanvas.split(',')[1], 'base64'))};
    await setThreshold(.25);
    await page.waitForFunction(() => /^[1-9]\d* /.test(document.querySelector('#result-summary').textContent), null, {timeout: 60000});
    current = 'fileReplacementCleanup';
    const oldImageUrl = await page.locator('#file-image').getAttribute('src');
    assert(oldImageUrl?.startsWith('blob:'));
    const bus = await loadImage(resolve('tests/fixtures/bus.jpg'));
    const largeCanvas = createCanvas(3002, 2000), painter = largeCanvas.getContext('2d');
    painter.fillStyle = '#eeeeee'; painter.fillRect(0, 0, 3002, 2000);
    const scaledWidth = bus.width * 2000 / bus.height;
    painter.drawImage(bus, (3002 - scaledWidth) / 2, 0, scaledWidth, 2000);
    const largePath = join(out, 'actual-ui-3002x2000.png');
    await writeFile(largePath, largeCanvas.toBuffer('image/png'));
    await upload(largePath);
    const oldRevoked = await blobUnavailable(oldImageUrl);
    assert(oldRevoked.revoked, 'Replaced image Blob URL must be revoked by the real media controller.');
    const largeJson = await exportJson('actual-ui-3002x2000');
    const space = largeJson.value.coordinateSpace;
    assert.equal(space.originalWidth, 3002); assert.equal(space.originalHeight, 2000);
    assert.equal(space.width, 1920); assert.equal(space.height, 1279);
    assert.equal(space.scaleX, 1920 / 3002); assert.equal(space.scaleY, 1279 / 2000);
    assert.equal(largeJson.value.sourceWidth, 1920); assert.equal(largeJson.value.sourceHeight, 1279);
    assert(largeJson.value.items.some(item => item.label === 'bus'));
    for (const {box} of largeJson.value.items) {
      assert(Object.values(box).every(Number.isFinite));
      assert(box.x >= -.1 && box.y >= -.1 && box.x + box.width <= 1920.1 && box.y + box.height <= 1279.1);
    }
    report.regressions.highResolutionCoordinates = {status: 'pass', coordinateSpace: space, resultCount: largeJson.value.items.length,
      source: 'Real bus fixture centered without changing its aspect ratio in a 3002x2000 local PNG.'};
    const largeUrl = await page.locator('#file-image').getAttribute('src');
    await page.locator('#file-input').setInputFiles({name: 'actually-invalid.png', mimeType: 'image/png', buffer: Buffer.from('This is not encoded image data.')});
    await page.waitForFunction(() => document.querySelector('#stage').classList.contains('has-error') &&
      !document.querySelector('#stage-empty').hidden, null, {timeout: 60000});
    assert(await page.locator('#save-image').isDisabled()); assert(await page.locator('#save-json').isDisabled());
    assert(await page.locator('#file-name').isHidden());
    const cleanup = await page.evaluate(() => ({imageSrc: document.querySelector('#file-image').getAttribute('src'),
      videoSrc: document.querySelector('#camera-video').getAttribute('src'),
      videoStream: Boolean(document.querySelector('#camera-video').srcObject),
      resultHidden: document.querySelector('#overlay-canvas').hidden}));
    assert.equal(cleanup.imageSrc, null); assert.equal(cleanup.videoSrc, null);
    assert.equal(cleanup.videoStream, false); assert(cleanup.resultHidden);
    const largeRevoked = await blobUnavailable(largeUrl); assert(largeRevoked.revoked);
    await pass('fileReplacementCleanup', {imageToImageBlob: oldRevoked, imageToInvalidBlob: largeRevoked, cleanup,
      exportDisabledAfterDecodeError: true, revocationMethod: 'Fetch actual prior Blob URLs after replacement; URL APIs were not replaced.'});
    await upload(resolve('tests/fixtures/bus.jpg'));
    current = 'modelSwitching';
    await page.locator('#switch-model').click();
    assert(await page.locator('#model-page').isVisible());
    assert(await page.locator('#workbench').isHidden());
    const localPath = resolve('tests/fixtures/yolo26/yolo26n.onnx');
    assert.equal(sha(await readFile(localPath)), nano.sha256);
    await page.locator('#source-local').click();
    await page.locator('#local-model-input').setInputFiles(localPath);
    await load();
    await page.locator('#mode-file').click();
    await upload(resolve('tests/fixtures/bus.jpg'));
    const local = await exportJson('actual-ui-local-onnx');
    assert.equal(local.value.model, 'yolo26n.onnx');
    assert(local.value.items.some(item => item.label === 'bus'));
    await pass('localOnnxImport', {filename: local.value.model, sha256: nano.sha256, actualImageResults: local.value.items.length, task: local.value.task});
    await pass('modelSwitching', {from: nano.id, to: local.value.model, oldWorkbenchClosed: true, freshRealInference: true});
    current = 'noMediaNetworkRequests';
    assert(!requests.some(request => request.method !== 'GET'), 'Local media interactions issued an HTTP upload/mutation request.');
    await pass('noMediaNetworkRequests', {observedHttpRequests: requests.length, nonGetRequests: 0,
      localMediaMethods: ['file input for JPEG, PNG, invalid PNG and ONNX'], scope: 'Observed application network; actual remote model/static GETs are retained.'});
    await page.screenshot({path: join(out, 'actual-ui-workbench-1280.png')});
    // Leave the caller on the normal online Nano launcher for its PWA/video tests.
    await page.locator('#switch-model').click();
    await select(nano);
    report.status = 'partial';
    report.note = 'Video/replay and responsive viewport checks remain pending for the caller to execute and attach.';
  } catch (error) {
    report.status = 'fail';
    report.failure = error.stack || error.message;
    if (report.checks[current]) report.checks[current] = {status: 'fail', observations: [error.message], observedAt: new Date().toISOString()};
    else report.regressions[current] = {status: 'fail', error: error.message};
    try { await page.screenshot({path: join(out, 'actual-ui-failure.png')}); } catch {}
  } finally {
    context.off('request', onRequest);
    report.requests = requests;
    report.completedAt = new Date().toISOString();
    await save();
  }
  return report;
}
