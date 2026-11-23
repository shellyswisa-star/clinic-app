import { test, expect } from '@playwright/test';
import { enterBookingFromLanding, pickCalendarShift } from './helpers/publicFlow.js';

test.describe('Landing page', () => {
  test('shows brand, space pitch and plan CTA before booking', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'שורשים' })).toBeVisible();
    await expect(page.getByText('קליניקה נעימה בשקט של אביאל')).toBeVisible();
    await expect(page.getByText('מה כולל המרחב')).toBeVisible();
    await expect(page.getByText('למי המרחב מיועד')).toBeVisible();
    await expect(page.getByTestId('landing-cta-plans')).toBeVisible();
    await expect(page.getByTestId('landing-cta-personal')).toBeVisible();
    await expect(page.getByText('בחירת מסלול השכרה')).toHaveCount(0);
  });

  test('opens personal area and completes OTP flow with mocks', async ({ page }) => {
    await page.route('**/auth/v1/otp**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messageId: 'mock-otp' }),
      });
    });
    await page.route('**/auth/v1/verify**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: {
            id: '00000000-0000-4000-8000-000000000099',
            phone: '+972501234567',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
          },
        }),
      });
    });
    await page.route('**/rest/v1/rpc/get_my_bookings**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');
    await page.getByTestId('landing-cta-personal').click();
    await expect(page.getByTestId('personal-area')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'האזור האישי' })).toBeVisible();

    await page.getByTestId('personal-send-otp').click();
    await expect(page.getByTestId('personal-error')).toContainText(/טלפון/);

    await page.getByTestId('personal-phone').fill('0501234567');
    await page.getByTestId('personal-send-otp').click();
    await expect(page.getByTestId('personal-code-form')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('personal-notice')).toContainText(/SMS|קוד/);

    await page.getByTestId('personal-otp').fill('123456');
    await page.getByTestId('personal-verify-otp').click();
    await expect(page.getByTestId('personal-empty')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'חזרה' }).click();
    await expect(page.getByTestId('landing-page')).toBeVisible();
  });
});

test.describe('Public booking — functionality & correct info', () => {
  test('loads clinic brand and all rental plans', async ({ page }) => {
    await enterBookingFromLanding(page);
    await expect(page.getByRole('heading', { name: 'שורשים' })).toBeVisible();
    await expect(page.getByText('בחירת מסלול השכרה')).toBeVisible();
    await expect(page.getByText('מפגש שבועי')).toBeVisible();
    await expect(page.getByText('השכרה שעתית גמישה')).toBeVisible();
    await expect(page.getByText('השכרה יומית חד-פעמית')).toBeVisible();
    await expect(page.getByText('השכרה חודשית קבועה')).toBeVisible();
  });

  test('shows default prices consistently on plan cards', async ({ page }) => {
    await enterBookingFromLanding(page);
    // תצוגת כרטיס: שעתי מציג מחיר לשעה; מפגש שבועי מציג 800
    await expect(page.getByText('60 ₪ / שעה')).toBeVisible();
    await expect(page.getByText(/משמרת 6 ש׳ = 360/)).toBeVisible();
    await expect(page.getByText(/800\s*₪/)).toBeVisible();
    await expect(page.getByText(/500\s*₪/)).toBeVisible();
    await expect(page.getByText(/2,200|2200/)).toBeVisible();
  });

  test('daily flow validates contact details before reserve', async ({ page }) => {
    await enterBookingFromLanding(page);
    await page.getByRole('heading', { name: 'השכרה יומית חד-פעמית' }).click();
    await expect(page.getByTestId('availability-calendar')).toBeVisible();

    const pickWeekday = () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    await pickCalendarShift(page, pickWeekday(), 'full-day');
    await page.getByRole('button', { name: /המשך לפרטים/ }).click();
    await expect(page.getByText('פרטי המזמין/ה')).toBeVisible();

    await page.getByRole('button', { name: /אישור ושריון מקום/ }).click();
    await expect(page.getByText('נא להזין שם מלא')).toBeVisible();
    await expect(page.getByText(/נא להזין מספר טלפון|מספר טלפון אינו תקין/)).toBeVisible();
  });

  test('monthly options show matching day-count prices', async ({ page }) => {
    await enterBookingFromLanding(page);
    await page.getByText('השכרה חודשית קבועה').click();
    await expect(page.getByText(/3 ימים \(2,200/)).toBeVisible();
    await expect(page.getByText(/4 ימים \(2,800/)).toBeVisible();
    await expect(page.getByText(/5 ימים \(3,500/)).toBeVisible();
  });
});

test.describe('Resources & background', () => {
  test('clinic image has fallback handling and page stays usable', async ({ page }) => {
    await page.goto('/');
    const landingImg = page.locator('img[alt*="שורשים"]');
    await expect(landingImg).toBeVisible();
    await expect(page.getByRole('heading', { name: 'שורשים' })).toBeVisible();

    await enterBookingFromLanding(page);
    await expect(page.getByText('בחירת מסלול השכרה')).toBeVisible();
    await expect(page.locator('img[alt="הקליניקה באביאל"]')).toBeVisible();
  });

  test('no duplicate plan cards rendered', async ({ page }) => {
    await enterBookingFromLanding(page);
    await expect(page.getByText('מפגש שבועי (משמרת קבועה)')).toHaveCount(1);
    await expect(page.getByText('השכרה שעתית גמישה')).toHaveCount(1);
    await expect(page.getByText('השכרה יומית חד-פעמית')).toHaveCount(1);
    await expect(page.getByText('השכרה חודשית קבועה')).toHaveCount(1);
  });
});
