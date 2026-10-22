import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('企业工作台：列表密度、多视口、抽屉焦点和键盘表格', async ({ page, request }, testInfo) => {
  const suffix = randomUUID().slice(0, 8);
  const cleanups: string[] = [];
  const create = async (path: string, data: object) => {
    const response = await request.post(`/api/v1${path}`, { data });
    expect(response.status()).toBe(201);
    const result = (await response.json()).data;
    cleanups.push(`${path}/${result.id}`);
    return result;
  };
  try {
    const tag = await create('/metadata', { metadataType: 'TAG', name: '会员等级', fieldName: `member_ui_${suffix}`, dataType: 'String', displayType: 'TEXT', isEnum: false, description: '用于会员分层和权益规则' });
    const attribute = await create('/metadata', { metadataType: 'ATTRIBUTE', name: '年龄', fieldName: `age_ui_${suffix}`, dataType: 'Number', displayType: 'NUMBER', isEnum: false });
    const event = await create('/event-models', { name: '商品购买', eventCode: `purchase_ui_${suffix}`, description: '用户完成商品购买时的行为定义' });
    const dimension = await create(`/event-models/${event.id}/dimensions`, { name: '商品分类', fieldName: 'category', dataType: 'String', displayType: 'TEXT', isEnum: false });
    const metric = await create(`/event-models/${event.id}/metrics`, { name: '购买金额', fieldName: 'amount' });
    const audience = await create('/audiences', {
      name: '高价值数码用户', audienceCode: `digital_ui_${suffix}`, description: '近 30 天购买数码商品的金卡会员，用于复购运营。',
      rules: [[
        { metadataType: 'TAG', metadataId: tag.id, operator: 'EQ', value: 'GOLD' },
        { metadataType: 'ATTRIBUTE', metadataId: attribute.id, operator: 'GTE', value: 25 },
        { metadataType: 'EVENT', eventId: event.id, timeRange: { type: 'RELATIVE', unit: 'DAY', value: 30 }, dimensionFilters: [{ dimensionId: dimension.id, operator: 'EQ', value: 'DIGITAL' }], aggregation: { type: 'SUM', metricId: metric.id }, operator: 'GTE', value: 1000 },
      ], [{ metadataType: 'ATTRIBUTE', metadataId: attribute.id, operator: 'BETWEEN', value: [18, 24] }]],
    });
    const sampleNames = ['近期购买会员', '数码品类偏好用户', '新注册用户', '高频访问用户', '上海地区会员', '待复购用户', '活跃会员', '年轻消费用户', '历史运营人群'];
    for (const [index, name] of sampleNames.entries()) {
      await create('/audiences', { name, audienceCode: `list_${index}_${suffix}`, status: index === 8 ? 'DISABLED' : index === 2 ? 'DRAFT' : 'CONFIGURED', rules: [[{ metadataType: 'ATTRIBUTE', metadataId: attribute.id, operator: 'GTE', value: 18 }]] });
    }
    for (const width of [1440, 1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : width < 768 ? 844 : 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/audiences');
      await expect(page.getByRole('link', { name: audience.name, exact: true })).toBeVisible();
      await expectNoOverflow(page);
      if (width >= 1280) {
        const rows = page.locator('.ant-table-tbody > tr[data-row-key]');
        await expect(rows).toHaveCount(10);
        const firstRow = await rows.first().boundingBox();
        expect(firstRow!.y).toBeLessThan(240);
        expect(firstRow!.height).toBeLessThanOrEqual(48);
        await expect(rows.last()).toBeInViewport();
        await expect(page.locator('.module-nav')).toBeVisible();
      }
      await page.screenshot({ path: testInfo.outputPath(`audiences-${width}.png`), fullPage: true });
      if (width < 1024) {
        const trigger = page.getByRole('button', { name: '打开导航' });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const drawer = page.getByRole('dialog', { name: '工作空间导航' });
        await expect(drawer).toBeVisible();
        await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
        for (let index = 0; index < 10; index++) {
          await page.keyboard.press('Tab');
          expect(await page.locator('.navigation-drawer').evaluate(element => element.contains(document.activeElement))).toBe(true);
        }
        if (width === 390) await page.screenshot({ path: testInfo.outputPath('navigation-390.png') });
        await page.keyboard.press('Escape');
        await expect(drawer).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
        const table = page.getByRole('region', { name: '人群列表' });
        await table.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
      await page.goto(`/audiences/${audience.id}/edit`);
      await expect(page.getByRole('spinbutton', { name: '最近天数' })).toHaveValue('30');
      await expect(page.getByRole('combobox', { name: '选择指标' })).toBeAttached();
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`rules-${width}.png`) });
      await page.locator('.event-item').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`rules-detail-${width}.png`) });
      await page.getByRole('button', { name: '查看规则 JSON' }).click();
      await expect(page.locator('.json-preview')).toContainText('DIGITAL');
      await expectNoOverflow(page);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.goto(`/metadata/events/${event.id}/edit`);
      await expect(page.getByRole('cell', { name: '商品分类', exact: true })).toBeVisible();
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`event-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: '新增维度' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoOverflow(page);
      await page.keyboard.press('Escape');
    }
  } finally {
    for (const path of cleanups.reverse()) await request.delete(`/api/v1${path}`);
  }
});

test('工作台状态：加载、错误重试、筛选为空和表单校验', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const detailPath = '**/api/v1/metadata/00000000-0000-4000-8000-000000000000';
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(detailPath, async route => {
    await pending;
    await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: '暂时无法读取配置，请稍后重试。', details: [] } } });
  });
  await page.goto('/metadata/tags/00000000-0000-4000-8000-000000000000/edit');
  try {
    await expect(page.getByRole('status', { name: '正在加载配置' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('loading-390.png'), fullPage: true });
  } finally { release(); }
  await expect(page.getByRole('alert')).toContainText('暂时无法读取配置');
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('error-390.png'), fullPage: true });
  await page.unroute(detailPath);
  const retryResponse = page.waitForResponse(response => response.url().includes('/metadata/00000000-0000-4000-8000-000000000000'));
  await page.getByRole('button', { name: '重新加载' }).click();
  expect((await retryResponse).status()).toBe(404);
  await page.goto('/metadata/tags');
  await page.getByPlaceholder('搜索名称或编码').fill(`missing_${randomUUID()}`);
  await page.getByPlaceholder('搜索名称或编码').press('Enter');
  await expect(page.getByText('没有符合筛选条件的记录，请调整关键词或状态。')).toBeVisible();
  await expect(page.locator('.ant-spin-spinning')).not.toBeVisible();
  await expect(page.locator('.ant-spin-container')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('empty-390.png'), fullPage: true });
  await page.goto('/metadata/tags/new');
  await page.getByRole('button', { name: '保存基础信息' }).click();
  await expect(page.getByLabel('名称', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('字段名称', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('validation-390.png'), fullPage: true });
});
