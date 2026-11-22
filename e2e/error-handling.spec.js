import { test, expect } from '@playwright/test';
import { hasAdminCredentials, loginAsAdmin } from './helpers/adminAuth.js';
import { enterBookingFromLanding } from './helpers/publicFlow.js';

function nextWeekdayIso(offsetDays = 2) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function mockEmptyReads(route) {
  const url = route.request().url();
  const method = route.request().method();
  if (method === 'GET' || method === 'HEAD') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
    return true;
  }
  if (url.includes('/auth/v1/')) {
    await route.continue();
    return true;
  }
  return false;
}

test.describe('Error handling edge cases', () => {
  test('login maps invalid credentials to Hebrew alert', async ({ page }) => {
    await page.route('**/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          msg: 'Invalid login credentials',
        }),
      });
    });

    await page.goto('/admin');
    await page.getByLabel('דואר אלקטרוני').fill('not-an-admin@example.com');
    await page.getByLabel('סיסמה').fill('wrong-password-123');
    await page.getByRole('button', { name: 'כניסה לניהול' }).click();

    const alert = page.getByTestId('admin-login-error');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText(/סיסמה|נכונים/);
  });

  test('public reserve shows Hebrew error when slot already booked', async ({ page }) => {
    await page.route('**/rest/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/rpc/create_booking_safe') && method === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'P0001',
            message: 'slot_already_booked',
            details: null,
            hint: null,
          }),
        });
        return;
      }

      if (await mockEmptyReads(route)) return;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await enterBookingFromLanding(page);
    await page.getByRole('heading', { name: 'השכרה יומית חד-פעמית' }).click();
    await page.locator('input[type="date"]').fill(nextWeekdayIso(2));
    await page.getByRole('button', { name: /המשך לפרטים/ }).click();
    await expect(page.getByText('פרטי המזמין/ה')).toBeVisible();

    await page.getByPlaceholder('שם מלא *').fill('בדיקת שגיאה');
    await page.getByPlaceholder(/מספר טלפון/).fill('0501234567');
    await page.getByRole('button', { name: /אישור ושריון מקום/ }).click();

    const alert = page.getByTestId('booking-action-error');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText(/תפוסה|הזמנה פעילה|משמרת/);
    await expect(page.getByText('תשלום מאובטח')).toHaveCount(0);
  });

  test('public reserve shows Hebrew error when API key is invalid', async ({ page }) => {
    await page.route('**/rest/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/rpc/create_booking_safe') && method === 'POST') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: { 'sb-error-code': 'UNAUTHORIZED_INVALID_API_KEY' },
          body: JSON.stringify({
            message: 'Invalid API key',
            hint: 'Double check the provided API key for typos.',
          }),
        });
        return;
      }

      if (await mockEmptyReads(route)) return;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await enterBookingFromLanding(page);
    await page.getByRole('heading', { name: 'השכרה יומית חד-פעמית' }).click();
    await page.locator('input[type="date"]').fill(nextWeekdayIso(3));
    await page.getByRole('button', { name: /המשך לפרטים/ }).click();
    await page.getByPlaceholder('שם מלא *').fill('בדיקת מפתח');
    await page.getByPlaceholder(/מספר טלפון/).fill('0501234567');
    await page.getByRole('button', { name: /אישור ושריון מקום/ }).click();

    await expect(page.getByTestId('booking-action-error')).toContainText(/חיבור למערכת/, {
      timeout: 15_000,
    });
  });
});

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin('Admin error handling (authenticated)', () => {
  test('edit save shows Hebrew error when update conflicts', async ({ page }) => {
    await page.route('**/rest/v1/bookings**', async (route) => {
      const method = route.request().method();
      if (method === 'PATCH' || method === 'PUT') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'P0001',
            message: 'slot_already_booked',
            details: null,
            hint: null,
          }),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 999,
              full_name: 'בדיקת עריכה',
              phone: '0501112233',
              profession: 'test',
              selected_date: '2026-11-10',
              selected_shift: 'morning',
              total_price: 260,
              status: 'paid',
              plan_id: 'hourly',
              created_at: new Date().toISOString(),
            },
          ]),
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/rest/v1/blocked_slots**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      await route.continue();
    });

    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'רשימה' }).click();
    await page.getByRole('button', { name: 'שינוי' }).first().click();
    await expect(page.getByRole('heading', { name: 'עריכת הזמנה' })).toBeVisible();

    await page.getByRole('button', { name: 'שמירת שינויים' }).click();
    await expect(page.getByTestId('admin-edit-error')).toContainText(/תפוסה|הזמנה פעילה|משמרת/, {
      timeout: 15_000,
    });
  });

  test('edit form validates empty name before calling API', async ({ page }) => {
    let patchCount = 0;
    await page.route('**/rest/v1/bookings**', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchCount += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1001,
              full_name: 'לקוחה',
              phone: '0509998877',
              selected_date: '2026-11-12',
              selected_shift: 'afternoon',
              total_price: 500,
              status: 'reserved',
              plan_id: 'daily',
              created_at: new Date().toISOString(),
            },
          ]),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/rest/v1/blocked_slots**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      await route.continue();
    });

    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'רשימה' }).click();
    await page.getByRole('button', { name: 'שינוי' }).first().click();
    await page.getByPlaceholder('שם מלא').fill('');
    await page.getByRole('button', { name: 'שמירת שינויים' }).click();

    // HTML required may block submit — either way no PATCH should succeed validation path
    // If browser required attribute blocks, fill a single char to hit our validator
    const editVisible = await page.getByRole('heading', { name: 'עריכת הזמנה' }).isVisible();
    expect(editVisible).toBe(true);

    if (patchCount === 0) {
      await page.getByPlaceholder('שם מלא').fill('א');
      await page.getByRole('button', { name: 'שמירת שינויים' }).click();
      await expect(page.getByTestId('admin-edit-error')).toContainText(/2 תווים|שם/, {
        timeout: 10_000,
      });
    }

    expect(patchCount).toBe(0);
  });
});
