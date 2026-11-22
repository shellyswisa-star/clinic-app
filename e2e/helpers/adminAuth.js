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
  await page.getByLabel('דואר אלקטרוני').fill(creds.email);
  await page.getByLabel('סיסמה').fill(creds.password);
  await page.getByRole('button', { name: 'כניסה לניהול' }).click();

  const adminHome = page.getByRole('heading', { name: 'לוח ניהול' });
  const loginError = page.getByTestId('admin-login-error');

  try {
    await Promise.race([
      adminHome.waitFor({ state: 'visible', timeout: 20_000 }),
      loginError.waitFor({ state: 'visible', timeout: 20_000 }).then(async () => {
        const message = (await loginError.textContent())?.trim() || 'unknown login error';
        throw new Error(`Admin login failed: ${message}`);
      }),
    ]);
  } catch (err) {
    if (String(err.message || err).includes('Admin login failed:')) throw err;
    const message = (await loginError.textContent().catch(() => ''))?.trim();
    if (message) throw new Error(`Admin login failed: ${message}`);
    throw err;
  }

  await adminHome.waitFor({ state: 'visible', timeout: 5_000 });
}
