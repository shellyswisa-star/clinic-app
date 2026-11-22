import { test, expect } from '@playwright/test';
import { hasAdminCredentials, loginAsAdmin } from './helpers/adminAuth.js';

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin('Admin dashboard (authenticated)', () => {
  test('logs in and shows bookings calendar by default', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole('heading', { name: 'דשבורד מנהלת' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'יומן' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'רשימה' })).toBeVisible();

    // ניווט חודש ביומן
    await expect(page.getByRole('button', { name: '›' })).toBeVisible();
    await expect(page.getByRole('button', { name: '‹' })).toBeVisible();

    // מקרא סטטוסים
    await expect(page.getByText('שריון', { exact: true })).toBeVisible();
    await expect(page.getByText('שולם', { exact: true })).toBeVisible();
    await expect(page.getByText('חסום', { exact: true }).first()).toBeVisible();
  });

  test('switches between calendar and list views', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'רשימה' }).click();
    await expect(page.getByPlaceholder('חיפוש לפי שם, טלפון או מסלול...')).toBeVisible();

    await page.getByRole('button', { name: 'יומן' }).click();
    await expect(page.getByText('שריון', { exact: true })).toBeVisible();
  });

  test('opens pricing and blocked-slots tabs', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'מחירים' }).click();
    await expect(page.getByRole('heading', { name: 'מחירון' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'שמירת מחירים' })).toBeVisible();

    await page.getByRole('button', { name: 'חסימת משמרות' }).click();
    await expect(page.getByRole('heading', { name: 'חסימת משמרת' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'הוספת חסימה' })).toBeVisible();

    await page.getByRole('button', { name: 'הזמנות' }).click();
    await expect(page.getByRole('button', { name: 'יומן' })).toBeVisible();
  });

  test('logs out back to login screen', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'התנתקות' }).click();
    await expect(page.getByRole('heading', { name: 'כניסת מנהלת' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'דשבורד מנהלת' })).toHaveCount(0);
  });
});
