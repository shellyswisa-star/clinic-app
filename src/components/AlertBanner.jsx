const STYLES = {
  error: {
    wrap: 'bg-[#fdf2f0] border-[#e8c4bc] text-[#7a3b32]',
    icon: 'text-[#a34a3d]',
  },
  success: {
    wrap: 'bg-[#eef6ef] border-[#c5dcc8] text-[#2f5a38]',
    icon: 'text-[#3d7a4a]',
  },
  info: {
    wrap: 'bg-[#f7f1ea] border-[#e0d2c4] text-[#5c4a45]',
    icon: 'text-[#8c5e47]',
  },
};

function Icon({ tone }) {
  if (tone === 'success') {
    return (
      <svg className={`w-4 h-4 shrink-0 mt-0.5 ${STYLES.success.icon}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.42 0l-3.2-3.2a1 1 0 111.42-1.42l2.49 2.49 6.49-6.49a1 1 0 011.42 0z" clipRule="evenodd" />
      </svg>
    );
  }
  if (tone === 'info') {
    return (
      <svg className={`w-4 h-4 shrink-0 mt-0.5 ${STYLES.info.icon}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-4a1 1 0 100 2 1 1 0 000-2zm1 4a1 1 0 10-2 0v4a1 1 0 102 0V10z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className={`w-4 h-4 shrink-0 mt-0.5 ${STYLES.error.icon}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.518 11.59c.75 1.334-.213 2.986-1.742 2.986H3.48c-1.53 0-2.492-1.652-1.742-2.986L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-6a1 1 0 00-1 1v2a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * באנר הודעה אחיד — שגיאה / הצלחה / מידע
 */
export default function AlertBanner({
  tone = 'error',
  children,
  testId,
  className = '',
}) {
  if (!children) return null;
  const style = STYLES[tone] || STYLES.error;
  const role = tone === 'error' ? 'alert' : 'status';

  return (
    <p
      role={role}
      data-testid={testId}
      className={`flex gap-2.5 items-start text-sm leading-relaxed border rounded-xl px-3.5 py-3 ${style.wrap} ${className}`}
    >
      <Icon tone={tone} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
