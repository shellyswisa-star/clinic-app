import { test, expect } from '@playwright/test';
import { hasAdminCredentials, loginAsAdmin } from './helpers/adminAuth.js';

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin('Admin dashboard (authenticated)', () => {
  test('logs in and shows bookings calendar by default', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole('heading', { name: 'לוח ניהול' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'יומן' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'רשימה' })).toBeVisible();

    // ניווט חודש ביומן
    await expect(page.getByRole('button', { name: '›' })).toBeVisible();
    await expect(page.getByRole('button', { name: '‹' })).toBeVisible();

    // מקרא מצבים ביומן (לא האפשרות בסינון המצבים)
    await expect(page.locator('span.bg-amber-100', { hasText: 'שריון' })).toBeVisible();
    await expect(page.locator('span.bg-emerald-100', { hasText: 'שולם' })).toBeVisible();
    await expect(page.locator('span.border-dashed', { hasText: 'חסום' })).toBeVisible();
  });

  test('switches between calendar and list views', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'רשימה' }).click();
    await expect(page.getByPlaceholder('חיפוש לפי שם, טלפון או מסלול...')).toBeVisible();

    await page.getByRole('button', { name: 'יומן' }).click();
    await expect(page.locator('span.bg-amber-100', { hasText: 'שריון' })).toBeVisible();
  });

  test('closes edit form when switching calendar/list', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'רשימה' }).click();

    const editBtn = page.getByRole('button', { name: 'שינוי' }).first();
    if ((await editBtn.count()) === 0) {
      test.skip(true, 'No bookings to edit');
      return;
    }
    await editBtn.click();
    await expect(page.getByRole('heading', { name: 'עריכת הזמנה' })).toBeVisible();

    await page.getByRole('button', { name: 'יומן' }).click();
    await expect(page.getByRole('heading', { name: 'עריכת הזמנה' })).toHaveCount(0);

    await page.getByRole('button', { name: 'רשימה' }).click();
    await expect(page.getByRole('heading', { name: 'עריכת הזמנה' })).toHaveCount(0);
  });

  test('shows latest booking strip and date filters', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByTestId('admin-latest-booking')).toBeVisible();
    await expect(page.getByTestId('admin-date-filter-mode')).toBeVisible();
    await page.getByTestId('admin-date-filter-mode').selectOption('created');
    await expect(page.getByTestId('admin-date-filter-value')).toBeEnabled();
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
    await expect(page.getByRole('heading', { name: 'לוח ניהול' })).toHaveCount(0);
  });
});
