// Chromium with controlled API responses; no real accounts or database writes.
// Run against `npm run dev` on port 3000.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const base = 'http://localhost:3000';
const id = '507f1f77bcf86cd799439011';
const user = {
  id,
  email: 'loading@example.invalid',
  firstName: 'Loading',
  lastName: 'Test',
  role: 'ORGANIZER',
};
const event = {
  id,
  name: 'Evento de teste loading',
  date: '2026-10-15',
  startTime: '20:00',
  endTime: '21:30',
  status: 'ACTIVE',
  revision: 1,
  confirmedCount: 10,
  waitingCount: 10,
  playersPerTeam: null,
  formationExists: false,
  ownPresence: 'CONFIRMED',
  ownAllocated: false,
  ownParticipantId: null,
};
const output = new URL('../.test-build/access-loading/', import.meta.url);
await mkdir(output, { recursive: true });
function gate() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  const control = {
    promise,
    pending: true,
    release() {
      control.pending = false;
      release();
    },
  };
  return control;
}

function monitor(page) {
  const pending = new Map();
  const events = [];
  function record(event) {
    events.push({ time: new Date().toISOString(), ...event });
    if (events.length > 200) events.shift();
  }
  page.on('request', (request) => {
    const details = {
      url: request.url(),
      method: request.method(),
      type: request.resourceType(),
      started: Date.now(),
    };
    pending.set(request, details);
    if (request.isNavigationRequest() || details.url.startsWith(`${base}/api/`))
      record({
        event: 'request',
        ...details,
        redirectedFrom: request.redirectedFrom()?.url(),
      });
  });
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => {
    pending.delete(request);
    record({
      event: 'requestfailed',
      url: request.url(),
      error: request.failure()?.errorText,
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400 || response.request().isNavigationRequest())
      record({
        event: 'response',
        url: response.url(),
        status: response.status(),
      });
  });
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      record({ event: 'console', level: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) =>
    record({ event: 'pageerror', error: error.stack ?? error.message }),
  );
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame())
      record({ event: 'navigation', url: frame.url() });
  });
  for (const event of ['domcontentloaded', 'load'])
    page.on(event, () => record({ event, url: page.url() }));
  return {
    record,
    snapshot: () => ({
      finalURL: page.url(),
      pendingRequests: [...pending.values()].map((request) => ({
        ...request,
        pendingMs: Date.now() - request.started,
      })),
      events,
    }),
  };
}

