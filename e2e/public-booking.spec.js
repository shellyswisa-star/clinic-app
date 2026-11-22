import { test, expect } from '@playwright/test';
import { enterBookingFromLanding } from './helpers/publicFlow.js';

test.describe('Landing page', () => {
  test('shows brand, space pitch and plan CTA before booking', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'שורשים' })).toBeVisible();
    await expect(page.getByText('קליניקה נעימה בשקט של אביאל')).toBeVisible();
    await expect(page.getByText('מה כולל המרחב')).toBeVisible();
    await expect(page.getByText('למי המרחב מיועד')).toBeVisible();
    await expect(page.getByTestId('landing-cta-plans')).toBeVisible();
    await expect(page.getByText('בחירת מסלול השכרה')).toHaveCount(0);
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
    await expect(page.getByText(/בחרי תאריך ליום השכרה מלא/)).toBeVisible();

    // בוחרים תאריך חול קרוב
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    const pickWeekday = () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    await dateInput.fill(pickWeekday());
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
