// Real Next/Chromium; API responses are simulated. Optional external DATE_ENTRY_TEST_URL.
import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

const base = process.env.DATE_ENTRY_TEST_URL ?? 'http://localhost:3106';
const id = '507f1f77bcf86cd799439011';
const user = {
  id,
  email: 'date@example.invalid',
  firstName: 'Date',
  lastName: 'Test',
  role: 'ORGANIZER',
};
const event = {
  id,
  name: 'Date test',
  date: '2026-10-15',
  startTime: '20:00',
  endTime: '21:30',
  status: 'ACTIVE',
  revision: 1,
  confirmedCount: 0,
  waitingCount: 0,
  playersPerTeam: null,
  formationExists: false,
  ownPresence: null,
  ownAllocated: false,
  ownParticipantId: null,
};
const server = process.env.DATE_ENTRY_TEST_URL
  ? undefined
  : spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'start',
        '--port',
        '3106',
        '--hostname',
        '127.0.0.1',
      ],
      {
        windowsHide: true,
        env: { ...process.env, API_URL: 'http://127.0.0.1:9' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
let startup = '',
  browser;
for (const stream of [server?.stdout, server?.stderr])
  stream?.on('data', (chunk) => {
    startup = (startup + chunk).slice(-5000);
  });
try {
  await expect
    .poll(
      async () => {
        if (server && server.exitCode !== null) throw new Error(startup);
        try {
          return (await fetch(`${base}/org/events`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    for (const timezoneId of ['America/Sao_Paulo', 'Pacific/Kiritimati']) {
      const context = await browser.newContext({
        viewport,
        timezoneId,
        hasTouch: viewport.width < 1000,
      });
      try {
        const page = await context.newPage();
        await page.clock.setFixedTime(new Date('2026-10-18T02:30:00Z'));
        const writes = [];
        await page.route(`${base}/api/**`, async (route) => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          let json = { event, teams: [], waitingParticipants: [] };
          if (path === '/api/auth/me') json = { user };
          else if (path === '/api/auth/csrf')
            json = { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` };
          else if (request.method() === 'POST') {
            const body = request.postDataJSON();
            writes.push({ path, body });
            json = {
              event: { ...event, ...body },
              teams: [],
              waitingParticipants: [],
            };
          } else if (path === '/api/events')
            json = { items: [event], nextCursor: null };
          await route.fulfill({ json });
        });
        await page.goto(`${base}/org/events`, {
          waitUntil: 'domcontentloaded',
        });
        await page
          .getByRole('button', { name: 'Criar evento', exact: true })
          .click();
        const date = page.locator('input[name="date"]');
        const error = page.locator('#event-date-error');
        await expect(date).toHaveAttribute('type', 'text');
        await expect(date).toHaveAttribute('inputmode', 'numeric');
        await date.pressSequentially('15102026');
        await expect(date).toHaveValue('15/10/2026');
        await date.evaluate((node) => node.setSelectionRange(3, 5));
        await date.pressSequentially('12');
        await expect(date).toHaveValue('15/12/2026');
        await expect
          .poll(() => date.evaluate((node) => node.selectionStart))
          .toBe(5);
        await date.evaluate((node) => node.setSelectionRange(3, 3));
        await date.press('Backspace');
        await expect(date).toHaveValue('11/22/026');
        // Insert via the browser's editing command, with paste input semantics.
        for (const pasted of ['15102026', '15/10/2026']) {
          await date.fill('');
          await date.evaluate((node, text) => {
            node.focus();
            document.execCommand('insertText', false, text);
          }, pasted);
          await expect(date).toHaveValue('15/10/2026');
        }
        await page.locator('input[name="name"]').fill('Date test');
        await page.locator('input[name="startTime"]').fill('20:00');
        await page.locator('input[name="endTime"]').fill('21:30');
        for (const invalid of ['1510202', '31042026', '29021900', '29022026']) {
          await date.fill(invalid);
          await expect(error).toHaveCount(0);
          await page
            .getByRole('button', { name: 'Confirmar', exact: true })
            .click();
          await expect(error).toBeVisible();
          expect(writes).toHaveLength(0);
        }
        await date.fill('16102026');
        await page
          .getByRole('button', { name: 'Confirmar', exact: true })
          .click();
        await expect(error).toHaveText(
          'A data do evento deve ser hoje ou uma data futura.',
        );
        expect(writes).toHaveLength(0);
        await date.fill('29022028');
        await expect(error).toHaveCount(0);
        await page
          .getByRole('button', { name: 'Confirmar', exact: true })
          .click();
        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0]).toEqual({
          path: '/api/events',
          body: {
            name: 'Date test',
            date: '2028-02-29',
            startTime: '20:00',
            endTime: '21:30',
          },
        });
        await page.goto(`${base}/org/events/${id}`, {
          waitUntil: 'domcontentloaded',
        });
        await page.getByRole('button', { name: 'Editar', exact: true }).click();
        await expect(date).toHaveValue('15/10/2026');
        await date.fill('16102026');
        await page
          .getByRole('button', { name: 'Confirmar', exact: true })
          .click();
        await expect(error).toBeVisible();
        expect(writes).toHaveLength(1);
        await date.fill('15102026');
        await page
          .getByRole('button', { name: 'Confirmar', exact: true })
          .click();
        await expect.poll(() => writes.length).toBe(2);
        expect(writes[1].body.date).toBe('2026-10-15');
        await page.getByRole('button', { name: 'Editar', exact: true }).click();
        await date.fill('31122026');
        await page
          .getByRole('button', { name: 'Confirmar', exact: true })
          .click();
        await expect.poll(() => writes.length).toBe(3);
        expect(writes[2].path).toBe(`/api/events/${id}/edit`);
        expect(writes[2].body.date).toBe('2026-12-31');
        expect(writes[2].body.revision).toBe(1);
        for (const day of ['17102026', '18102026']) {
          await page.goto(`${base}/org/events`);
          await page
            .getByRole('button', { name: 'Criar evento', exact: true })
            .click();
          await page.locator('input[name="name"]').fill('Date test');
          await page.locator('input[name="startTime"]').fill('00:00');
          await page.locator('input[name="endTime"]').fill('00:01');
          await date.fill(day);
          const count = writes.length;
          await page
            .getByRole('button', { name: 'Confirmar', exact: true })
            .click();
          await expect.poll(() => writes.length).toBe(count + 1);
          expect(writes.at(-1).body.date).toBe(
            day === '17102026' ? '2026-10-17' : '2026-10-18',
          );
        }
        // A form left open across Sao Paulo midnight must use the day at submit.
        await page.goto(`${base}/org/events`);
        await page
          .getByRole('button', { name: 'Criar evento', exact: true })
          .click();
        await page.locator('input[name="name"]').fill('Midnight test');
        await page.locator('input[name="startTime"]').fill('20:00');
        await page.locator('input[name="endTime"]').fill('21:00');
        await date.fill('17102026');
        await page.clock.setFixedTime(new Date('2026-10-18T03:00:00.000Z'));
        const count = writes.length;
        await page
          .getByRole('button', { name: 'Confirmar', exact: true })
          .click();
        await expect(error).toHaveText(
          'A data do evento deve ser hoje ou uma data futura.',
        );
        expect(writes).toHaveLength(count);
        await date.fill('18102026');
        await page
          .getByRole('button', { name: 'Confirmar', exact: true })
          .click();
        await expect.poll(() => writes.length).toBe(count + 1);
        expect(writes.at(-1).body.date).toBe('2026-10-18');
        console.log(
          `PASS date entry ${viewport.width}x${viewport.height} ${timezoneId}`,
        );
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser?.close();
  server?.kill();
}
