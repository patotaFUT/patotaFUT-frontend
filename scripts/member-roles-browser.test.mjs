// Local Next UI, fixture-only identities/API; no real account, secret or production request.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const base = 'http://127.0.0.1:3111';
const output = new URL('../.test-build/member-roles/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const id = (n) => n.toString(16).padStart(24, '0');
async function fixture(viewport) {
  const context = await browser.newContext({ viewport }),
    page = await context.newPage();
  const state = {
    own: {
      id: id(1),
      firstName: 'Pessoa',
      lastName: 'Organizadora',
      email: 'own@example.invalid',
      role: 'ORGANIZER',
    },
    members: [
      {
        id: id(1),
        firstName: 'Pessoa',
        lastName: 'Organizadora',
        role: 'ORGANIZER',
      },
      { id: id(2), firstName: 'Nome', lastName: 'Integrante', role: 'PLAYER' },
      {
        id: id(3),
        firstName: 'Outra',
        lastName: 'Organizadora',
        role: 'ORGANIZER',
      },
    ],
    writes: [],
    conflict: false,
    errors: [],
  };
  page.on('pageerror', (error) => state.errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace('/api', ''),
      body = request.postDataJSON();
    let status = 200,
      data = {};
    if (path === '/auth/csrf')
      data = { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` };
    else if (path === '/auth/me') data = { user: state.own };
    else if (path === '/account/preferences')
      data = { googleLinked: true, localCredentials: false };
    else if (path === '/account/members')
      data = { items: state.members, nextCursor: null };
    else if (path.endsWith('/role')) {
      state.writes.push({ path, body });
      const member = state.members.find((m) => path.includes(m.id));
      if (state.conflict) {
        state.conflict = false;
        member.role = 'PLAYER';
        status = 409;
        data = {
          error:
            'A função do integrante mudou. Confira a listagem e confirme novamente.',
        };
      } else {
        member.role = body.role;
        if (member.id === state.own.id) state.own.role = body.role;
        data = { member };
      }
    } else if (path.endsWith('/delete')) {
      state.writes.push({ path, body });
      await new Promise((resolve) => setTimeout(resolve, 350));
      state.members = state.members.filter((m) => !path.includes(m.id));
      data = { message: 'Conta removida.' };
    } else {
      status = 404;
      data = { error: 'Fixture sem rota.' };
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  return { context, page, state };
}
async function red(button) {
  await expect(button).toHaveCSS('background-color', 'rgb(220, 38, 38)');
  await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
}
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const { context, page, state } = await fixture(viewport);
    await page.goto(base + '/org');
    for (let n = 0; n < 3; n++) {
      // SPA navigation loads both route CSS sets in both orders; no page.reload/goto here.
      await page
        .getByRole('link', { name: 'Integrantes', exact: true })
        .click();
      const remove = page.getByRole('button', {
        name: 'Excluir conta de Nome Integrante',
        exact: true,
      });
      await red(remove);
      await remove.hover();
      await red(remove);
      await remove.focus();
      await red(remove);
      assert.ok(!(await page.getByRole('main').innerText()).includes('@'));
      await remove.click();
      const confirm = page
        .getByRole('dialog')
        .getByRole('button', { name: 'Excluir conta', exact: true });
      await red(confirm);
      await expect(page.getByRole('dialog')).not.toContainText('@');
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: 'Voltar', exact: true }).click();
      await page
        .getByRole('link', { name: 'Preferências', exact: true })
        .click();
      const ownDelete = page.getByRole('button', {
        name: 'Excluir minha conta',
      });
      await red(ownDelete);
      await ownDelete.click();
      await red(
        page
          .getByRole('dialog')
          .getByRole('button', { name: 'Excluir conta', exact: true }),
      );
      await page.keyboard.press('Escape');
      await page.mouse.move(0, 0);
      await expect(
        page.getByRole('button', { name: 'Salvar dados pessoais' }),
      ).toHaveCSS('background-color', 'rgb(22, 101, 52)');
      await page.getByRole('link', { name: 'Voltar', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Integrantes', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Nova função de Nome Integrante' })
      .selectOption('ADMIN');
    const edit = page.getByRole('button', {
      name: 'Alterar função de Nome Integrante',
    });
    await edit.click();
    await expect(page.getByRole('dialog')).toContainText('Jogador');
    await expect(page.getByRole('dialog')).toContainText('Administrador');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancelar', exact: true })
      .click();
    assert.equal(state.writes.length, 0);
    await edit.click();
    await page.getByRole('button', { name: 'Confirmar alteração' }).click();
    await expect(page.getByRole('status')).toContainText(
      'alterada para Administrador',
    );
    assert.deepEqual(state.writes.at(-1).body, {
      confirmed: true,
      role: 'ADMIN',
      expectedRole: 'PLAYER',
    });
    state.conflict = true;
    await page
      .getByRole('combobox', { name: 'Nova função de Nome Integrante' })
      .selectOption('ORGANIZER');
    await edit.click();
    await page.getByRole('button', { name: 'Confirmar alteração' }).click();
    await expect(page.getByRole('alert')).toContainText('mudou');
    assert.equal(state.writes.length, 2);
    await expect(
      page.getByRole('combobox', { name: 'Nova função de Nome Integrante' }),
    ).toHaveValue('PLAYER');
    await page
      .getByRole('button', {
        name: 'Excluir conta de Nome Integrante',
        exact: true,
      })
      .click();
    const confirm = page
      .getByRole('dialog')
      .getByRole('button', { name: 'Excluir conta', exact: true });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await red(confirm);
    await expect(page.getByText('Conta removida.')).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Nova função de Pessoa Organizadora' })
      .selectOption('ADMIN');
    await page
      .getByRole('button', { name: 'Alterar função de Pessoa Organizadora' })
      .click();
    await page.getByRole('button', { name: 'Confirmar alteração' }).click();
    await expect(
      page.getByText('Você não tem permissão para acessar esta área.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Voltar', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Integrantes', exact: true }),
    ).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      doc: document.documentElement.scrollWidth,
      height: innerHeight,
      body: document.body.scrollHeight,
    }));
    assert.ok(
      dimensions.doc <= dimensions.width &&
        dimensions.body <= dimensions.height,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`roles-${viewport.width}.png`, output)),
    });
    assert.deepEqual(state.errors, []);
    console.log(
      `PASS SPA CSS order, red hover/focus/processing, no emails, explicit role confirmation/conflicts/self-demotion: ${viewport.width}px`,
    );
    await context.close();
  }
  const { context, page, state } = await fixture({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto(base + '/org/members');
  await expect(page.getByText('Nome Integrante')).toBeVisible();
  state.own.role = 'PLAYER';
  await page.clock.fastForward(30001);
  await expect(
    page.getByText('Você não tem permissão para acessar esta área.'),
  ).toBeVisible();
  await context.close();
  console.log(
    'PASS remote role change updates visible tab through the session probe, without reload',
  );
} finally {
  await browser.close();
}
