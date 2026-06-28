const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4173/login', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('用户名').fill('superadmin');
  await page.getByPlaceholder('密码').fill('superadmin123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/config-center|automation\/api/, { timeout: 15000 });
  const data = await page.evaluate(async () => {
    const candidates = ['/api/workspaces', '/api/settings/workspaces', 'http://localhost:8080/api/workspaces', 'http://localhost:8080/api/settings/workspaces'];
    const out = [];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        out.push({ url, status: res.status, text: (await res.text()).slice(0, 1000) });
      } catch (e) { out.push({ url, error: String(e) }); }
    }
    return out;
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
