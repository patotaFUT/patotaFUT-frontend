// Real Chromium/Next UI; intercepted API fixtures, no real messages or accounts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const base = 'http://127.0.0.1:3110';
const external = process.env.ACCOUNTS_BROWSER_EXTERNAL === 'true';
const server = external
  ? undefined
  : spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'start',
        '--port',
        '3110',
        '--hostname',
        '127.0.0.1',
      ],
      {
        windowsHide: true,
        stdio: 'pipe',
        env: { ...process.env, API_URL: 'http://127.0.0.1:9' },
      },
    );
let output = '',
  browser;
for (const stream of server ? [server.stdout, server.stderr] : [])
  stream.on('data', (chunk) => {
    output = (output + chunk).slice(-5000);
  });
const artifacts = '.test-build/accounts-browser';
await mkdir(artifacts, { recursive: true });
async function layout(page) {
  const metrics = await page.evaluate(() => {
    const main = document.getElementById('events-main');
    return {
      w: innerWidth,
      h: innerHeight,
      dw: document.documentElement.scrollWidth,
      dh: document.documentElement.scrollHeight,
      mw: main.clientWidth,
      ms: main.scrollWidth,
    };
  });
  assert.ok(
    metrics.dw <= metrics.w &&
      metrics.dh <= metrics.h &&
      metrics.ms <= metrics.mw,
    JSON.stringify(metrics),
  );
}
async function fixture(viewport, role, googleLinked = false) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const state = {
    user: {
      id: '507f1f77bcf86cd799439011',
      email: 'fixture@example.invalid',
      firstName: 'Nome',
      lastName: 'Fixture',
      role,
    },
    authenticated: true,
    deleted: 0,
    blocked: true,
    calls: [],
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace('/api', '');
    let status = 200,
      data = {};
    const body = request.postDataJSON();
    if (request.method() === 'POST') state.calls.push({ path, body });
    if (path === '/auth/csrf') data = { csrfToken: 'fixture-csrf' };
    else if (path === '/auth/me') {
      status = state.authenticated ? 200 : 401;
      data = state.authenticated
        ? { user: state.user }
        : { error: 'Autenticação necessária.' };
    } else if (path === '/account/preferences')
      data = { googleLinked, localCredentials: !googleLinked };
    else if (path === '/account/preferences/names') {
      state.user = { ...state.user, ...body };
      data = { user: state.user };
    } else if (path === '/account/preferences/email/request') {
      status = 202;
      data = { challengeId: 'a'.repeat(64), expiresIn: 600, resendAfter: 60 };
    } else if (
      path === '/account/preferences/email/confirm' ||
      path === '/account/preferences/password'
    ) {
      state.authenticated = false;
      data = {
        message: path.includes('email')
          ? 'E-mail alterado.'
          : 'Senha alterada.',
      };
    } else if (path === '/account/preferences/delete') {
      if (state.blocked) {
        status = 409;
        data = {
          error:
            'Cancele a presença nos eventos ativos. Procure um Administrador ou Organizador se estiver alocado.',
        };
      } else {
        state.deleted++;
        state.authenticated = false;
        data = { message: 'Conta excluída.' };
      }
    } else if (path === '/account/members')
      data = {
        items: [
          {
            id: '507f1f77bcf86cd799439012',
            firstName: 'Alvo',
            lastName: 'Fixture',
            email: 'target@example.invalid',
            role: 'PLAYER',
          },
        ],
        nextCursor: null,
      };
    else if (path.includes('/account/members/'))
      data = { message: 'Conta removida.' };
    else if (path === '/events') data = { items: [], nextCursor: null };
    else {
      status = 404;
      data = { error: 'Fixture sem rota.' };
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  page.on('pageerror', (error) => {
    throw error;
  });
  return { page, context, state };
}
try {
  await expect
    .poll(
      async () => {
        if (server && server.exitCode !== null) throw new Error(output);
        try {
          return (await fetch(base + '/org')).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
  browser = external
    ? await chromium.connectOverCDP('http://127.0.0.1:9224')
    : await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
    { width: 844, height: 390 },
  ]) {
    const f = await fixture(viewport, 'PLAYER');
    const { page } = f;
    await page.goto(base + '/org');
    await expect(
      page.getByRole('link', { name: 'Preferências', exact: true }),
    ).toBeVisible();
    for (const label of ['Integrantes', 'Súmulas'])
      await expect(
        page.getByRole('link', { name: label, exact: true }),
      ).toHaveCount(0);
    await page.getByRole('link', { name: 'Preferências', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Dados pessoais' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enviar código', exact: true }),
    ).toBeVisible();
    await layout(page);
    const input = page.getByRole('textbox', { name: 'Nome', exact: true });
    await input.fill('Novo');
    await input.focus();
    const focus = await input.evaluate((node) => {
      const s = getComputedStyle(node),
        parent = getComputedStyle(node.parentElement);
      return {
        border: s.borderWidth,
        outline: s.outlineWidth,
        shadow: s.boxShadow,
        parentBorder: parent.borderWidth,
        background: parent.backgroundColor,
      };
    });
    assert.equal(focus.border, '0px');
    assert.equal(focus.outline, '0px');
    assert.equal(focus.shadow, 'none');
    assert.notEqual(focus.parentBorder, '0px');
    assert.equal(focus.background, 'rgb(241, 245, 249)');
    await page.getByRole('button', { name: 'Salvar dados pessoais' }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Dados pessoais atualizados.' }),
    ).toBeVisible();
    assert.equal(f.state.user.firstName, 'Novo');
    await page.screenshot({
      path: `${artifacts}/preferences-${viewport.width}.png`,
    });
    await page.getByRole('button', { name: 'Excluir minha conta' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toContainText(
      'Tem certeza de que deseja excluir sua conta? Você perderá o acesso, seus dados pessoais serão removidos e você deixará de aparecer nos rankings. Esta ação não pode ser desfeita.',
    );
    assert.ok(!/preserv|partidas/i.test(await modal.innerText()));
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(f.state.deleted, 0);
    await expect(
      page.getByRole('button', { name: 'Excluir minha conta' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Excluir minha conta' }).click();
    await modal
      .getByRole('button', { name: 'Excluir conta', exact: true })
      .click();
    await expect(modal.getByRole('alert')).toContainText('Cancele a presença');
    f.state.blocked = false;
    await modal
      .getByRole('button', { name: 'Excluir conta', exact: true })
      .click();
    await expect(page).toHaveURL(/notice=account-deleted/);
    await expect(
      page.getByRole('status').filter({ hasText: 'Conta excluída.' }),
    ).toBeVisible();
    const deletions = f.state.calls.filter((c) => c.path.endsWith('/delete'));
    assert.ok(
      deletions.every((c) => Object.keys(c.body).join() === 'confirmed'),
    );
    await f.context.close();
  }
  for (const role of ['PLAYER', 'ADMIN', 'ORGANIZER']) {
    const f = await fixture({ width: 390, height: 844 }, role, true);
    await f.page.goto(base + '/org/preferences');
    await expect(
      f.page.getByText(
        'O e-mail não pode ser alterado porque esta conta está vinculada ao Google.',
      ),
    ).toBeVisible();
    await expect(
      f.page.getByText(
        'A senha não pode ser alterada porque esta conta está vinculada ao Google.',
      ),
    ).toBeVisible();
    await expect(
      f.page.getByRole('button', { name: 'Salvar dados pessoais' }),
    ).toBeVisible();
    await expect(
      f.page.getByRole('button', { name: 'Enviar código' }),
    ).toHaveCount(0);
    await f.page.goto(base + '/org/members');
    if (role === 'ORGANIZER') {
      await expect(f.page.getByText('Alvo Fixture')).toBeVisible();
      await f.page
        .getByRole('button', { name: 'Excluir conta', exact: true })
        .click();
      await expect(f.page.getByRole('dialog')).toContainText('Alvo Fixture');
      await f.page
        .getByRole('dialog')
        .getByRole('button', { name: 'Excluir conta', exact: true })
        .click();
      await expect(f.page.getByText('Conta removida.')).toBeVisible();
    } else {
      await expect(
        f.page.getByText('Você não tem permissão para acessar esta área.'),
      ).toBeVisible();
      assert.ok(!f.state.calls.some((c) => c.path.includes('/members')));
    }
    if (role === 'PLAYER')
      for (const path of ['/org/events', '/org/matches']) {
        await f.page.goto(base + path);
        await expect(f.page.getByText(/Você não tem permissão/)).toBeVisible();
      }
    await f.context.close();
  }
  const f = await fixture({ width: 1440, height: 900 }, 'ADMIN');
  await f.page.goto(base + '/org/preferences');
  await f.page
    .getByLabel('Novo e-mail', { exact: true })
    .fill('new@example.invalid');
  await f.page
    .getByLabel('Senha atual', { exact: true })
    .first()
    .fill('fixture password');
  await f.page
    .getByRole('button', { name: 'Enviar código', exact: true })
    .click();
  await expect(
    f.page.getByRole('button', { name: 'Reenviar código' }),
  ).toBeDisabled();
  await expect(
    f.page.getByText('E-mail atual: fixture@example.invalid'),
  ).toBeVisible();
  await f.page.getByLabel('Código de 8 dígitos').fill('00001234');
  await f.page.getByRole('button', { name: 'Confirmar novo e-mail' }).click();
  await expect(f.page).toHaveURL(/notice=email-changed/);
  assert.equal(
    f.state.calls.find((c) => c.path.endsWith('/email/confirm')).body.code,
    '00001234',
  );
  await f.context.close();
  console.log(
    'PASS RN111–119 + exclusão: Chromium, 4 viewports, 3 roles, forms, modals, focus, anonymous login feedback and internal scrolling. API fixtures only.',
  );
} finally {
  await browser?.close();
  server?.kill();
}
