# תכנית בדיקות — Clinic App

מטרה: רגרסיה + E2E ברמת CI שמגנים על אבטחה, פונקציונליות, משאבים/רקע, ומניעת כפילויות (דאבל בוקינג / חיוב כפול / מידע שגוי).

## שכבות

| שכבה | כלי | מתי רץ | מה בודקים |
|------|-----|--------|-----------|
| Unit / Regression logic | Vitest | כל PR + push | מחירים, חסימות, דאבל-בוקינג, ולידציה, מניעת שמירה כפולה |
| E2E UI | Playwright | כל PR אחרי unit | מסלולי הזמנה, אבמין, אבטחת גישה, שריון בודד |
| E2E Admin (auth) | Playwright | כשיש `ADMIN_EMAIL`/`ADMIN_PASSWORD` | login, יומן, רשימה, מחירים, חסימות, logout |
| Lint | ESLint | כל PR | איכות קוד בסיסית |
| CI | GitHub Actions `.github/workflows/ci.yml` | push/PR ל-main | כל הנ״ל |

## פקודות מקומיות

```bash
npm run test:unit      # לוגיקה + רגרסיה
npm run build && npm run test:e2e   # E2E מול preview
ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='***' npm run test:e2e  # כולל דשבורד מנהלת
npm run test:ci        # כמו ב-CI
```

## מטריצת סיכונים

### 1) אבטחה
- [x] `/admin` לא נפתח בלי login
- [x] כניסה עם סיסמה שגויה נשארת במסך login
- [x] אתר הזמנות ציבורי בלי auth
- [x] אין `service_role` ב-HTML
- [x] E2E מנהלת: login אמיתי → דשבורד/יומן (כשיש secrets)
- [x] E2E מנהלת: logout חוזר למסך כניסה
- [ ] **ידני / עתידי:** בדיקת RLS בסופבייס (anon לא מוחק paid; authenticated מנהלת בלבד)
- [ ] **עתידי:** משתמש authenticated שאינו המנהלת לא מקבל הרשאות יתר (אם יתווספו roles)

### 2) פונקציונליות
- [x] טעינת מותג + 4 מסלולים
- [x] מחירים על כרטיסים תואמים לברירת מחדל
- [x] מסלול יומי → פרטים → ולידציית שם/טלפון
- [x] מסלול חודשי מציג 3/4/5 ימים עם מחירים נכונים
- [x] ניווט חזרה מפרטים לא משאיר מסך תשלום
- [x] E2E מנהלת: מעבר יומן ↔ רשימה
- [x] E2E מנהלת: טאבי מחירים + חסימת משמרות

### 3) משאבים / רקע / תצוגה
- [x] תמונת קליניקה מוצגת; גם בכשל העמוד נשאר שמיש
- [x] אין כפילות כרטיסי מסלול ב-DOM
- [ ] **עתידי:** בדיקת Lighthouse/bundle size ב-CI (אופציונלי)

### 4) אין מידע כפול / מידע שגוי
- [x] מזהי pricing ייחודיים
- [x] `hourly` לתצוגה ≠ `hourly_shift` לחיוב (60 מול 260)
- [x] override ממסד משנה תצוגה וחיוב יחד
- [x] E2E: אין כפילות כותרות מסלול

### 5) אין דאבל-בוקינג
- [x] Unit: paid חוסם אותה משמרת
- [x] Unit: morning לא חוסם afternoon
- [x] Unit: full-day חופף למשמרת חלקית
- [x] Unit: reserved ישן (>10 דק׳) לא חוסם
- [x] Unit: blocked_slots חוסם
- [x] Unit: `findDuplicateActiveBookings` מזהה כפילויות בנתונים
- [x] DB: `create_booking_safe` + trigger + advisory lock (`supabase/prevent-double-booking.sql`)
- [x] Unit: מיפוי שגיאות `slot_already_booked` / `slot_blocked`

### 6) אין חיוב כפול
- [x] Unit: `canStartSave` חוסם כש-`isSaving`
- [x] E2E: כפתור השריון disabled בזמן שמירה (עם mock ל-API)
- [ ] **עתידי:** אחרי סליקה אמיתית — idempotency key / webhook חד-פעמי

## קבצי בדיקות

- `src/clinicConfig.test.js`
- `src/lib/bookingRules.test.js`
- `e2e/public-booking.spec.js`
- `e2e/admin-security.spec.js`
- `e2e/admin-dashboard.spec.js` (+ `e2e/helpers/adminAuth.js`)
- `e2e/regression-guards.spec.js`

## Secrets ל-CI (מומלץ)

ב-GitHub → Settings → Secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `ADMIN_EMAIL` — משתמש מנהלת ב-Supabase Auth
- `ADMIN_PASSWORD`

בלי `VITE_*` הבילד משתמש בערכי CI דמה (מספיק לרוב בדיקות ה-UI).  
בלי `ADMIN_*` בדיקות הדשבורד המחוברות **מדלגות** (`describe.skip`) וה-CI עדיין ירוק.

## מה עדיין לא אוטומטי (backlog)

1. בדיקת RLS end-to-end מול פרויקט Supabase ייעודי ל-CI
2. E2E מקבילי: שני דפדפנים משריינים אותה משמרת (מוודא שרק אחד מצליח)
3. סליקה אמיתית + מניעת חיוב כפול ברמת ספק התשלום
4. E2E: ביטול/עריכת הזמנה ספציפית ביומן (דורש seed נתונים)
