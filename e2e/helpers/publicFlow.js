/** מעבר מעמוד הנחיתה למסך בחירת מסלולים */
export async function enterBookingFromLanding(page) {
  await page.goto('/');
  const cta = page.getByTestId('landing-cta-plans').first();
  await cta.waitFor({ state: 'visible', timeout: 15_000 });
  await cta.click();
  await page.getByText('בחירת מסלול השכרה').waitFor({ state: 'visible', timeout: 10_000 });
}

/** בחירת משמרת פנויה ביומן הזמינות */
export async function pickCalendarShift(page, dateIso, shiftId = 'morning') {
  await page.getByTestId('availability-calendar').waitFor({ state: 'visible', timeout: 10_000 });
  const day = page.getByTestId(`cal-day-${dateIso}`);
  for (let i = 0; i < 3; i += 1) {
    if (await day.count()) break;
    await page.getByLabel('חודש הבא').click();
  }
  await day.waitFor({ state: 'visible', timeout: 10_000 });
  await day.getByTestId(`cal-shift-${shiftId}`).click();
}
