import React from 'react';
import DOMPurify from 'dompurify';
import TrackedYouTubeEmbed from '../TrackedYouTubeEmbed';

interface SalesEngineRendererProps {
  key?: string | number;
  block: any;
  isEditing?: boolean;
  onCTAClick?: (block: any) => void;
  theme?: string;
}

function sanitizeRichText(value: unknown, fallback: string) {
  return DOMPurify.sanitize(typeof value === 'string' ? value : fallback, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
      'ul', 'ol', 'li', 'a', 'span', 'blockquote', 'code',
    ],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button', 'object', 'embed', 'svg', 'math'],
  });
}

function safeHttpUrl(value: unknown, fallback = '') {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export default function SalesEngineRenderer({ block, isEditing = false, onCTAClick, theme }: SalesEngineRendererProps) {

  // ==================== 1. TOP BANNER ====================
  if (block.type === 'top_banner') {
    const c = block.content || {};
    return (
      <div
        className="site-block site-top-banner w-full py-2.5 px-4 text-center"
        style={{ background: c.bgColor || '#cc0000' }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
        <p
          className="text-xs sm:text-sm font-bold tracking-wide leading-tight"
          style={{
            fontFamily: '"Inter", sans-serif',
            color: c.textColor || '#ffffff',
          }}
        >
          {c.icon && <span className="mr-1">{c.icon}</span>}
          {c.text || 'International Bestseller With Over 300,000+ Copies Sold!'}
        </p>
      </div>
    );
  }

  // ==================== LESSON HERO WITH VIDEO ====================
  if (block.type === 'lesson_video_hero') {
    const c = block.content || {};
    const videoUrl = safeHttpUrl(c.videoUrl);
    const benefitBullets = Array.isArray(c.bullets) && c.bullets.length > 0
      ? c.bullets.slice(0, 3)
      : [
          'Поймёте главный принцип без лишней теории',
          'Разберёте его на понятном примере',
          'Сразу примените в практическом задании',
        ];

    const lessonPlayer = (
      <div className="site-lesson-player-shell">
        <div className="site-lesson-player">
          {videoUrl ? (
            <TrackedYouTubeEmbed
              src={videoUrl}
              title={c.title || 'Видео урока'}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="site-lesson-player-placeholder">
              <div className="site-lesson-player-button" aria-hidden="true"><span /></div>
              <strong>Видео урока</strong>
              <small>Добавьте ссылку на видео в настройках страницы</small>
            </div>
          )}
        </div>
        <div className="site-lesson-player-caption">
          <span>{c.caption || 'Посмотрите до конца — после видео будет одно практическое действие'}</span>
          <strong>{c.duration || '10–15 мин'}</strong>
        </div>
      </div>
    );

    if (c.isPayment) {
      const handlePaymentClick = () => onCTAClick?.(block);
      return (
        <section className="site-block site-brunson-vsl">
          <div className="site-brunson-announcement">
            {c.topBannerText || 'Бесплатный урок + специальная цена только сегодня'}
          </div>

          <div className="site-brunson-shell">
            <div className="site-brunson-grid">
              <header className="site-brunson-copy">
                <p className="site-brunson-kicker">
                  {c.kicker || 'Хотите получить результат уже сегодня?'}
                </p>
                <h1>{c.title || 'Название бесплатного урока'}</h1>
                <p className="site-brunson-subtitle">
                  {c.subtitle || 'Посмотрите короткий практический урок и повторите действие по готовому шаблону.'}
                </p>
              </header>

              <div className="site-brunson-video">
                {lessonPlayer}
              </div>

              <aside className="site-brunson-offer">
                <div className="site-brunson-product" aria-label={c.offerTitle || 'Продукт'}>
                  <span>{c.productEyebrow || 'ПРАКТИЧЕСКИЙ МИНИ-КУРС'}</span>
                  <strong>{c.offerTitle || 'Полная система'}</strong>
                  <small>{c.productCaption || 'Пошаговый доступ сразу после оплаты'}</small>
                </div>
                <p className="site-brunson-offer-label">
                  {c.offerLabel || 'Специальное предложение к уроку'}
                </p>
                <div className="site-brunson-value-line">
                  <span aria-hidden="true">★★★★★</span>
                  <strong>{c.valueText || 'Готовые уроки и шаблоны'}</strong>
                </div>
                <div className="site-brunson-price">
                  <strong>{c.price || `${c.amount || 0} ₽`}</strong>
                  {c.oldPrice && <del>{c.oldPrice}</del>}
                </div>
                <ul>
                  {benefitBullets.map((benefit: string, index: number) => (
                    <li key={`${benefit}-${index}`}><span>✓</span>{benefit}</li>
                  ))}
                </ul>
                <button type="button" onClick={handlePaymentClick}>
                  {c.ctaText || 'Получить доступ'}
                </button>
                <small>{c.offerNote || 'Разовый платёж · доступ сразу'}</small>
              </aside>
            </div>

            <div className="site-brunson-proof-grid">
              <article>
                <span className="site-brunson-proof-number">1</span>
                <div>
                  <p>Практика после урока</p>
                  <h2>{c.practiceTitle || 'Сделайте один шаг прямо сейчас'}</h2>
                  <div>{c.practiceText || 'Повторите действие из урока на своём примере и сохраните результат.'}</div>
                </div>
              </article>
              <article>
                <span className="site-brunson-proof-number">2</span>
                <div>
                  <p>Что получите дальше</p>
                  <h2>{c.bonusTitle || 'Не начинайте снова с пустого листа'}</h2>
                  <div>{c.bonusText || 'Используйте готовую систему, шаблоны и последовательный план внедрения.'}</div>
                </div>
              </article>
            </div>

            <div className="site-brunson-final-cta">
              <p>{c.finalEyebrow || 'Готовы продолжить с полной системой?'}</p>
              <h2>{c.finalTitle || c.offerTitle || 'Получите полный доступ сейчас'}</h2>
              <button type="button" onClick={handlePaymentClick}>
                {c.ctaText || 'Получить доступ'}
              </button>
              <small>{c.offerNote || 'Разовый платёж · доступ сразу'}</small>
            </div>
          </div>

          <footer className="site-brunson-footer">
            <strong>{c.footerTitle || c.offerTitle || 'Практическая программа'}</strong>
            <p>{c.footerText || 'Материалы и пошаговый доступ после оплаты.'}</p>
            <small>
              {c.disclaimer || 'Результаты зависят от исходной ситуации, качества внедрения и регулярности действий.'}
            </small>
          </footer>
        </section>
      );
    }

    return (
      <section className="site-block site-lesson-video-hero">
        <div className="site-lesson-video-copy">
          <p className="site-lesson-video-eyebrow">{c.eyebrow || 'Практический урок'}</p>
          <h1>{c.title || 'Название урока'}</h1>
          <p className="site-lesson-video-subtitle">
            {c.subtitle || 'Один понятный принцип, пример и действие, которое даёт измеримый результат.'}
          </p>
        </div>

        <div className="site-lesson-video-stage">
          {lessonPlayer}

          <aside className="site-lesson-conversion-panel">
            <p>После урока вы сможете</p>
            <h2>{c.result || 'Получить измеримый результат'}</h2>
            <ul>
              {benefitBullets.map((benefit: string, index: number) => (
                <li key={`${benefit}-${index}`}><span>✓</span>{benefit}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                document.querySelector('.site-text-block--practice')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }}
            >
              {c.ctaText || 'Перейти к практике'}
            </button>
            <small>{`${c.duration || '10–15 минут'} · одно конкретное действие`}</small>
          </aside>
        </div>
      </section>
    );
  }

  // ==================== 2. HEADLINE ====================
  if (block.type === 'headline') {
    const c = block.content || {};
    return (
      <div
        className="site-block site-headline w-full px-5 sm:px-8 py-6 sm:py-8 text-center"
        style={{
          background: c.bgColor || '#ffffff',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        {c.preText && (
          <p
            className="text-xs sm:text-sm font-medium mb-2 uppercase tracking-wider"
            style={{ color: c.preTextColor || '#60606b' }}
          >
            {c.preText}
          </p>
        )}

        <h1
          className="text-xl sm:text-2xl md:text-3xl font-black leading-tight tracking-tight mb-3"
          style={{ color: c.mainTextColor || '#1d2e3b' }}
        >
          {c.mainText || 'Get This FREE Book'}
        </h1>

        {c.subText && (
          <p
            className="text-sm sm:text-base font-normal leading-relaxed max-w-lg mx-auto"
            style={{ color: c.subTextColor || '#60606b' }}
          >
            {c.subText}
          </p>
        )}
      </div>
    );
  }

  // ==================== 3. HERO IMAGE ====================
  if (block.type === 'hero_image') {
    const c = block.content || {};
    return (
      <div
        className="site-block site-hero-image w-full px-5 sm:px-8 py-4 sm:py-6 flex flex-col items-center"
        style={{
          background: c.bgColor || '#ffffff',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        {/* Star rating */}
        {c.showRating !== false && (
          <div className="flex flex-col items-center mb-4">
            <div className="flex gap-0.5 mb-1">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-base" role="img" aria-label="star">⭐</span>
              ))}
            </div>
            <p
              className="text-xs font-semibold"
              style={{ color: '#60606b' }}
            >
              {c.ratingText || '4.6 — 2,340 Amazon Ratings'}
            </p>
          </div>
        )}

        {/* Main Image */}
        {c.imageUrl ? (
          <img
            src={safeHttpUrl(c.imageUrl)}
            alt={c.altText || 'Product image'}
            className="max-w-full h-auto object-contain"
            style={{
              maxHeight: c.maxHeight || '360px',
              borderRadius: c.borderRadius || '0px',
            }}
          />
        ) : (
          <div
            className="w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl"
            style={{
              height: '240px',
              maxWidth: '300px',
              borderColor: '#d1d5db',
              background: '#f9fafb',
            }}
          >
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
            <p className="text-sm font-semibold" style={{ color: '#9ca3af' }}>Загрузите изображение</p>
            <p className="text-xs mt-1" style={{ color: '#d1d5db' }}>Книга, продукт или фото</p>
          </div>
        )}

        {/* Caption */}
        {c.caption && (
          <p
            className="text-xs font-medium mt-3 text-center"
            style={{ color: '#60606b' }}
          >
            {c.caption}
          </p>
        )}
      </div>
    );
  }

  // ==================== 4. CTA BUTTON ====================
  if (block.type === 'cta_button') {
    const c = block.content || {};
    const btnBg = c.bgColor || '#00b200';
    const btnHoverBg = c.hoverBgColor || '#009900';

    return (
      <div
        className={`site-block site-cta ${c.isPayment ? 'site-cta--payment' : ''} w-full px-5 sm:px-8 py-4 sm:py-5 flex flex-col items-center`}
        style={{
          background: c.sectionBgColor || '#ffffff',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <button
          onClick={() => {
            if (c.buttonAction === 'open_url' && c.buttonUrl) {
              const targetUrl = safeHttpUrl(c.buttonUrl);
              if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }
            if (onCTAClick) onCTAClick(block);
          }}
          className="w-full max-w-sm py-3.5 sm:py-4 px-6 rounded-md font-extrabold text-sm sm:text-base uppercase tracking-wide text-center transition-all active:scale-[0.98] cursor-pointer"
          style={{
            background: btnBg,
            color: c.textColor || '#ffffff',
            fontFamily: '"Inter", sans-serif',
            boxShadow: `0 4px 15px ${btnBg}40`,
            borderBottom: `3px solid ${btnHoverBg}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = btnHoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = btnBg)}
        >
          <span className="block">{c.btnText || 'Get Your Free Copy Now'}</span>
          {c.subText && (
            <span
              className="block text-[10px] sm:text-xs font-medium mt-1 normal-case tracking-normal opacity-90"
            >
              {c.subText}
            </span>
          )}
        </button>
      </div>
    );
  }

  // ==================== 5. TESTIMONIAL ====================
  if (block.type === 'testimonial') {
    const c = block.content || {};
    return (
      <div
        className="site-block site-testimonial w-full px-5 sm:px-8 py-6 sm:py-8"
        style={{
          background: c.bgColor || '#ffffff',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <div
          className="max-w-lg mx-auto flex flex-col items-center text-center"
        >
          {/* Photo */}
          {c.photoUrl ? (
            <img
              src={safeHttpUrl(c.photoUrl)}
              alt={c.name || 'Testimonial'}
              className="w-full max-w-sm h-auto object-cover rounded-md mb-4"
              style={{ border: '3px solid #e5e7eb' }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4 text-2xl font-black"
              style={{
                background: '#f0f0f5',
                color: '#60606b',
                border: '3px solid #e5e7eb',
              }}
            >
              {(c.name || '?')[0]?.toUpperCase()}
            </div>
          )}

          {/* Quote */}
          <blockquote
            className="text-sm sm:text-base font-normal leading-relaxed italic mb-3"
            style={{ color: '#2f2f2f' }}
          >
            "{c.quote || 'This book changed everything for me...'}"
          </blockquote>

          {/* Name */}
          <p
            className="text-sm font-bold"
            style={{ color: '#1d2e3b' }}
          >
            {c.name || 'John Doe'}
          </p>

          {c.title && (
            <p
              className="text-xs font-medium mt-0.5"
              style={{ color: '#60606b' }}
            >
              {c.title}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ==================== 6. TEXT BLOCK ====================
  if (block.type === 'text_block') {
    const c = block.content || {};
    return (
      <div
        className={`site-block site-text-block ${c.variant ? `site-text-block--${c.variant}` : ''} w-full px-5 sm:px-8 py-5 sm:py-6`}
        style={{
          background: c.bgColor || '#ffffff',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <div className="max-w-lg mx-auto">
          {c.eyebrow && (
            <p className="site-section-eyebrow">{c.eyebrow}</p>
          )}
          {c.title && (
            <h2
              className="text-lg sm:text-xl font-black mb-3 text-center"
              style={{ color: c.titleColor || '#1d2e3b' }}
            >
              {c.title}
            </h2>
          )}
          <div
            className="text-sm sm:text-base font-normal leading-relaxed"
            style={{ color: c.textColor || '#2f2f2f' }}
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(c.text, '<p>Your text here...</p>') }}
          />
        </div>
      </div>
    );
  }

  // ==================== 7. DIVIDER ====================
  if (block.type === 'divider') {
    const c = block.content || {};
    if (c.style === 'space') {
      return <div className="w-full" style={{ height: c.height || '24px', background: c.bgColor || '#ffffff' }} />;
    }
    return (
      <div
        className="site-block site-divider w-full px-5 sm:px-8 py-3"
        style={{ background: c.bgColor || '#ffffff' }}
      >
        <hr
          className="max-w-lg mx-auto"
          style={{
            border: 'none',
            borderTop: `${c.thickness || '1px'} ${c.lineStyle || 'solid'} ${c.color || '#e5e7eb'}`,
          }}
        />
      </div>
    );
  }

  // ==================== 8. FOOTER ====================
  if (block.type === 'footer') {
    const c = block.content || {};
    return (
      <div
        className="site-block site-footer w-full px-5 sm:px-8 py-6 sm:py-8 text-center"
        style={{
          background: c.bgColor || '#000000',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        {c.logoText && (
          <p
            className="text-base sm:text-lg font-black tracking-tight mb-3 uppercase"
            style={{ color: c.logoColor || '#ffffff' }}
          >
            {c.logoText}
          </p>
        )}

        {c.logoImage && (
          <div className="flex justify-center mb-3">
            <img
              src={c.logoImage}
              alt="Logo"
              className="h-6 sm:h-8 object-contain"
            />
          </div>
        )}

        {c.links && (
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-3">
            {(c.links as string[]).map((link: string, i: number) => (
              <span
                key={i}
                className="text-xs font-medium cursor-pointer hover:underline"
                style={{ color: '#bbbbc9' }}
              >
                {link}
              </span>
            ))}
          </div>
        )}

        <p
          className="text-[10px] sm:text-xs font-normal leading-relaxed"
          style={{ color: '#bbbbc9', lineHeight: '200%' }}
        >
          {c.copyright || '© 2025 All Rights Reserved'}
        </p>

        {c.disclaimer && (
          <p
            className="text-[9px] sm:text-[10px] font-normal leading-relaxed mt-2 max-w-sm mx-auto"
            style={{ color: '#6b6b7b' }}
          >
            {c.disclaimer}
          </p>
        )}
      </div>
    );
  }

  // ==================== 9. STICKY CHECKOUT (legacy compat) ====================
  if (block.type === 'sticky_checkout') {
    const c = block.content || {};
    return (
      <div
        className={`bottom-0 left-0 w-full p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 flex justify-center ${isEditing ? 'sticky' : 'fixed'}`}
        style={{
          background: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <button
          onClick={() => onCTAClick && onCTAClick(block)}
          className="w-full max-w-md mx-auto py-3.5 sm:py-4 px-6 rounded-md font-extrabold text-sm sm:text-base uppercase tracking-wide transition-all active:scale-[0.98] cursor-pointer text-center"
          style={{
            background: '#00b200',
            color: '#ffffff',
            boxShadow: '0 4px 15px rgba(0,178,0,0.25)',
            borderBottom: '3px solid #009900',
          }}
        >
          {c.btnText || 'ПРОДОЛЖИТЬ'}
        </button>
      </div>
    );
  }

  // ==================== 10. LESSON GUIDE ====================
  if (block.type === 'lesson_guide') {
    const c = block.content || {};
    return (
      <div className="w-full px-4 sm:px-8 py-6 sm:py-8" style={{ fontFamily: '"Inter", sans-serif', background: '#f8fafc' }}>
        <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          
          {/* Header */}
          <div className="bg-indigo-600 px-6 py-5">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 mb-3">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">📱 ЭКРАН</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {c.title || 'Урок 1: Твой первый премиум-сайт руками ИИ'}
            </h1>
          </div>

          <div className="p-6">
            {/* Promise */}
            <div className="mb-6">
              <p className="text-sm font-bold text-slate-800 leading-relaxed p-4 bg-indigo-50 text-indigo-900 rounded-2xl border border-indigo-100">
                ⚡ <span className="opacity-90">{c.subtitle || '15 минут. 0 строчек кода с твоей стороны. Готовый актив на экране.'}</span>
              </p>
            </div>

            {/* Video Player */}
            <div className="mb-8 relative group rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-slate-900 aspect-video flex items-center justify-center cursor-pointer">
              <TrackedYouTubeEmbed
                src={safeHttpUrl(c.videoUrl, "https://www.youtube.com/embed/S2pEicQ1760")}
                title={c.title || 'Урок'}
                className="w-full h-full border-none"
              />
            </div>

            {/* Algorithm */}
            <div className="mb-8 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              <div className="pl-5">
                <h3 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-2">
                  {c.algorithmTitle || 'Твой план на ближайшие 15 минут:'}
                </h3>
                <div className="text-sm font-medium text-slate-700 leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: sanitizeRichText(c.algorithmText, '<p>Мы не учим теорию. За этот результат малый бизнес уже платит по 300–500.</p>') }} />
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => {
                if (c.buttonAction === 'open_url' && c.buttonUrl) {
                  const targetUrl = safeHttpUrl(c.buttonUrl);
                  if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
                }
                if (onCTAClick) onCTAClick(block);
              }}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-black text-sm sm:text-base uppercase tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
            >
              {c.btnText || 'ПЕРЕЙТИ К СЛЕДУЮЩЕМУ ШАГУ'}
            </button>

          </div>
        </div>
      </div>
    );
  }

  // ==================== LEGACY BLOCK COMPAT ====================
  // Map old block types to new ones with a visual hint
  if (['challenge_hero', 'vsl_hero', 'letter_section', 'proof_wall', 'offer_stack', 'urgency_timer'].includes(block.type)) {
    return (
      <div
        className="p-5 border-2 border-dashed rounded-xl m-4 text-center"
        style={{
          borderColor: '#fbbf24',
          background: '#fffbeb',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <p className="font-bold text-sm mb-1" style={{ color: '#92400e' }}>
          ⚠️ Устаревший блок: [{block.type}]
        </p>
        <p className="text-xs" style={{ color: '#b45309' }}>
          Этот блок был заменён. Удалите его и добавьте новые блоки из палитры.
        </p>
      </div>
    );
  }

  // Fallback
  return (
    <div className="p-4 border border-dashed border-red-200 bg-red-50 text-red-500 text-center m-4 rounded-xl text-xs">
      <p className="font-bold">[{block.type}] block not supported</p>
    </div>
  );
}

export function CourseInfoCard({ content }: { content: any }) {
  const title = content?.headlinePart1 || content?.headlineText || 'Курс по автоворонкам';
  const desc = content?.subHeadline || content?.description || 'Научитесь автоматизировать продажи с помощью ИИ';
  const imageUrl = content?.videoThumbnail || content?.imageUrl || '';

  return (
    <div
      className="site-course-card bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4"
      style={{ fontFamily: '"Inter", sans-serif' }}
    >
      {imageUrl ? (
        <img
          src={safeHttpUrl(imageUrl)}
          alt={title}
          className="w-full h-40 object-cover rounded-xl"
        />
      ) : (
        <div className="w-full h-40 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-wider">
          Нет изображения
        </div>
      )}
      <div>
        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block mb-1">
          Обзор этапа воронки
        </span>
        <h3 className="font-bold text-base text-slate-900 leading-snug">
          {title}
        </h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {desc}
        </p>
      </div>
      <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] font-semibold text-slate-400">
        <span>⭐ 4.6 Amazon</span>
        <span>Доступ мгновенный</span>
      </div>
    </div>
  );
}
