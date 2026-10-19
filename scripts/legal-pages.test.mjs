// Read-only HTTP verification against an already running local Next production server.
import assert from 'node:assert/strict';
const base = new URL(
  process.env.LEGAL_TEST_BASE_URL ?? 'http://127.0.0.1:3106',
);
if (!['127.0.0.1', 'localhost'].includes(base.hostname))
  throw new Error('Use only a local test server.');
const pages = [
  {
    path: '/privacidade',
    title: 'Política de Privacidade',
    anchor: 'exclusao',
  },
  { path: '/termos', title: 'Termos de Uso', anchor: 'perfis' },
];
for (const page of pages) {
  // No Cookie or Authorization. A stale cookie must not turn a public route into a session gate.
  for (const cookie of [undefined, 'patotafut_access=expired-fixture']) {
    const response = await fetch(new URL(page.path, base), {
      redirect: 'manual',
      headers: cookie ? { Cookie: cookie } : {},
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('set-cookie'), null);
    const html = await response.text();
    assert.ok(html.includes(`<title>${page.title} | PatotaFUT</title>`));
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.ok(
      html.includes(`href="https://patota-fut-bice.vercel.app${page.path}"`),
    );
    assert.match(
      html,
      /<main[^>]*tabindex="0"[^>]*aria-labelledby="legal-title"/,
    );
    assert.ok(
      html.includes('dateTime="2026-10-19"') ||
        html.includes('datetime="2026-10-19"'),
    );
    assert.ok(html.includes(`href="#${page.anchor}"`));
    assert.ok(html.includes(`id="${page.anchor}"`));
    assert.ok(html.includes('href="mailto:patotafut@gmail.com"'));
    for (const link of pages) assert.ok(html.includes(`href="${link.path}"`));
    assert.ok(
      !/AUTH_ACCESS_SECRET|AUTH_REFRESH_SECRET|MAIL_GOOGLE_REFRESH_TOKEN|mongodb\+srv:\/\//.test(
        html,
      ),
    );
  }
  console.log(
    `PASS public direct access without login and with stale cookie: ${page.path}, metadata, anchors, contact, no auth redirects/cookies`,
  );
}
const login = await fetch(base, { redirect: 'manual' });
assert.equal(login.status, 200);
const html = await login.text();
for (const page of pages) assert.ok(html.includes(`href="${page.path}"`));
assert.ok(html.includes('PatotaFUT organiza o futebol do grupo'));
console.log(
  'PASS public login: both legal links and app description in initial HTML',
);
