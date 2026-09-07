import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, Star } from 'lucide-react';

/* ── Кинетический заголовок: слова выезжают по очереди, акцент — «живые чернила» ── */
export function KineticTitle({ words, accentFrom }: { words: string[]; accentFrom: number }) {
  return (
    <>
      {words.map((word, index) => (
        <React.Fragment key={index}>
          <span className="vsl2-word">
            <span
              className={index >= accentFrom ? 'vsl2-ink italic' : undefined}
              style={{ ['--d' as any]: `${0.12 + index * 0.11}s` }}
            >
              {word}
            </span>
          </span>
          {index < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </>
  );
}

/* ── Счётчик, оживающий при попадании в кадр ── */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1400,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(to * eased));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

const CHIP_SPOTS: Array<{ left?: string; right?: string; top?: string; bottom?: string; tilt: string; delay: string }> = [
  { left: '-7%', top: '14%', tilt: '-5deg', delay: '0s' },
  { right: '-9%', top: '46%', tilt: '4deg', delay: '0.8s' },
  { left: '-3%', bottom: '8%', tilt: '-3deg', delay: '1.6s' },
];

/* ── Браузер-мокап с живым мини-сайтом — «продукт» урока вместо книги ── */
export function Vsl2SiteMockup({ url, chips, small }: { url: string; chips?: string[]; small?: boolean }) {
  return (
    <div className={`vsl2-scene relative w-full ${small ? 'max-w-[250px]' : 'max-w-[330px]'}`} aria-hidden>
      <div className="vsl2-browser w-full p-1.5">
        {/* Панель браузера */}
        <div className="flex items-center gap-1.5 px-2.5 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 flex-1 truncate rounded-md bg-[#22304e]/5 px-2.5 py-1 text-center font-mono text-[9px] font-bold text-[#22304e]/60">
            {url}
          </span>
        </div>

        {/* Мини-сайт, который «живёт» внутри */}
        <div className="vsl2-mini">
          <div className="vsl2-mini-glow" />
          <div className="relative p-3.5">
            <div className="flex items-center justify-between">
              <span className="h-2 w-2 rounded-full bg-[#e63232]" />
              <span className="flex gap-1.5">
                <i className="h-1 w-6 rounded-full bg-white/25" />
                <i className="h-1 w-6 rounded-full bg-white/25" />
                <i className="h-1 w-6 rounded-full bg-white/25" />
              </span>
            </div>

            <div className="mt-5">
              <div className="vsl2-mini-bar h-3 w-4/5" />
              <div className="vsl2-mini-bar mt-1.5 h-3 w-3/5" style={{ animationDelay: '0.4s' }} />
              <div className="mt-2.5 h-1.5 w-2/3 rounded-full bg-white/20" />
              <div className="vsl2-mini-btn mt-3.5 h-6 w-24" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="vsl2-mini-card h-12 p-1.5" style={{ ['--d' as any]: `${i * 0.35}s` }}>
                  <div className="h-1 w-3/4 rounded-full bg-white/30" />
                  <div className="mt-1 h-1 w-1/2 rounded-full bg-white/15" />
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden">
              <div className="vsl2-mini-marquee">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="h-1.5 w-10 shrink-0 rounded-full bg-white/12" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {chips?.slice(0, CHIP_SPOTS.length).map((chip, index) => {
        const spot = CHIP_SPOTS[index];
        return (
          <span
            key={chip}
            className="vsl2-chip px-3 py-1.5 text-[10px] font-extrabold text-[#22304e]"
            style={{
              left: spot.left,
              right: spot.right,
              top: spot.top,
              bottom: spot.bottom,
              ['--tilt' as any]: spot.tilt,
              ['--d' as any]: spot.delay,
            }}
          >
            {chip}
          </span>
        );
      })}
    </div>
  );
}

export interface SiteMock {
  url: string;
  brand: string;
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  nav: string[];
  accent: string;
  accent2?: string;
}

/* ── Реалистичный мини-лендинг (вместо wireframe-заглушки) ── */
export function RealSiteMockup({ site, small }: { site: SiteMock; small?: boolean }) {
  const a = site.accent;
  const a2 = site.accent2 || a;
  return (
    <div className={`vsl-card overflow-hidden ${small ? 'rounded-[18px]' : 'rounded-[22px]'}`}>
      {/* Панель браузера */}
      <div className="flex items-center gap-1.5 border-b border-[#22304e]/8 bg-white px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        <span className="ml-2 flex-1 truncate rounded-md bg-[#22304e]/5 px-2 py-1 text-center font-mono text-[9px] font-bold text-[#22304e]/55">
          {site.url}
        </span>
      </div>

      {/* Сам «сайт» */}
      <div className="relative overflow-hidden bg-[#080b12]">
        {/* фон-свечение бренда */}
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-50 blur-2xl"
          style={{ background: a }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{ background: `radial-gradient(120% 80% at 85% 0%, ${a}38, transparent 55%)` }}
          aria-hidden
        />

        {/* Навигация */}
        <div className="relative flex items-center justify-between px-3.5 pt-3">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white">{site.brand}</span>
          <span className="hidden items-center gap-2.5 min-[420px]:flex">
            {site.nav.map((item) => (
              <span key={item} className="text-[8px] font-semibold uppercase tracking-wide text-white/45">{item}</span>
            ))}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[8px] font-extrabold text-white shadow-sm"
            style={{ background: a }}
          >
            {site.cta}
          </span>
        </div>

        {/* Hero */}
        <div className="relative px-3.5 pb-3.5 pt-4">
          <div className="text-[8px] font-extrabold uppercase tracking-[0.22em]" style={{ color: a2 }}>
            {site.eyebrow}
          </div>
          <div className={`mt-1.5 font-black leading-[1.04] text-white ${small ? 'text-[16px]' : 'text-[19px]'}`} style={{ whiteSpace: 'pre-line' }}>
            {site.headline}
          </div>
          <p className="mt-2 max-w-[88%] text-[9px] font-medium leading-4 text-white/55">{site.sub}</p>
          <div className="mt-3 flex items-center gap-2.5">
            <span
              className="rounded-lg px-3 py-1.5 text-[9px] font-extrabold text-white"
              style={{ background: `linear-gradient(120deg, ${a}, ${a2})`, boxShadow: `0 8px 20px -8px ${a}` }}
            >
              {site.cta} →
            </span>
            <span className="flex items-center gap-1">
              <span className="flex gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={8} className="fill-[#f6c945] text-[#f6c945]" />
                ))}
              </span>
              <span className="text-[8px] font-bold text-white/55">4.9</span>
            </span>
          </div>
        </div>

        {/* Галерея работ */}
        <div className="relative grid grid-cols-3 gap-1.5 px-3.5 pb-3.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="relative h-9 overflow-hidden rounded-md"
              style={{ background: `linear-gradient(150deg, ${a}${i === 1 ? '99' : '55'}, #0d111c)` }}
            >
              <span className="absolute bottom-1 left-1 h-1 w-5 rounded-full bg-white/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Стеклянный 3D-куб ── */
function Cube({ size }: { size: number }) {
  return (
    <div className="vsl3-cube" style={{ width: size, height: size, ['--s' as any]: `${size / 2}px` }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

/* ── 3D-фон: перспективный пол + парящие объекты + параллакс за мышью ── */
export function Vsl3Background() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const tick = () => {
      raf = 0;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty('--px', (cx * 18).toFixed(2));
      el.style.setProperty('--py', (cy * 12).toFixed(2));
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        raf = requestAnimationFrame(tick);
      }
    };

    const onMove = (event: MouseEvent) => {
      tx = (event.clientX / window.innerWidth - 0.5) * 2;
      ty = (event.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="vsl3-scene" aria-hidden>
      {/* Дальний слой: аврора-пятна */}
      <div className="vsl3-layer" style={{ ['--depth' as any]: 0.4 }}>
        <div className="vsl2-blob vsl2-blob--navy" />
        <div className="vsl2-blob vsl2-blob--peach" />
        <div className="vsl2-blob vsl2-blob--mint" />
      </div>

      {/* Средний слой: пол */}
      <div className="vsl3-layer" style={{ ['--depth' as any]: 0.9 }}>
        <div className="vsl3-floor" />
      </div>

      {/* Ближний слой: 3D-объекты */}
      <div className="vsl3-layer" style={{ ['--depth' as any]: 1.7 }}>
        <div className="vsl3-drift hidden md:block" style={{ top: '14%', right: '7%' }}>
          <Cube size={62} />
        </div>
        <div className="vsl3-drift hidden md:block" style={{ top: '56%', left: '5%', ['--d' as any]: '1.4s' }}>
          <Cube size={36} />
        </div>
        <div className="vsl3-ring hidden md:block" style={{ top: '17%', left: '6%', width: 140, height: 140 }} />
        <div className="vsl3-orb" style={{ top: '6%', left: '16%', width: 26, height: 26, ['--d' as any]: '0.6s' }} />
        <div className="vsl3-orb" style={{ top: '58%', right: '11%', width: 64, height: 64, ['--d' as any]: '2s' }} />
        <div className="vsl3-orb" style={{ top: '36%', left: '12%', width: 16, height: 16, ['--d' as any]: '3.1s' }} />
      </div>
    </div>
  );
}

/* ── Премиальная CTA: бегущая световая рамка + глянец + стрелка ── */
export function Vsl3Cta({
  title,
  subtitle,
  onClick,
  big,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  big?: boolean;
}) {
  return (
    <button onClick={onClick} className={`vsl3-cta ${big ? 'px-8 py-5' : 'px-6 py-4'}`}>
      <span className="relative z-10 flex items-center justify-between gap-4">
        <span className="text-left">
          <span className={`block font-extrabold leading-tight ${big ? 'text-xl md:text-[24px]' : 'text-lg md:text-xl'}`}>
            {title}
          </span>
          {subtitle && (
            <span className="mt-1 block text-[11px] font-semibold leading-4 text-white/85 md:text-xs">{subtitle}</span>
          )}
        </span>
        <span className="vsl3-cta-arrow">
          <ArrowRight size={19} />
        </span>
      </span>
    </button>
  );
}

export interface Vsl3TestimonialItem {
  quote: string;
  name: string;
  role: string;
  initials: string;
  gradient: string;
  note: string;
}

/* ── Отзывы v3: градиентная рамка, крупная серифная цитата, 3D-наклон ── */
export function Vsl3Testimonials({ items }: { items: Vsl3TestimonialItem[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {items.map((item, index) => (
        <figure
          key={item.name}
          className={`vsl3-tcard relative flex h-full flex-col p-7 md:p-8 ${index % 2 === 1 ? 'md:translate-y-5' : ''}`}
          data-lesson-reveal
          style={{ transitionDelay: `${index * 140}ms` }}
        >
          <div className="flex items-start justify-between">
            <span className="vsl3-quote vsl-serif select-none" aria-hidden>“</span>
            <span className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={13} className="vsl-star fill-current" />
              ))}
            </span>
          </div>

          <blockquote className="vsl-serif mt-4 flex-1 text-[19px] font-medium leading-relaxed text-[#22304e] md:text-[21px]">
            {item.quote}
          </blockquote>

          <figcaption className="mt-6 flex items-center gap-3.5 border-t border-[#22304e]/8 pt-5">
            <span className="vsl3-avatar-ring">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-[13px] text-base font-extrabold text-white"
                style={{ background: item.gradient }}
              >
                {item.initials}
              </span>
            </span>
            <span>
              <span className="flex items-center gap-1.5 text-[15px] font-extrabold text-[#22304e]">
                {item.name}
                <BadgeCheck size={15} className="text-[#17a84e]" />
              </span>
              <span className="block text-xs font-semibold text-[#22304e]/50">{item.role}</span>
            </span>
            <span className="vsl-hand ml-auto -rotate-3 text-right text-lg font-bold leading-5 text-[#d92626]">
              {item.note}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
