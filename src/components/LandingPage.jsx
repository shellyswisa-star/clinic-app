import { CLINIC_INFO } from '../clinicConfig';

function WhatsAppIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.28-.14-1.65-.81-1.9-.9-.26-.1-.44-.14-.63.14-.18.27-.72.9-.88 1.08-.16.18-.33.2-.61.07-.28-.14-1.17-.43-2.23-1.37-.82-.73-1.38-1.64-1.54-1.92-.16-.27-.02-.42.12-.56.13-.13.28-.33.42-.5.14-.16.18-.27.28-.45.09-.18.05-.34-.02-.48-.07-.14-.63-1.51-.86-2.07-.23-.55-.46-.47-.63-.48h-.54c-.18 0-.48.07-.73.34-.26.27-.96.94-.96 2.3s.99 2.67 1.12 2.85c.14.18 1.95 2.98 4.72 4.18.66.28 1.18.45 1.58.58.66.21 1.27.18 1.75.11.53-.08 1.65-.67 1.88-1.32.23-.65.23-1.2.16-1.32-.07-.11-.25-.18-.53-.32z" />
      <path d="M12.04 2C6.5 2 2 6.48 2 12c0 1.9.53 3.67 1.45 5.19L2 22l4.95-1.3A9.96 9.96 0 0012.04 22C17.58 22 22 17.52 22 12S17.58 2 12.04 2zm0 18.2c-1.7 0-3.28-.5-4.6-1.35l-.33-.2-3.06.8.82-2.98-.22-.35A8.15 8.15 0 013.8 12c0-4.53 3.7-8.2 8.24-8.2 4.54 0 8.23 3.67 8.23 8.2 0 4.54-3.69 8.2-8.23 8.2z" />
    </svg>
  );
}

function Section({ title, children, delayClass = '' }) {
  return (
    <section className={`landing-section text-right space-y-3 ${delayClass}`}>
      <h2 className="text-2xl sm:text-3xl font-bold text-[#5c4a45] title-handwritten tracking-wide">
        {title}
      </h2>
      <div className="text-sm sm:text-[15px] text-[#5c4a45]/90 leading-relaxed space-y-3 border-t border-[#e8dfd3] pt-3">
        {children}
      </div>
    </section>
  );
}

function CtaGroup({ onStartBooking, whatsappUrl, stacked = false }) {
  return (
    <div
      className={`flex ${stacked ? 'flex-col items-stretch' : 'flex-col sm:flex-row sm:items-center'} gap-3`}
    >
      <button
        type="button"
        onClick={onStartBooking}
        data-testid="landing-cta-plans"
        className="bg-[#8c5e47] text-white px-6 py-3.5 rounded-xl text-sm font-bold hover:brightness-110 transition-[filter] cursor-pointer text-center"
      >
        לבחירת מסלול השכרה
      </button>
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="landing-cta-whatsapp"
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold text-[#5c4a45] border border-[#d4c4b4] bg-white/80 hover:bg-white hover:underline underline-offset-4 cursor-pointer"
        >
          <WhatsAppIcon className="w-4 h-4 text-[#5c4a45]" />
          שאלה לפני ההזמנה בוואטסאפ
        </a>
      )}
    </div>
  );
}

/**
 * עמוד נחיתה לפני בחירת מסלול — מותג, מרחב, למי מתאים, פרטים מעשיים.
 */
