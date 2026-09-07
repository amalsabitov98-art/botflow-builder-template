import React, { useState } from 'react';
import { ChevronDown, Play, Plus, Star } from 'lucide-react';
import TrackedYouTubeEmbed from '../TrackedYouTubeEmbed';

/* ── Красная анонс-плашка сверху ── */
export function VslTopBar({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`vsl-topbar relative z-40 px-4 text-center ${compact ? 'py-2' : 'py-2.5 md:py-3'}`}>
      <div className={`font-extrabold uppercase tracking-[0.08em] ${compact ? 'text-[10px]' : 'text-[11px] md:text-[13px]'}`}>
        {children}
      </div>
    </div>
  );
}

/* ── Рейтинг со звёздами ── */
export function VslStars({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2.5 ${className}`}>
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            size={19}
            className="vsl-star vsl-star-twinkle fill-current"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </div>
      <span className="vsl-stars-label text-[15px] font-bold text-[#22304e]">{label}</span>
    </div>
  );
}

export function VslPremiumHero({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`vsl-premium-hero relative overflow-hidden ${compact ? 'mt-4 rounded-[24px] px-4 py-5' : 'mt-6 rounded-[34px] px-5 py-8 md:px-8 md:py-10'}`}>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,12,0.96)_0%,rgba(8,10,14,0.98)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0,transparent_32%,rgba(255,255,255,0.03)_68%,transparent_100%)]" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

/* ── Большая зелёная CTA с подписью ── */
export function VslCta({
  title,
  subtitle,
  onClick,
  big,
  className = '',
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  big?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`vsl-cta-green vsl-cta-pulse ls-cta-shine w-full rounded-2xl px-6 text-center ${big ? 'py-5' : 'py-4'} ${className}`}
    >
      <span className={`block font-extrabold leading-tight ${big ? 'text-xl md:text-[26px]' : 'text-lg md:text-xl'}`}>
        {title}
      </span>
      {subtitle && (
        <span className="mt-1.5 block text-[11px] font-semibold leading-4 text-white/85 md:text-xs">{subtitle}</span>
      )}
    </button>
  );
}

/* ── 3D-книга — мокап «продукта» урока ── */
export function VslBook({
  tag,
  title,
  subtitle,
  series,
  small,
}: {
  tag: string;
  title: React.ReactNode;
  subtitle: string;
  series: string;
  small?: boolean;
}) {
  return (
    <div className="vsl-book-scene flex justify-center" aria-hidden>
      <div className={`vsl-book ${small ? 'h-[260px] w-[182px]' : 'h-[330px] w-[230px]'}`}>
        <div className="vsl-book-back" />
        <div className="vsl-book-pages" />
        <div className="vsl-book-cover flex flex-col">
          <div className="vsl-topbar px-3 py-2.5 text-center text-[9px] font-extrabold uppercase tracking-[0.18em]">
            {tag}
          </div>
          <div className="flex flex-1 flex-col justify-between p-4">
            <div>
              <div className={`vsl-serif font-bold uppercase leading-[1.08] tracking-tight text-white ${small ? 'text-[22px]' : 'text-[30px]'}`}>
                {title}
              </div>
              <div className="mt-2 h-px w-12 bg-white/25" />
              <div className="mt-2.5 text-[10px] font-bold uppercase leading-4 tracking-[0.14em] text-white/55">
                {subtitle}
              </div>
            </div>
            <div>
              <div className="mb-2 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1 w-5 rounded-full bg-[#e63232]" />
                ))}
              </div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">{series}</div>
            </div>
          </div>
        </div>
        <div className="vsl-book-shadow" />
      </div>
    </div>
  );
}

/* ── Видео в тёмной рамке с красной подписью ── */
export function VslVideo({
  src,
  title,
  strip,
  compact,
  duration = '12:40',
  caption = 'Видеоурок · смотри и повторяй',
  stripClassName = 'vsl-video-strip',
}: {
  src: string;
  title: string;
  strip: string;
  compact?: boolean;
  duration?: string;
  caption?: string;
  stripClassName?: string;
}) {
  const isSampleVideo = !src || src.includes('dQw4w9WgXcQ') || src.includes('S2pEicQ1760');

  return (
    <div className="vsl-video-frame overflow-hidden rounded-[20px] p-1.5 md:rounded-[26px] md:p-2">
      <div className="relative aspect-video overflow-hidden rounded-[14px] bg-black md:rounded-[18px]">
        {isSampleVideo ? (
          <div className="vsl-vp vsl-video-placeholder absolute inset-0 flex cursor-pointer flex-col justify-between p-3.5 text-white md:p-4">
            {/* Cinematic animated poster */}
            <div className="vsl-vp-mesh absolute inset-0" aria-hidden />
            <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(255,255,255,0.10),transparent_55%)]" aria-hidden />

            {/* Top row: lesson badge + duration */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/85 backdrop-blur md:text-[10px]">
                <span className="vsl-vp-rec h-1.5 w-1.5 rounded-full bg-[#e63232]" />
                {title}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-black/35 px-2 py-1 text-[10px] font-bold tabular-nums text-white/80 backdrop-blur md:text-[11px]">
                <Play size={10} className="fill-current" />
                {duration}
              </span>
            </div>

            {/* Center: play button with pulse rings */}
            <div className="relative z-10 flex flex-1 items-center justify-center">
              <div className="vsl-vp-click-cue pointer-events-none absolute left-[calc(50%+36px)] top-0 flex items-center gap-1 md:left-[calc(50%+46px)] md:top-[17%]">
                <svg viewBox="0 0 54 34" className="h-6 w-8 md:h-7 md:w-10" aria-hidden>
                  <path d="M50 7 C 35 2, 18 7, 9 22" />
                  <path d="M19 20 L 8 24 L 9 12" />
                </svg>
                <span className="vsl-hand text-[22px] font-bold leading-none text-white/78 md:text-[26px]">жми</span>
              </div>
              <span className="relative grid place-items-center">
                <span className="vsl-vp-ring absolute" aria-hidden />
                <span className="vsl-vp-ring vsl-vp-ring-2 absolute" aria-hidden />
                <span className="vsl-vp-play-core relative grid h-[58px] w-[58px] place-items-center rounded-full bg-white md:h-[68px] md:w-[68px]">
                  <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-[#0b0f1a] md:h-7 md:w-7" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </div>

            {/* Bottom: caption + scrubber */}
            <div className="relative z-10">
              <p className="vsl-hand mb-2.5 text-center text-[18px] font-bold leading-none text-white/72 md:text-[22px]">{caption}</p>
              <div className="flex items-center gap-2.5">
                <span className="text-[9px] font-bold tabular-nums text-white/55 md:text-[10px]">0:00</span>
                <div className="relative h-1 flex-1 rounded-full bg-white/15">
                  <div className="vsl-vp-scrub absolute inset-y-0 left-0 w-[7%] rounded-full" />
                  <span className="absolute left-[7%] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
                </div>
                <span className="text-[9px] font-bold tabular-nums text-white/55 md:text-[10px]">{duration}</span>
              </div>
            </div>
          </div>
        ) : (
          <TrackedYouTubeEmbed src={src} title={title} className="absolute inset-0 h-full w-full border-0" />
        )}
      </div>
      {!isSampleVideo && (
        <div className={`${stripClassName} rounded-b-[14px] px-4 text-center font-extrabold uppercase italic tracking-[0.1em] md:rounded-b-[18px] ${compact ? 'py-2 text-[10px]' : 'py-2.5 text-[11px] md:py-3 md:text-sm'}`}>
          {strip}
        </div>
      )}
    </div>
  );
}

/* ── Рукописная стрелка-закорючка ── */
export function VslArrow({ flip = false, className = '' }: { flip?: boolean; className?: string }) {
  return (
    <svg
      className={`vsl-note-arrow ${className}`}
      viewBox="0 0 90 70"
      width="72"
      height="56"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      <path d="M82 8 C 60 14, 28 10, 18 34 C 12 49, 22 56, 30 52" />
      <path d="M22 40 L 30 52 L 40 48" />
    </svg>
  );
}

export interface VslTestimonialItem {
  quote: string;
  name: string;
  role: string;
  initials: string;
  gradient: string;
  note: string;
}

/* ── Отзывы с рукописными пометками, как в классических VSL ── */
export function VslTestimonials({ items }: { items: VslTestimonialItem[] }) {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-6">
      {items.map((item, index) => (
        <div key={item.name} className="relative" data-lesson-reveal style={{ transitionDelay: `${index * 140}ms` }}>
          <div className="vsl-card vsl-card-hover flex h-full flex-col gap-4 rounded-[22px] p-6 sm:flex-row sm:items-start">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-lg"
              style={{ background: item.gradient }}
            >
              {item.initials}
            </div>
            <div>
              <p className="text-[15px] font-semibold leading-7 text-[#22304e]/85">«{item.quote}»</p>
              <div className="vsl-serif mt-3 text-lg font-bold text-[#22304e]">{item.name}</div>
              <div className="text-xs font-semibold text-[#22304e]/50">{item.role}</div>
            </div>
          </div>
          <div className={`pointer-events-none absolute -bottom-9 flex items-end gap-1 ${index % 2 === 0 ? 'left-2' : 'right-2 flex-row-reverse'}`}>
            <span className="vsl-hand vsl-note text-[22px] font-bold leading-6">{item.note}</span>
            <VslArrow flip={index % 2 !== 0} className="-mb-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Кнопка-аккордеон «Узнать больше» ── */
export function VslLearnMore({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mt-16 text-center" data-lesson-reveal>
        <button
          onClick={() => setOpen((value) => !value)}
          className="vsl-card vsl-card-hover inline-flex items-center gap-2.5 rounded-2xl px-7 py-4 text-sm font-extrabold text-[#22304e]"
        >
          {open ? <ChevronDown size={17} /> : <Plus size={17} />}
          {label}
        </button>
        {!open && (
          <div className="mt-3 flex justify-center text-[#22304e]/35" aria-hidden>
            <ChevronDown size={18} className="vsl-bounce-down" />
          </div>
        )}
      </div>
      {open && <div className="animate-fade-in-up">{children}</div>}
    </>
  );
}

/* ── Заголовок секции в VSL-стиле ── */
export function VslSectionTitle({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="mb-9 text-center">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#d92626]">{kicker}</div>
      <h2 className="vsl-serif mt-3 text-3xl font-bold tracking-tight text-[#22304e] md:text-5xl">{children}</h2>
    </div>
  );
}

/* ── Красная бегущая строка между секциями ── */
export function VslMarquee({ words }: { words: string[] }) {
  return (
    <div className="vsl-strip ls-marquee mt-16 rounded-2xl py-3.5" aria-hidden>
      <div className="ls-marquee-track text-sm font-extrabold uppercase tracking-[0.12em]">
        {[...words, ...words].map((word, index) => (
          <span key={index} className="flex items-center gap-10 whitespace-nowrap">
            {word}
            <span className="text-[10px]">★</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Чёрный футер с дисклеймером ── */
export function VslFooter({ stageLabel }: { stageLabel: string }) {
  return (
    <footer className="vsl-footer relative z-10 mt-20 px-4 py-12 text-center">
      <div className="mx-auto max-w-3xl">
        <div className="inline-flex items-baseline gap-2">
          <span className="vsl-serif text-xl font-bold tracking-tight text-white">AI SITE</span>
          <span className="rounded border border-[#e63232] px-2 py-0.5 text-sm font-extrabold tracking-[0.14em] text-[#e63232]">
            LAB
          </span>
        </div>
        <div className="mt-4 text-xs font-semibold text-white/55">
          AI Site Lab — © 2026 Все права защищены · {stageLabel}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-white/40">
          <span className="cursor-pointer transition hover:text-white/70">Условия</span>
          <span>·</span>
          <span className="cursor-pointer transition hover:text-white/70">Поддержка</span>
          <span>·</span>
          <span className="cursor-pointer transition hover:text-white/70">Конфиденциальность</span>
        </div>
        <p className="mx-auto mt-7 max-w-xl text-[11px] font-medium leading-5 text-white/35">
          ДИСКЛЕЙМЕР О РЕЗУЛЬТАТАХ: мы не верим в «быстрые деньги» — только в практику, реальные навыки и
          аккуратную работу с клиентами. Результат зависит от твоих действий после уроков.
        </p>
      </div>
    </footer>
  );
}
