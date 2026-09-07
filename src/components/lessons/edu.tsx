import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { useTelegramMiniApp } from '../webapp/miniAppContext';

/* ── Логотип Google Gemini (градиентная искра) ── */
export function GeminiLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gemini-grad" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285F4" />
          <stop offset="0.35" stopColor="#9168C0" />
          <stop offset="0.7" stopColor="#B96CA6" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.2c0 5.965 4.835 10.8 10.8 10.8-5.965 0-10.8 4.835-10.8 10.8 0-5.965-4.835-10.8-10.8-10.8C7.165 12 12 7.165 12 1.2Z"
        fill="url(#gemini-grad)"
      />
    </svg>
  );
}

/* ── Логотип Pinterest ── */
export function PinterestLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#E60023"
        d="M12.017 2C6.48 2 2 6.477 2 12.017c0 4.236 2.636 7.856 6.356 9.312-.088-.79-.167-2.005.035-2.868.182-.78 1.172-4.971 1.172-4.971s-.299-.599-.299-1.485c0-1.39.806-2.428 1.81-2.428.853 0 1.265.64 1.265 1.408 0 .858-.546 2.14-.828 3.329-.236.995.499 1.807 1.48 1.807 1.778 0 3.144-1.874 3.144-4.58 0-2.393-1.72-4.068-4.177-4.068-2.845 0-4.516 2.135-4.516 4.34 0 .859.331 1.781.744 2.281a.3.3 0 0 1 .07.288l-.279 1.133c-.044.183-.145.223-.335.134-1.249-.581-2.03-2.406-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.965-.525-2.291-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621A10 10 0 0 0 12.017 22c5.539 0 10.017-4.477 10.017-10.017C22.034 6.477 17.557 2 12.017 2Z"
      />
    </svg>
  );
}

/* ── Кнопки ── */
export function EduButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  arrow = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'lg';
  arrow?: boolean;
  className?: string;
}) {
  const pad = size === 'lg' ? 'px-7 py-4 text-base' : 'px-5 py-3 text-[14px]';
  const base = `inline-flex items-center justify-center gap-2 ${pad} ${className}`;
  if (variant === 'ghost') {
    return (
      <button onClick={onClick} className={`edu-btn-ghost ${base}`}>
        {children}
        {arrow && <ArrowRight size={18} />}
      </button>
    );
  }
  return (
    <button onClick={onClick} className={`edu-btn ${base}`}>
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
        {arrow && <ArrowRight size={18} />}
      </span>
    </button>
  );
}

