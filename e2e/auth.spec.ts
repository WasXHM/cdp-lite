import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('用户可以用用户名密码登录并安全退出', async ({ page }) => {
  await page.goto('/audiences');
  await expect(page.getByRole('heading', { name: '登录工作空间' })).toBeVisible();

  await page.getByLabel('用户名').fill('e2e_admin');
  await page.getByLabel('密码').fill('wrong-password');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  await expect(page.getByRole('alert')).toContainText('用户名或密码错误');

  await page.getByLabel('密码').fill('e2e-admin-password');
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).not.toHaveClass(/ant-btn-loading/);
  await submit.click();
  await expect(page.getByText('E2E 管理员', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '人群管理' })).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('heading', { name: '登录工作空间' })).toBeVisible();
});

test('系统管理员可以在设置页创建、更新和删除用户', async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const username = `ui_user_${suffix}`;
  await page.goto('/audiences');
  await page.getByLabel('用户名').fill('e2e_admin');
  await page.getByLabel('密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();

  await page.getByRole('link', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '创建用户' }).click();
  const createDialog = page.getByRole('dialog', { name: '创建用户' });
  await createDialog.getByLabel('用户名').fill(username);
  await createDialog.getByLabel('显示名称').fill('端到端普通用户');
  await createDialog.getByLabel('登录密码').fill(`ui-password-${suffix}`);
  await createDialog.getByRole('button', { name: /^保\s*存$/ }).click();
  await expect(createDialog).not.toBeVisible();

  await page.getByLabel('搜索用户名或显示名称').fill(username);
  await page.getByLabel('搜索用户名或显示名称').press('Enter');
  const row = page.getByRole('row').filter({ hasText: username });
  await expect(row).toContainText('普通用户');
  await row.getByRole('button', { name: '编辑' }).click();
  const editDialog = page.getByRole('dialog', { name: new RegExp(`编辑用户.*${username}`) });
  await editDialog.getByLabel('显示名称').fill('端到端用户（已更新）');
  await editDialog.getByRole('button', { name: /^保\s*存$/ }).click();
  await expect(editDialog).not.toBeVisible();
  await expect(row).toContainText('端到端用户（已更新）');

  await row.getByRole('button', { name: '删除' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(row).not.toBeVisible();
});
