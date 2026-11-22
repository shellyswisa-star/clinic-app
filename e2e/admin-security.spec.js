import { test, expect } from '@playwright/test';

test.describe('Admin security & access control', () => {
  test('admin route requires login (no guest dashboard)', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'כניסת מנהלת' })).toBeVisible();
    await expect(page.getByText('דשבורד מנהלת')).toHaveCount(0);
    await expect(page.getByLabel('אימייל')).toBeVisible();
    await expect(page.getByLabel('סיסמה')).toBeVisible();
  });

  test('invalid credentials stay on login and show error', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('אימייל').fill('not-an-admin@example.com');
    await page.getByLabel('סיסמה').fill('wrong-password-123');
    await page.getByRole('button', { name: 'כניסה לדשבורד' }).click();
    await expect(page.getByRole('heading', { name: 'כניסת מנהלת' })).toBeVisible();
    await expect(page.getByTestId('admin-login-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('admin-login-error')).toContainText(/מייל או סיסמה|API|רשת|התחברות/);
  });

  test('public booking stays available without auth', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('בחירת מסלול השכרה')).toBeVisible();
  });
});

test.describe('Bundle / secrets hygiene', () => {
  test('built page does not expose service-role style secrets in HTML', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    expect(html.toLowerCase()).not.toContain('service_role');
    expect(html).not.toMatch(/eyJhbGciOi.*service/i);
  });
});