/* ── Пилюля-метка ── */
export function EduPill({
  children,
  tone = 'light',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'light' | 'dark' | 'blue' | 'mint';
  className?: string;
}) {
  const tones: Record<string, string> = {
    light: 'bg-[#161a22]/[0.05] text-[#161a22]/70 border border-[#161a22]/8',
    dark: 'bg-white/10 text-white/80 border border-white/15 backdrop-blur',
    blue: 'bg-[#2563eb]/12 text-[#2563eb] border border-[#2563eb]/20',
    mint: 'bg-[#5fded0]/20 text-[#0a5247] border border-[#5fded0]/40',
  };
  return (
    <span className={`edu-pill inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ── Заголовок секции ── */
export function EduHeading({
  kicker,
  title,
  sub,
  light = false,
  align = 'left',
}: {
  kicker?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  light?: boolean;
  align?: 'left' | 'center';
}) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : '';
  return (
    <div className={`max-w-2xl ${alignCls}`}>
      {kicker && (
        <div className={`mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] ${light ? 'text-[#5fded0]' : 'text-[#2563eb]'}`}>
          {kicker}
        </div>
      )}
      <h2 className={`edu-h text-[28px] sm:text-[34px] md:text-[40px] ${light ? 'text-white' : 'text-[#161a22]'}`}>
        {title}
      </h2>
      {sub && (
        <p className={`mt-4 text-[15px] font-medium leading-7 md:text-base ${light ? 'text-white/65' : 'text-[#5b6270]'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── Тёмный hero урока: лаймовое свечение, Oswald-заголовок, без фото ── */
export function EduLessonHero({
  pill,
  title,
  subtitle,
  children,
}: {
  pill: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const heroRef = useRef<HTMLElement | null>(null);
  const isSoftCopy = useTelegramMiniApp();

  useEffect(() => {
    if (!isSoftCopy) return undefined;

    const hero = heroRef.current;
    if (!hero) return undefined;

    let frame: number | null = null;
    const syncDepth = () => {
      frame = null;
      const rect = hero.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight * 0.22);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      hero.style.setProperty('--hero-depth', progress.toFixed(4));
    };

    const scheduleDepth = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(syncDepth);
    };

    syncDepth();
    window.addEventListener('scroll', scheduleDepth, { passive: true });
    window.addEventListener('resize', scheduleDepth);
    return () => {
      window.removeEventListener('scroll', scheduleDepth);
      window.removeEventListener('resize', scheduleDepth);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [isSoftCopy]);

  return (
    <section
      ref={heroRef}
      data-depth-scroll={isSoftCopy ? 'true' : undefined}
      className="edu-hero edu-hero-plain relative w-full overflow-hidden"
      style={{ minHeight: '100dvh' }}
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_18%,rgba(185,255,76,0.18),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_84%_8%,rgba(37,99,235,0.18),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.92))]" />

      <div className="relative z-20 mx-auto flex min-h-[100dvh] max-w-6xl flex-col items-center justify-center px-5 py-12 text-center md:px-8 md:py-16">
        <div className="hero-anim hero-fade" style={{ animationDelay: '0.12s' }}>
          <EduPill tone="dark">{pill}</EduPill>
        </div>
        <h1
          className={`hero-title mx-auto mt-5 max-w-5xl text-white ${isSoftCopy ? '' : 'hero-anim hero-reveal'}`}
          style={isSoftCopy ? undefined : { animationDelay: '0.25s' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`mx-auto mt-4 max-w-2xl text-[15px] font-medium leading-7 text-white/72 md:mt-5 md:text-lg ${isSoftCopy ? '' : 'hero-anim hero-fade'}`}
            style={isSoftCopy ? undefined : { animationDelay: '0.5s' }}
          >
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

/* ── Большая CTA-кнопка с подписью (переход к следующему уроку) ── */
export function EduNextCta({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <EduButton size="lg" arrow onClick={onClick} className="max-w-md whitespace-normal text-center leading-snug">
        {label}
      </EduButton>
      {hint && <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">{hint}</span>}
    </div>
  );
}

/* ── Карточка-промпт с копированием (для тёмных секций) ── */
export function EduPromptCard({ index, title, text }: { index: number; title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1700);
  };

  return (
    <div className="edu-card-dark overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[3px] bg-[#baff4a]/15 text-xs font-black text-[#baff4a]">
            {index}
          </span>
          <h3 className="text-sm font-extrabold text-white">{title}</h3>
        </div>
        <button
          onClick={copy}
          className={`inline-flex shrink-0 items-center gap-2 rounded-[4px] border px-3.5 py-2 text-xs font-extrabold transition ${
            copied
              ? 'border-[#baff4a]/40 bg-[#baff4a]/12 text-[#baff4a]'
              : 'border-white/15 text-white/70 hover:border-[#baff4a]/45 hover:text-[#baff4a]'
          }`}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Готово' : 'Копировать'}
        </button>
      </div>
      <div className="p-5 font-mono text-xs leading-6 text-white/70">{text}</div>
    </div>
  );
}

/* ── Тёмный edu-футер урока ── */
export function EduFooter({ stageLabel }: { stageLabel: string }) {
  return (
    <footer className="edu-dark border-t border-white/10 py-10 text-center">
      <div className="inline-flex items-baseline gap-2">
        <span className="edu-h text-lg tracking-tight text-white">AI SITE</span>
        <span className="rounded-[2px] border border-[#baff4a] px-2 py-0.5 text-xs font-extrabold tracking-[0.14em] text-[#baff4a]">LAB</span>
      </div>
      <div className="mt-3 text-xs font-medium text-white/45">AI Site Lab · © 2026 · {stageLabel}</div>
      <div className="mt-3 flex items-center justify-center gap-3 text-xs font-semibold text-white/35">
        <span className="cursor-pointer transition hover:text-white/70">Условия</span>
        <span>·</span>
        <span className="cursor-pointer transition hover:text-white/70">Поддержка</span>
        <span>·</span>
        <span className="cursor-pointer transition hover:text-white/70">Конфиденциальность</span>
      </div>
    </footer>
  );
}
