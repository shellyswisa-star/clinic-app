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

async function mockRestEmpty(page) {
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/rpc/create_booking_safe') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: `b-${Date.now()}` }),
      });
      return;
    }

    if (method === 'POST' && url.includes('/bookings')) {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: `b-${Date.now()}` }]),
      });
      return;
    }

    if (method === 'POST' && url.includes('/orders')) {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'o-1' }]),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('All rental plans — schedule & pricing', () => {
  test('hourly card shows 60/h and 360 shift total, with 08:00 shifts', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('60 ₪ / שעה')).toBeVisible();
    await expect(page.getByText(/משמרת 6 ש׳ = 360/)).toBeVisible();

    await page.getByRole('heading', { name: 'השכרה שעתית גמישה' }).click();
    await page.locator('input[type="date"]').fill(nextWeekdayIso(2));
    await expect(page.getByRole('button', { name: /08:00 - 14:00/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /14:00 - 20:00/ })).toBeVisible();

    await page.getByRole('button', { name: /08:00 - 14:00/ }).click();
    await page.getByRole('button', { name: /המשך לפרטים/ }).click();
    await expect(page.getByText('פרטי המזמין/ה')).toBeVisible();
    await expect(page.getByText('סה"כ לתשלום:').locator('..')).toContainText('360');
  });

  test('session flow reaches details with weekly dates summary', async ({ page }) => {
    await mockRestEmpty(page);
    await page.goto('/');
    await page.getByRole('heading', { name: /ססיה שבועית/ }).click();
    await page.locator('input[type="date"]').fill(nextWeekdayIso(3));
    await page.getByRole('button', { name: /08:00 - 14:00/ }).click();
    await page.getByRole('button', { name: /המשך לפרטים/ }).click();
    await expect(page.getByText(/4 תאריכי הפעילות/)).toBeVisible();
  });

  test('monthly flow requires calendar-synced free dates', async ({ page }) => {
    await page.goto('/');
    await page.getByText('השכרה חודשית קבועה').click();
    await page.getByRole('button', { name: /3 ימים/ }).click();
    await page.getByRole('button', { name: /08:00 - 14:00/ }).click();

    // בוחרים 3 ימים ראשונים שאינם חסומים
    const dayButtons = page.locator('button', { hasText: /יום / });
    let picked = 0;
    const count = await dayButtons.count();
    for (let i = 0; i < count && picked < 3; i += 1) {
      const btn = dayButtons.nth(i);
      if (await btn.isDisabled()) continue;
      await btn.click();
      picked += 1;
    }
    expect(picked).toBe(3);

    await expect(page.getByTestId('monthly-calendar-sync')).toBeVisible();
    await expect(page.getByText(/תאריכים מהיומן/)).toBeVisible();

    const continueBtn = page.getByRole('button', { name: /המשך לפרטים/ });
    // אם הכל פנוי — אפשר להמשיך; אם לא — הכפתור disabled + באנר
    if (await continueBtn.isEnabled()) {
      await continueBtn.click();
      await expect(page.getByText('פרטי המזמין/ה')).toBeVisible();
      await expect(page.getByText(/תאריכים שישורינו/)).toBeVisible();
    } else {
      await expect(page.getByText('חלק מהתאריכים תפוסים', { exact: false })).toBeVisible();
    }
  });

  test('daily full-day hours show 08:00-20:00', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'השכרה יומית חד-פעמית' }).click();
    await expect(page.getByText(/08:00 - 20:00|08:00–20:00/)).toBeVisible();
  });
});