export default function LandingPage({ onStartBooking, onOpenPersonalArea }) {
  const phoneDigits = String(CLINIC_INFO.whatsappPhone || '').replace(/\D/g, '');
  const whatsappUrl = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent('היי, אשמח לשמוע עוד על השכרת המרחב בשורשים')}`
    : null;

  return (
    <div dir="rtl" className="min-h-screen bg-[#fcf9f2] text-[#4a3e3d]" data-testid="landing-page">
      {/* Hero — composition אחת, תמונה full-bleed */}
      <header className="relative min-h-[100svh] w-full overflow-hidden bg-[#2a1b18]">
        <img
          src={CLINIC_INFO.imageUrl}
          onError={(e) => {
            e.target.src =
              'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1600&q=80';
          }}
          alt="מרחב הטיפול של שורשים במושב אביאל"
          className="landing-hero-img absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#2a1b18]/45" />

        {/* מותג כסימן־מים ענק על כל ה־hero */}
        <div
          className="landing-brand-wash pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden"
          aria-hidden="true"
        >
          <span className="title-handwritten landing-brand-wash-text select-none">
            {CLINIC_INFO.name}
          </span>
        </div>

        {onOpenPersonalArea && (
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
            <button
              type="button"
              onClick={onOpenPersonalArea}
              data-testid="landing-cta-personal"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/35 px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#faf4eb] hover:bg-white/25 cursor-pointer shadow-sm"
            >
              האזור האישי
            </button>
          </div>
        )}

        <div className="relative z-10 min-h-[100svh] flex flex-col justify-end px-5 sm:px-10 pb-12 sm:pb-16 pt-24 max-w-3xl mr-auto ml-auto">
          <h1 className="sr-only">{CLINIC_INFO.name}</h1>
          <p className="text-2xl sm:text-3xl font-extrabold text-white leading-snug max-w-xl">
            קליניקה נעימה בשקט של אביאל
          </p>
          <p className="mt-3 text-sm sm:text-base text-[#ebded5] leading-relaxed max-w-lg font-light">
            חדר טיפולים עם מיטה, וסלון ומטבח משותפים שמאובזרים עד הפרט הקטן
            והופכים את המקום למרחב טיפולי נגיש ומזמין.
          </p>
          <div className="mt-8">
            <CtaGroup onStartBooking={onStartBooking} whatsappUrl={whatsappUrl} />
          </div>
          <p className="mt-4 text-[11px] text-[#cbb8a8]">ההזמנה והתשלום בשלב הבא</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-8 py-14 sm:py-20 space-y-14">
        <Section title="מה כולל המרחב" delayClass="landing-section-d1">
          <p>
            מטבח מצויד וסלון משותף — ספה זוגית וכורסת מטפל/ת. חדר טיפול נפרד עם מיטת טיפול
            ו/או שולחן עבודה. חדר רחצה עם מקלחת.
          </p>
          <p>האווירה שקטה ונעימה, מתאימה לעבודה רצופה לאורך היום.</p>
        </Section>

        <Section title="למי המרחב מיועד" delayClass="landing-section-d2">
          <p>
            למטפלים ולמטפלות מכל תחומי הטיפול — פסיכותרפיה, ייעוץ, ריפוי בעיסוק, פיזיותרפיה,
            תזונה ועוד. מרחב משותף, בלי תיוג לפי מקצוע — פרטיות בחדר הטיפול ונוחות בסלון
            ובמטבח בין מפגשים.
          </p>
        </Section>

        <Section title="פרטים מעשיים" delayClass="landing-section-d3">
          <ul className="space-y-2 list-none">
            <li className="flex gap-2">
              <span className="text-[#8c5e47] font-bold" aria-hidden="true">
                ·
              </span>
              <span>חניה במקום, כניסה נפרדת ונגישות</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#8c5e47] font-bold" aria-hidden="true">
                ·
              </span>
              <span>יום השכרה מלא — פרטיות בין המרחבים, במושב שקט ולא מסחרי</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#8c5e47] font-bold" aria-hidden="true">
                ·
              </span>
              <span>
                {CLINIC_INFO.hours} · {CLINIC_INFO.address}
              </span>
            </li>
          </ul>
        </Section>

        <div className="landing-section landing-section-d3 pt-4 border-t border-[#e8dfd3] space-y-4">
          <p className="text-sm text-[#735e58] text-right leading-relaxed">
            מוכנים לשריין משמרת? בחרו מסלול — או כתבו בוואטסאפ אם יש שאלה לפני כן.
          </p>
          <CtaGroup onStartBooking={onStartBooking} whatsappUrl={whatsappUrl} stacked />
        </div>
      </main>
    </div>
  );
}
