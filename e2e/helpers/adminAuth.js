/**
 * בדיקות מנהלת דורשות משתמש Auth אמיתי בסופבייס.
 * ב-CI: GitHub Secrets — ADMIN_EMAIL, ADMIN_PASSWORD
 * (+ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY בבילד)
 */
export function getAdminCredentials() {
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return null;
  return { email, password };
}

export function hasAdminCredentials() {
  return Boolean(getAdminCredentials());
}

export async function loginAsAdmin(page) {
  const creds = getAdminCredentials();
  if (!creds) {
    throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD are required for authenticated admin tests');
  }

  await page.goto('/admin');
  await page.getByLabel('אימייל').fill(creds.email);
  await page.getByLabel('סיסמה').fill(creds.password);
  await page.getByRole('button', { name: 'כניסה לדשבורד' }).click();
  await page.getByRole('heading', { name: 'דשבורד מנהלת' }).waitFor({
    state: 'visible',
    timeout: 20_000,
  });
}
