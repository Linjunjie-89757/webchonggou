const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4173/login', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('用户名').fill('superadmin');
  await page.getByPlaceholder('密码').fill('superadmin123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/config-center|automation\/api/, { timeout: 15000 });
  await page.goto('http://localhost:4173/automation/api/interfaces', { waitUntil: 'networkidle' });
  await page.waitForSelector('.api-directory-tree', { timeout: 15000 });
  console.log(await page.locator('.api-directory-tree').evaluate(el => el.outerHTML.slice(0, 8000)));
  await browser.close();
})();