async function assertBlockedKeyboardAccess(page, overlay, diagnostics) {
  const audit = await overlay.evaluateHandle((dialog) => {
    const selector =
      'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], summary, iframe';
    const describe = (node) =>
      node instanceof Element
        ? {
            tag: node.tagName,
            id: node.id,
            role: node.getAttribute('role'),
            label: node.getAttribute('aria-label'),
            href: node.getAttribute('href'),
            tabIndex: node instanceof HTMLElement ? node.tabIndex : null,
          }
        : null;
    // body/html can represent focus in the browser UI. They are not app controls.
    const blockedTarget = (node) =>
      node instanceof Element &&
      node !== document.body &&
      node !== document.documentElement &&
      !dialog.contains(node);
    const outside = [...document.querySelectorAll(selector)].filter(
      (node) =>
        !dialog.contains(node) &&
        node.getClientRects().length > 0 &&
        !node.matches(':disabled'),
    );
    const leaks = [];
    const activations = [];
    const onFocus = (event) => {
      if (blockedTarget(event.target)) leaks.push(describe(event.target));
    };
    const onClick = (event) => {
      if (event.isTrusted && blockedTarget(event.target))
        activations.push(describe(event.target));
    };
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('click', onClick, true);
    return {
      outsideCount: outside.length,
      snapshot: () => ({
        activeElement: describe(document.activeElement),
        documentHasFocus: document.hasFocus(),
        modal: dialog.matches(':modal'),
        blockedElementFocused: blockedTarget(document.activeElement),
        leaks: [...leaks],
        activations: [...activations],
      }),
      tryOutsideFocus: () =>
        outside.map((node) => {
          if (node instanceof HTMLElement) node.focus({ preventScroll: true });
          return {
            target: describe(node),
            accepted: document.activeElement === node,
          };
        }),
      stop: () => {
        document.removeEventListener('focusin', onFocus, true);
        document.removeEventListener('click', onClick, true);
      },
    };
  });
  const check = async (phase) => {
    const snapshot = await audit.evaluate((value) => value.snapshot());
    diagnostics.record({ event: 'keyboard-access', phase, ...snapshot });
    if (phase === 'first Tab')
      console.log(`FOCUS after Escape + Tab: ${JSON.stringify(snapshot)}`);
    assert.equal(
      snapshot.modal,
      true,
      'Loading must remain a native modal dialog',
    );
    assert.equal(
      snapshot.blockedElementFocused,
      false,
      `Blocked app element received focus after ${phase}: ${JSON.stringify(snapshot.activeElement)}`,
    );
    assert.deepEqual(
      snapshot.leaks,
      [],
      `Focus reached blocked app content after ${phase}`,
    );
    assert.deepEqual(
      snapshot.activations,
      [],
      `Keyboard activated blocked app content after ${phase}`,
    );
    await expect(overlay).toBeVisible();
    await expect(page).toHaveURL(`${base}/events`);
  };
  try {
    await page.keyboard.press('Escape');
    await check('Escape');
    await page.keyboard.press('Tab');
    await check('first Tab');
    const count = await audit.evaluate((value) => value.outsideCount);
    assert.ok(count > 0, 'The test must exercise existing app controls');
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let step = 0; step < count + 2; step++) {
        await page.keyboard.press(key);
        await check(`${key} ${step + 1}`);
      }
    }
    const trials = await audit.evaluate((value) => value.tryOutsideFocus());
    diagnostics.record({ event: 'blocked-focus-attempts', trials });
    assert.ok(
      trials.every((trial) => !trial.accepted),
      `App controls must reject focus while modal: ${JSON.stringify(trials)}`,
    );
    await check('programmatic focus attempts');
    // Send activation keys to the document, not to browser chrome.
    await overlay.focus();
    for (const key of ['Enter', 'Space']) {
      await page.keyboard.press(key);
      await check(key);
    }
  } finally {
    await audit.evaluate((value) => value.stop());
    await audit.dispose();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const diagnostics = monitor(page);
    let scenario = 'initial slow access';
    const navigate = async (path) => {
      diagnostics.record({
        event: 'goto',
        scenario,
        target: `${base}${path}`,
        waitUntil: 'domcontentloaded',
      });
      // These scenarios intentionally hold API requests. Assert the UI state
      // below instead of waiting for every load-blocking resource to finish.
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(`${base}${path}`);
    };
    await page.clock.install();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const state = {
      me: 'valid',
      meGate: gate(),
      eventGate: gate(),
      formationGate: undefined,
      formStatus: 409,
      meCalls: 0,
      refreshCalls: 0,
      eventsCalls: 0,
      formCalls: 0,
      recovered: false,
    };
    async function waitForGate(name, control) {
      if (!control?.pending) return;
      diagnostics.record({ event: 'mock-wait', gate: name, scenario });
      await control.promise;
      diagnostics.record({ event: 'mock-release', gate: name, scenario });
    }
    try {
      await page.route(`${base}/api/**`, async (route) => {
        const path = new URL(route.request().url()).pathname;
        let status = 200;
        let json;
        if (path === '/api/auth/me') {
          state.meCalls++;
          await waitForGate('me', state.meGate);
          if (state.me === 'network') return route.abort('failed');
          status =
            state.me === 'invalid' ||
            (state.me === 'expired' && !state.recovered)
              ? 401
              : 200;
          json = status === 200 ? { user } : { error: 'Sessão inválida.' };
        } else if (path === '/api/auth/csrf')
          json = { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` };
        else if (path === '/api/auth/refresh') {
          state.refreshCalls++;
          status = state.me === 'invalid' ? 401 : 200;
          state.recovered = status === 200;
          json = status === 200 ? { user } : { error: 'Sessão inválida.' };
        } else if (path.endsWith('/formation')) {
          state.formCalls++;
          await waitForGate('formation', state.formationGate);
          status = state.formStatus;
          json = { error: 'Revise os dados da formação.' };
        } else if (path === '/api/events') {
          state.eventsCalls++;
          await waitForGate('events', state.eventGate);
          json = { items: [event], nextCursor: null };
        } else json = { event, teams: [], waitingParticipants: [] };
        await route.fulfill({ status, json });
      });
      const overlay = page.getByRole('dialog', {
        name: 'carregando',
        exact: true,
      });
      const failure = page.getByRole('dialog', {
        name: 'Falha ao preparar o acesso',
      });
      await navigate('/events');
      await expect(overlay).toBeVisible();
      await expect.poll(() => state.meCalls).toBe(1);
      await expect(overlay.getByRole('status')).toHaveText('carregando');
      const bounds = await overlay.boundingBox();
      assert.deepEqual(bounds, { x: 0, y: 0, ...viewport });
      const ball = overlay.locator('svg');
      const ballBox = await ball.boundingBox();
      const labelBox = await overlay.getByRole('status').boundingBox();
      assert.ok(
        Math.abs(ballBox.x + ballBox.width / 2 - viewport.width / 2) < 1,
      );
      assert.ok(
        Math.abs(
          (ballBox.y + labelBox.y + labelBox.height) / 2 - viewport.height / 2,
        ) < 2,
      );
      assert.equal(
        await ball.evaluate((node) => getComputedStyle(node).animationName),
        'none',
      );
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      assert.notEqual(
        await ball.evaluate((node) => getComputedStyle(node).animationName),
        'none',
      );
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await assertBlockedKeyboardAccess(page, overlay, diagnostics);
      const home = page.locator('a[aria-label="Eventos ativos"]');
      assert.equal(
        await home.evaluate((node) => {
          node.focus();
          return document.activeElement === node;
        }),
        false,
      );
      const homeBounds = await home.boundingBox();
      await page.mouse.click(
        homeBounds.x + homeBounds.width / 2,
        homeBounds.y + homeBounds.height / 2,
      );
      assert.equal(page.url(), `${base}/events`);
      await page.clock.fastForward(20_000);
      await expect(overlay).toBeVisible();
      assert.equal(state.meCalls, 1);
      await page.screenshot({
        path: fileURLToPath(new URL(`${viewport.width}-loading.png`, output)),
      });
      state.meGate.release();
      state.meGate = undefined;
      await expect(overlay).toHaveCount(0);
      // Events are still pending, but navigation and local feedback are available.
      await expect(home).toBeVisible();
      await expect(page.getByText('Carregando eventos...')).toBeVisible();
      state.eventGate.release();
      state.eventGate = undefined;
      await expect(page.getByText(event.name, { exact: true })).toBeVisible();
      scenario = 'local formation';
      await navigate('/org/events');
      await expect(page.getByText(event.name, { exact: true })).toBeVisible();
      await page
        .getByRole('button', { name: 'Formar times', exact: true })
        .click();
      await page.getByRole('spinbutton').fill('5');
      state.formationGate = gate();
      await page.getByRole('button', { name: 'Sortear', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Formando...', exact: true }),
      ).toBeDisabled();
      await expect(overlay).toHaveCount(0);
      // Local busy state precedes CSRF and POST arrival at the mock. Keep the
      // response gated until both the request and its local feedback are ready.
      await expect.poll(() => state.formCalls).toBe(1);
      await expect(
        page.getByRole('button', { name: 'Formando...', exact: true }),
      ).toBeDisabled();
      await expect(overlay).toHaveCount(0);
      state.formationGate.release();
      await expect(
        page.getByText('Revise os dados da formação.'),
      ).toBeVisible();
      await expect(overlay).toHaveCount(0);
      assert.equal(state.formCalls, 1);
      // Initial failure, manual reconnect, finite total deadline, no automatic retry.
      state.me = 'network';
      scenario = 'connection failure and manual retry';
      await navigate('/stats');
      await expect(failure).toBeVisible();
      await expect(
        failure.getByRole('button', { name: 'Tentar novamente' }),
      ).toBeFocused();
      state.me = 'valid';
      state.meGate = gate();
      const beforeRetry = state.meCalls;
      await failure.getByRole('button', { name: 'Tentar novamente' }).click();
      await expect(overlay).toBeVisible();
      await expect.poll(() => state.meCalls).toBe(beforeRetry + 1);
      const attempts = state.meCalls;
      await page.clock.fastForward(75_000);
      await expect(failure).toBeVisible();
      await expect(
        failure.getByRole('button', { name: 'Tentar novamente' }),
      ).toBeFocused();
      await page.clock.fastForward(150_000);
      assert.equal(state.meCalls, attempts);
      state.meGate.release();
      state.meGate = undefined;
      await failure.getByRole('button', { name: 'Tentar novamente' }).click();
      await expect(failure).toHaveCount(0);
      await expect(overlay).toHaveCount(0);
      await expect(page.getByText('Em breve')).toBeVisible();
      // Restore a still-connected app control after an explicit session check.
      scenario = 'focus restoration';
      await home.focus();
      await expect(home).toBeFocused();
      state.meGate = gate();
      await page.evaluate(() => {
        const channel = new BroadcastChannel('patotafut-auth:/api');
        channel.postMessage('session-changed');
        channel.close();
      });
      await expect(overlay).toBeVisible();
      state.meGate.release();
      state.meGate = undefined;
      await expect(overlay).toHaveCount(0);
      await expect(home).toBeFocused();
      // Background visibility reads cannot obstruct a usable screen.
      scenario = 'background validation';
      state.meGate = gate();
      const backgroundCalls = state.meCalls;
      const backgroundFailed = page.waitForEvent(
        'requestfailed',
        (request) => request.url() === `${base}/api/auth/me`,
      );
      await page.evaluate(() =>
        document.dispatchEvent(new Event('visibilitychange')),
      );
      await expect.poll(() => state.meCalls).toBe(backgroundCalls + 1);
      await expect(overlay).toHaveCount(0);
      state.me = 'network';
      state.meGate.release();
      state.meGate = undefined;
      await backgroundFailed;
      await expect(page.getByText('Em breve')).toBeVisible();
      await expect(failure).toHaveCount(0);
      // Expired access refreshes once; invalid session returns to existing login.
      state.me = 'expired';
      scenario = 'expired session';
      state.recovered = false;
      const before = state.refreshCalls;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Em breve')).toBeVisible();
      assert.equal(state.refreshCalls, before + 1);
      state.me = 'invalid';
      scenario = 'invalid session';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(`${base}/`);
      await expect(page.locator('#email')).toBeEnabled();
      await expect(overlay).toHaveCount(0);
      await expect(failure).toHaveCount(0);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${viewport.width}x${viewport.height}: slow wake-up, coverage, focus/keyboard blocking, reduced motion, local events/formation/409, network failure, deadline, manual retry, background read, expired and invalid sessions`,
      );
    } catch (error) {
      const report = {
        viewport,
        scenario,
        error: error instanceof Error ? error.stack : String(error),
        ...diagnostics.snapshot(),
        api: {
          mode: state.me,
          meCalls: state.meCalls,
          refreshCalls: state.refreshCalls,
          eventsCalls: state.eventsCalls,
          formCalls: state.formCalls,
          pendingGates: Object.entries({
            me: state.meGate,
            events: state.eventGate,
            formation: state.formationGate,
          })
            .filter(([, control]) => control?.pending)
            .map(([name]) => name),
        },
      };
      const artifact = new URL(`${viewport.width}-diagnostics.json`, output);
      await writeFile(artifact, JSON.stringify(report, null, 2) + '\n');
      console.error(
        `FAIL ${viewport.width}x${viewport.height}: ${scenario}; final URL: ${report.finalURL}; diagnostics: ${fileURLToPath(artifact)}`,
      );
      console.error(
        JSON.stringify(
          {
            pendingRequests: report.pendingRequests,
            pendingGates: report.api.pendingGates,
            events: report.events,
          },
          null,
          2,
        ),
      );
      throw error;
    } finally {
      state.meGate?.release();
      state.eventGate?.release();
      state.formationGate?.release();
      await context.close();
    }
  }
} finally {
  await browser.close();
}
