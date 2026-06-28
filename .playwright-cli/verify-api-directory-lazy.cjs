const { chromium } = require('playwright');
const path = require('path');

async function clickNodeByText(page, text, exact = false) {
  const nodes = page.locator('.api-directory-node');
  const count = await nodes.count();
  for (let i = 0; i < count; i += 1) {
    const nodeText = await nodes.nth(i).innerText().catch(() => '');
    if (exact ? nodeText.trim() === text : nodeText.includes(text)) {
      await nodes.nth(i).click();
      return { index: i, text: nodeText };
    }
  }
  throw new Error(`Node not found: ${text}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  const requests = [];
  page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
  await page.route('**/api/automation/api/definitions?moduleId=*', async route => {
    requests.push(route.request().url());
    await page.waitForTimeout(1500);
    await route.continue();
  });

  await page.goto('http://localhost:4173/login', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('用户名').fill('superadmin');
  await page.getByPlaceholder('密码').fill('superadmin123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/config-center|automation\/api/, { timeout: 15000 });
  await page.goto('http://localhost:4173/automation/api/interfaces', { waitUntil: 'networkidle' });
  await page.waitForSelector('.api-directory-tree', { timeout: 15000 });

  await clickNodeByText(page, 'X-MAN');
  await page.waitForTimeout(300);
  await clickNodeByText(page, '测试');
  await page.waitForTimeout(300);
  const target = await clickNodeByText(page, '订单->退款单');

  await page.waitForTimeout(250);
  const duringText = await page.locator('.api-directory-tree').innerText();
  const duringHasLoading = duringText.includes('加载接口中');
  const duringShot = path.resolve('.playwright-cli/api-directory-loading-during.png');
  await page.screenshot({ path: duringShot, fullPage: false });

  await page.waitForTimeout(2200);
  const afterText = await page.locator('.api-directory-tree').innerText();
  const afterHasLoading = afterText.includes('加载接口中');
  const afterHasRefundRequest = afterText.includes('退款') || afterText.includes('DELETE') || afterText.includes('POST') || afterText.includes('GET');
  const afterShot = path.resolve('.playwright-cli/api-directory-loading-after.png');
  await page.screenshot({ path: afterShot, fullPage: false });

  console.log(JSON.stringify({
    target,
    requests,
    duringHasLoading,
    afterHasLoading,
    afterHasRefundRequest,
    duringText: duringText.slice(0, 1800),
    afterText: afterText.slice(0, 1800),
    duringShot,
    afterShot,
    logs: logs.slice(-20),
  }, null, 2));
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
