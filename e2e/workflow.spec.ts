import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function choose(page: Page, label: string, text: string, index = 0) {
  await page.getByRole('combobox', { name: new RegExp(`^(?:\\*\\s*)?${label}$`) }).nth(index).press('ArrowDown');
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
}
test('元数据 → 行为维度/指标 → 混合人群 → 保存回显 → 复制与保护', async ({ page, request }, testInfo) => {
  const suffix = randomUUID().slice(0, 8);
  const cleanups: string[] = [];
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  const createAndCapture = async (path: string, action: () => Promise<void>) => {
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/api/v1${path}`) && response.request().method() === 'POST', { timeout: 15000 }),
      action(),
    ]);
    expect(response.status()).toBe(201);
    const result = await response.json();
    cleanups.push(`${path}/${result.data.id}`);
    return result.data;
  };
  try {
    await page.goto('/metadata/tags/new');
    await page.getByLabel('名称', { exact: true }).fill(`会员等级 ${suffix}`);
    await page.getByLabel('字段名称', { exact: true }).fill(`member_${suffix}`);
    await page.getByRole('switch').click();
    const tag = await createAndCapture('/metadata', () => page.getByRole('button', { name: '保存基础信息' }).click());
    await page.getByRole('button', { name: '新增枚举值' }).click();
    await page.getByLabel('值名称', { exact: true }).fill('金卡');
    await page.getByLabel('值编码', { exact: true }).fill('GOLD');
    await createAndCapture(`/metadata/${tag.id}/enum-values`, () => page.getByRole('button', { name: /^保\s*存$/ }).click());
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/metadata/attributes/new');
    await page.getByLabel('名称', { exact: true }).fill(`年龄 ${suffix}`);
    await page.getByLabel('字段名称', { exact: true }).fill(`age_${suffix}`);
    await choose(page, '数据类型', 'Number');
    await createAndCapture('/metadata', () => page.getByRole('button', { name: '保存基础信息' }).click());

    await page.goto('/metadata/events/new');
    await page.getByLabel('行为名称', { exact: true }).fill(`商品购买 ${suffix}`);
    await page.getByLabel('行为编码', { exact: true }).fill(`purchase_${suffix}`);
    const event = await createAndCapture('/event-models', () => page.getByRole('button', { name: '保存基础信息' }).click());
    await page.getByRole('button', { name: '新增维度' }).click();
    await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('商品分类');
    await page.getByRole('dialog').getByLabel('字段名称', { exact: true }).fill('category');
    await page.getByRole('dialog').getByRole('switch').click();
    const dimension = await createAndCapture(`/event-models/${event.id}/dimensions`, () => page.getByRole('dialog').getByRole('button', { name: /^保\s*存$/ }).click());
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: '枚举值', exact: true }).click();
    await page.getByRole('button', { name: '新增枚举值' }).click();
    await page.getByLabel('值名称', { exact: true }).fill('数码产品');
    await page.getByLabel('值编码', { exact: true }).fill('DIGITAL');
    await createAndCapture(`/event-models/${event.id}/dimensions/${dimension.id}/values`, () => page.getByRole('button', { name: /^保\s*存$/ }).click());
    await page.locator('.ant-drawer-close').click();
    await page.getByRole('button', { name: '新增维度' }).click();
    await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('品牌');
    await page.getByRole('dialog').getByLabel('字段名称', { exact: true }).fill('brand');
    await createAndCapture(`/event-models/${event.id}/dimensions`, () => page.getByRole('dialog').getByRole('button', { name: /^保\s*存$/ }).click());
    for (const [name, code] of [['购买金额', 'amount'], ['购买数量', 'quantity']]) {
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.getByRole('button', { name: '新增指标' }).click();
      await page.getByLabel('指标名称', { exact: true }).fill(name);
      await page.getByRole('dialog').getByLabel('字段名称', { exact: true }).fill(code);
      await createAndCapture(`/event-models/${event.id}/metrics`, () => page.getByRole('dialog').getByRole('button', { name: /^保\s*存$/ }).click());
    }
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/audiences/new');
    await page.getByLabel('人群名称', { exact: true }).fill(`高价值用户 ${suffix}`);
    await page.getByLabel('人群编码', { exact: true }).fill(`audience_${suffix}`);
    const addRule = async (type: string, group = 0) => {
      await page.getByRole('button', { name: '添加规则', exact: true }).nth(group).click();
      await page.getByRole('menuitem', { name: type, exact: true }).click();
    };
    await addRule('标签');
    await choose(page, '选择字段', `会员等级 ${suffix}`);
    await choose(page, '规则值', '金卡');
    await addRule('属性');
    await choose(page, '选择字段', `年龄 ${suffix}`, 1);
    await choose(page, '操作符', '大于', 1);
    await page.getByRole('spinbutton', { name: '规则值', exact: true }).fill('25');
    await addRule('行为模型');
    await expect(page.getByRole('button', { name: '添加维度条件' })).not.toBeVisible();
    await choose(page, '选择行为模型', `商品购买 ${suffix}`);
    await expect(page.getByRole('button', { name: '添加维度条件' })).not.toBeVisible();
    await page.getByRole('spinbutton', { name: '最近天数' }).fill('30');
    await page.getByRole('button', { name: '添加维度条件' }).click();
    await choose(page, '选择维度', '商品分类');
    await choose(page, '规则值', '数码产品', 1);
    await choose(page, '聚合方式', 'SUM · 指标求和');
    await choose(page, '选择指标', '购买金额');
    await page.getByRole('spinbutton', { name: '规则值', exact: true }).nth(1).fill('1000');
    await page.getByRole('button', { name: '添加 OR 规则组' }).click();
    await addRule('属性', 1);
    await choose(page, '选择字段', `年龄 ${suffix}`, 2);
    await page.getByRole('spinbutton', { name: '规则值', exact: true }).nth(2).fill('18');
    await page.keyboard.press('Escape');
    await page.getByRole('heading', { level: 1 }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('audience-editor.png') });
    const audience = await createAndCapture('/audiences', () => page.getByRole('button', { name: '保存人群', exact: true }).click());
    expect(audience.rules).toHaveLength(2);
    expect(audience.rules[0]).toHaveLength(3);
    expect(audience.rules[0][0].value).toBe('GOLD');
    expect(audience.rules[0][2].dimensionFilters[0].value).toBe('DIGITAL');
    await page.reload();
    await expect(page.getByRole('spinbutton', { name: '最近天数' })).toHaveValue('30');
    await expect(page.getByRole('spinbutton', { name: '规则值', exact: true }).nth(1)).toHaveValue('1000');
    await page.getByRole('button', { name: '查看规则 JSON' }).click();
    await expect(page.locator('.json-preview')).toContainText('"DIGITAL"');
    await page.locator('.ant-drawer-close').click();
    const blockedDelete = await request.delete(`/api/v1/metadata/${tag.id}`);
    expect(blockedDelete.status()).toBe(409);
    await page.getByRole('link', { name: '返回列表' }).click();
    await page.getByPlaceholder('搜索名称或编码').fill(suffix);
    await page.getByPlaceholder('搜索名称或编码').press('Enter');
    await expect(page.getByRole('link', { name: `高价值用户 ${suffix}`, exact: true })).toBeVisible();
    const copyPromise = page.waitForResponse(response => response.url().endsWith(`/audiences/${audience.id}/copy`));
    await page.getByRole('button', { name: /^复\s*制$/ }).click();
    const copy = await (await copyPromise).json();
    cleanups.push(`/audiences/${copy.data.id}`);
    expect(copy.data.id).not.toBe(audience.id);
    await expect(page.getByLabel('人群名称', { exact: true })).toHaveValue(`高价值用户 ${suffix} 副本`);
    expect(browserErrors).toEqual([]);
  } finally {
    for (const path of cleanups.reverse()) await request.delete(`/api/v1${path}`);
  }
});

test('行为切换清空子条件、保存后继续编辑仍提示离开、移动端导航', async ({ page, request }, testInfo) => {
  const suffix = randomUUID().slice(0, 8);
  const events: string[] = [];
  let audienceId: string | undefined;
  try {
    for (const name of ['购买', '访问']) {
      const response = await request.post('/api/v1/event-models', { data: { name: `${name} ${suffix}`, eventCode: `event_${name === '购买' ? 'buy' : 'view'}_${suffix}` } });
      expect(response.status()).toBe(201);
      events.push((await response.json()).data.id);
    }
    const metricResponse = await request.post(`/api/v1/event-models/${events[0]}/metrics`, { data: { name: '金额', fieldName: 'amount' } });
    const metric = (await metricResponse.json()).data;
    const created = await request.post('/api/v1/audiences', { data: { name: `切换测试 ${suffix}`, audienceCode: `switch_${suffix}`, rules: [[{ metadataType: 'EVENT', eventId: events[0], timeRange: { type: 'RELATIVE', unit: 'DAY', value: 7 }, dimensionFilters: [], aggregation: { type: 'SUM', metricId: metric.id }, operator: 'GT', value: 10 }]] } });
    expect(created.status()).toBe(201);
    audienceId = (await created.json()).data.id;
    await page.goto(`/audiences/${audienceId}/edit`);
    await choose(page, '选择行为模型', `访问 ${suffix}`);
    await expect(page.getByRole('combobox', { name: '选择指标', exact: true })).not.toBeVisible();
    await expect(page.getByRole('spinbutton', { name: '最近天数' })).toHaveValue('7');
    const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/audiences/${audienceId}`));
    await page.getByRole('button', { name: '保存人群', exact: true }).click();
    const savedBody = await (await saved).json();
    expect(savedBody.data.rules[0][0].aggregation).toEqual({ type: 'COUNT', metricId: null });
    await page.getByLabel('人群名称', { exact: true }).fill(`未保存 ${suffix}`);
    await page.getByRole('link', { name: '返回列表' }).click();
    await expect(page.getByText('未保存的修改将丢失。')).toBeVisible();
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await expect(page.getByLabel('人群名称', { exact: true })).toHaveValue(`未保存 ${suffix}`);
    await page.getByRole('link', { name: '返回列表' }).click();
    await page.getByRole('button', { name: '放弃修改', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '打开导航' }).click();
    await page.getByRole('link', { name: '标签管理', exact: true }).click();
    await expect(page.getByRole('heading', { name: '标签管理', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('mobile-tags.png'), fullPage: true });
  } finally {
    if (audienceId) await request.delete(`/api/v1/audiences/${audienceId}`);
    for (const eventId of events) await request.delete(`/api/v1/event-models/${eventId}`);
  }
});
