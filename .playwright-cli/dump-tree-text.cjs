const { chromium } = require('playwright');
async function dump(page, label) {
  const text = await page.locator('.api-directory-tree').innerText().catch(e => String(e));
  console.log(`--- ${label} ---`);
  console.log(text.slice(0, 5000));
}
async function clickNodeByText(page, text) {
  const nodes = page.locator('.api-directory-node');
  const count = await nodes.count();
  for (let i = 0; i < count; i += 1) {
    const nodeText = await nodes.nth(i).innerText().catch(() => '');
    if (nodeText.includes(text)) {
      console.log('click', i, JSON.stringify(nodeText));
      await nodes.nth(i).click();
      return;
    }
  }
  throw new Error(`Node not found: ${text}`);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto('http://localhost:4173/login', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('用户名').fill('superadmin');
  await page.getByPlaceholder('密码').fill('superadmin123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/config-center|automation\/api/, { timeout: 15000 });
  await page.goto('http://localhost:4173/automation/api/interfaces', { waitUntil: 'networkidle' });
  await page.waitForSelector('.api-directory-tree', { timeout: 15000 });
  await dump(page, 'initial');
  await clickNodeByText(page, 'X-MAN');
  await page.waitForTimeout(500);
  await dump(page, 'after X-MAN');
  await clickNodeByText(page, '测试');
  await page.waitForTimeout(800);
  await dump(page, 'after 测试');
  const nodes = await page.locator('.api-directory-node').evaluateAll(nodes => nodes.map((node, index) => ({ index, text: node.textContent || '' })).slice(0, 120));
  console.log(JSON.stringify(nodes, null, 2));
  await browser.close();
})();
