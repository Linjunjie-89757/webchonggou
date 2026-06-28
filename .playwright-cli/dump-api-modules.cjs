const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4173/login', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('用户名').fill('superadmin');
  await page.getByPlaceholder('密码').fill('superadmin123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/config-center|automation\/api/, { timeout: 15000 });
  const modules = await page.evaluate(async () => {
    const res = await fetch('http://localhost:8080/api/automation/api/definition-modules', { credentials: 'include', headers: { 'X-Workspace-Code': 'account-open' }});
    return await res.json();
  });
  console.log(JSON.stringify(modules, null, 2).slice(0, 12000));
  await browser.close();
})();
