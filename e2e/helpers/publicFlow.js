/** מעבר מעמוד הנחיתה למסך בחירת מסלולים */
export async function enterBookingFromLanding(page) {
  await page.goto('/');
  const cta = page.getByTestId('landing-cta-plans').first();
  await cta.waitFor({ state: 'visible', timeout: 15_000 });
  await cta.click();
  await page.getByText('בחירת מסלול השכרה').waitFor({ state: 'visible', timeout: 10_000 });
}
