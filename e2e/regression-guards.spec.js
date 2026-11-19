import { test, expect } from '@playwright/test';

function nextWeekdayIso(offsetDays = 2) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * בדיקות רגרסיה ברמת UI למניעת כפילויות / חיוב כפול / מידע שגוי.
 * לוגיקת דאבל-בוקינג מכוסה גם ב-unit (bookingRules.test.js).
 */

test.describe('Regression guards', () => {
  test('reserve creates a single booking POST and shows correct payment total', async ({ page }) => {
    let bookingPosts = 0;

    // mock לפני טעינת העמוד — בלי תלות בסופבייס אמיתי
    await page.route('**/rest/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/bookings') && method === 'POST') {
        bookingPosts += 1;
        await new Promise((r) => setTimeout(r, 1500));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify([{ id: 'test-booking-1' }]),
        });
        return;
      }

      if (url.includes('/orders') && method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'test-order-1' }]),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await page.goto('/');
    await page.getByRole('heading', { name: 'השכרה יומית חד-פעמית' }).click();

    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(nextWeekdayIso(2));
    await page.getByRole('button', { name: /המשך לפרטים/ }).click();
    await expect(page.getByText('פרטי המזמין/ה')).toBeVisible();

    await page.getByPlaceholder('שם מלא *').fill('בדיקת רגרסיה');
    await page.getByPlaceholder(/מספר טלפון/).fill('0501234567');

    const submit = page.getByRole('button', { name: /אישור ושריון מקום/ });
    await Promise.all([
      page.getByText('תשלום מאובטח').waitFor({ state: 'visible', timeout: 15_000 }),
      submit.click(),
    ]);

    // שריון אחד בלבד — בלי כפילות רשת
    expect(bookingPosts).toBe(1);
    await expect(page.getByText('500 ₪').first()).toBeVisible();
  });

  test('spa routing keeps /admin reachable after refresh path', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'כניסת מנהלת' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'כניסת מנהלת' })).toBeVisible();
  });

  test('back navigation from details does not leave ghost paid state in UI', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'השכרה יומית חד-פעמית' }).click();
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(nextWeekdayIso(3));
    await page.getByRole('button', { name: /המשך לפרטים/ }).click();
    await expect(page.getByText('פרטי המזמין/ה')).toBeVisible();
    await page.getByRole('button', { name: /חזרה לבחירת זמנים/ }).click();
    await expect(page.getByText(/בחרי תאריך ליום השכרה מלא/)).toBeVisible();
    await expect(page.getByText('תשלום מאובטח')).toHaveCount(0);
  });
});
