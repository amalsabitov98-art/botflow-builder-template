import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Send, Smartphone, Star, Zap } from 'lucide-react';
import { useScrollReveal } from './lessons/useScrollReveal';
import { useTelegramMiniApp } from './webapp/miniAppContext';
import { VslVideo } from './lessons/vsl';
import { RealSiteMockup, type SiteMock } from './lessons/vsl2';
import { EduHeading, EduNextCta, EduPill, GeminiLogo, PinterestLogo } from './lessons/edu';
import { ParallaxComponent } from './ui/parallax-scrolling';

interface CustomStage0Props {
  onCTAClick: (block?: any) => void;
  isPhonePreview?: boolean;
  stageData?: any;
}


const SPOTLIGHT_R = 260;
const BG_IMAGE_NIGHT_DESKTOP = '/images/lesson1-night-1280.webp';
const BG_IMAGE_NIGHT_MOBILE = '/images/lesson1-night-760.webp';
const BG_IMAGE_DAY_DESKTOP = '/images/lesson1-day-1280.webp';
const BG_IMAGE_DAY_MOBILE = '/images/lesson1-day-760.webp';

const TOOLS = [
  { title: 'Google Gemini', desc: 'Пишет реальный код сайта по описанию обычными словами.', href: 'https://gemini.google.com/', tag: 'Генерация', Logo: GeminiLogo, logoClass: 'edu-tool-logo-gemini' },
  { title: 'Pinterest', desc: 'Банк референсов: находишь дорогие примеры дизайна под нишу.', href: 'https://www.pinterest.com/', tag: 'Референсы', Logo: PinterestLogo, logoClass: 'edu-tool-logo-pinterest' },
];

const PROBLEMS = [
  { Icon: Smartphone, text: 'Криво открывается на мобильном телефоне — а это 80% всего трафика.' },
  { Icon: Zap, text: 'Сайт статичный: нет дорогих анимаций при скролле.' },
  { Icon: Send, text: 'Клиент вводит номер в форму и жмёт «Отправить» — а заявка уходит в пустоту.' },
];

interface StudentWork {
  site: SiteMock;
  tag: string;
}

const STUDENT_WORKS: StudentWork[] = [
  { tag: 'Собран за вечер', site: { url: 'auto-lux.site', brand: 'AUTO·LUX', eyebrow: 'Детейлинг', headline: 'Авто\nкак новое', sub: 'Керамика, химчистка, защита кузова', cta: 'Записаться', nav: ['Услуги', 'Цены'], accent: '#baff4a', accent2: '#f0ffbd' } },
  { tag: 'Первый клиент за неделю', site: { url: 'sweet-lab.site', brand: 'SWEET·LAB', eyebrow: 'Десерты на заказ', headline: 'Торты,\nкоторые помнят', sub: 'Свадебные, детские, корпоративные', cta: 'Заказать', nav: ['Меню', 'Отзывы'], accent: '#baff4a', accent2: '#f0ffbd' } },
  { tag: 'Заявки в Telegram', site: { url: 'sharp-barber.site', brand: 'SHARP', eyebrow: 'Barbershop', headline: 'Стрижка,\nкоторая в точку', sub: 'Мужские стрижки, бритьё, уход', cta: 'Записаться', nav: ['Услуги', 'Мастера'], accent: '#baff4a', accent2: '#f0ffbd' } },
  { tag: 'Продан за $250', site: { url: 'pro-coach.site', brand: 'PRO·COACH', eyebrow: 'Персональный тренер', headline: 'Форма мечты\nбез фанатизма', sub: 'Программы тренировок и питания', cta: 'Записаться', nav: ['Программы', 'Цены'], accent: '#baff4a', accent2: '#f0ffbd' } },
  { tag: 'Готов без кода', site: { url: 'nail-bar.site', brand: 'NAIL·BAR', eyebrow: 'Студия маникюра', headline: 'Ногти,\nна которые смотрят', sub: 'Маникюр, дизайн, наращивание', cta: 'Записаться', nav: ['Услуги', 'Работы'], accent: '#baff4a', accent2: '#f0ffbd' } },
];

const CINEMATIC_STUDENT_ACCENTS = [
  ['#9fc5d9', '#e5f0f5'],
  ['#d5b889', '#f0e3ce'],
  ['#8fc7b2', '#d8eee5'],
  ['#b8a7c8', '#e4dcec'],
  ['#d59b9b', '#f0dada'],
] as const;

const CINEMATIC_STUDENT_WORKS = STUDENT_WORKS.map((work, index) => ({
  ...work,
  site: {
    ...work.site,
    accent: CINEMATIC_STUDENT_ACCENTS[index][0],
    accent2: CINEMATIC_STUDENT_ACCENTS[index][1],
  },
}));

function StudentWorkCard({ work, compact }: { work: StudentWork; compact?: boolean }) {
  return (
    <div className={`${compact ? 'w-[218px]' : 'w-[250px] sm:w-[270px]'} shrink-0 snap-center`}>
      <RealSiteMockup site={work.site} small />
      <div className={`${compact ? 'mt-2 text-[11px]' : 'mt-3 text-[13px]'} inline-flex items-center gap-1.5 px-1 font-black uppercase tracking-[0.04em] text-[#baff4a]`}>
        <Check size={14} />
        {work.tag}
      </div>
    </div>
  );
}

function CircularStudentGallery({ items, radius = 470, autoRotateSpeed = 0.018 }: { items: StudentWork[]; radius?: number; autoRotateSpeed?: number }) {
  const [rotation, setRotation] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isMobileGallery, setIsMobileGallery] = useState(() => window.innerWidth < 768);
  const scrollTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const syncViewport = () => {
      setIsMobileGallery(window.innerWidth < 768);
    };

    const handleScroll = () => {
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      const section = document.getElementById('student-works');
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
      setRotation(progress * 360);

      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false);
      }, 180);
    };

    syncViewport();
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', syncViewport);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('resize', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    const autoRotate = () => {
      if (!isScrolling) {
        setRotation((prev) => prev + autoRotateSpeed);
      }
      animationFrameRef.current = requestAnimationFrame(autoRotate);
    };

    animationFrameRef.current = requestAnimationFrame(autoRotate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [autoRotateSpeed, isScrolling]);

  const anglePerItem = 360 / items.length;
  const galleryRadius = isMobileGallery ? 255 : radius;
  const cardWidth = isMobileGallery ? 218 : 292;
  const cardTopOffset = isMobileGallery ? 134 : 160;

  return (
    <div
      role="region"
      aria-label="Карусель работ учеников"
      className="relative mx-auto flex h-[355px] w-full max-w-6xl items-center justify-center overflow-hidden sm:h-[390px] md:h-[450px]"
      style={{ perspective: isMobileGallery ? '1100px' : '1800px' }}
    >
      <div className="student-gallery-fade student-gallery-fade-left pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-[#050505] to-transparent sm:w-24 md:w-36" />
      <div className="student-gallery-fade student-gallery-fade-right pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-[#050505] to-transparent sm:w-24 md:w-36" />
      <div
        className="relative h-full w-full transition-transform duration-300 ease-out"
        style={{
          transform: `rotateY(${rotation}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {items.map((work, index) => {
          const itemAngle = index * anglePerItem;
          const relativeAngle = (itemAngle + rotation + 360) % 360;
          const normalizedAngle = Math.abs(relativeAngle > 180 ? 360 - relativeAngle : relativeAngle);
          const opacity = Math.max(0.25, 1 - normalizedAngle / 150);
          const scale = 0.82 + (1 - normalizedAngle / 180) * 0.18;

          return (
            <div
              key={work.site.url}
              role="group"
              aria-label={work.site.brand}
              className="absolute left-1/2 top-1/2"
              style={{
                width: `${cardWidth}px`,
                marginLeft: `${cardWidth / -2}px`,
                marginTop: `${cardTopOffset * -1}px`,
                opacity,
                transform: `rotateY(${itemAngle}deg) translateZ(${galleryRadius}px) scale(${scale})`,
                transition: 'opacity 0.25s linear',
              }}
            >
              <StudentWorkCard work={work} compact={isMobileGallery} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevealLayer({ image, cursorX, cursorY }: { image: string; cursorX: number; cursorY: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [maskImage, setMaskImage] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, SPOTLIGHT_R);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.75)');
    gradient.addColorStop(0.75, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(0.88, 'rgba(255,255,255,0.12)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, SPOTLIGHT_R, 0, Math.PI * 2);
    ctx.fill();
    setMaskImage(`url(${canvas.toDataURL()})`);
  }, [cursorX, cursorY]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ display: 'none' }} />
      <div
        className="absolute inset-0 z-30 bg-center bg-cover bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url(${image})`,
          WebkitMaskImage: maskImage,
          maskImage,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
      />
    </>
  );
}

export default function CustomStage0({ onCTAClick, isPhonePreview, stageData }: CustomStage0Props) {
  useScrollReveal();

  const mouse = useRef({ x: -999, y: -999 });
  const smooth = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });
  const [useMobileHeroImages, setUseMobileHeroImages] = useState(() => window.innerWidth <= 640);
  const isSoftCopy = useTelegramMiniApp();
  const goNext = () => onCTAClick();

  useEffect(() => {
    if (isSoftCopy) return undefined;

    const setDefaultSpotlight = () => {
      setUseMobileHeroImages(window.innerWidth <= 640);
      const point = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.42 };
      mouse.current = point;
      smooth.current = point;
      setCursorPos(point);
    };

    const handlePointerMove = (event: PointerEvent) => {
      mouse.current = { x: event.clientX, y: event.clientY };
    };

    setDefaultSpotlight();
    const tick = () => {
      smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1;
      smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1;
      setCursorPos({ x: smooth.current.x, y: smooth.current.y });
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', setDefaultSpotlight);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', setDefaultSpotlight);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isSoftCopy]);

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

  const baseHeroImage = isSoftCopy
    ? (useMobileHeroImages ? BG_IMAGE_DAY_MOBILE : BG_IMAGE_DAY_DESKTOP)
    : (useMobileHeroImages ? BG_IMAGE_NIGHT_MOBILE : BG_IMAGE_NIGHT_DESKTOP);
  const revealHeroImage = useMobileHeroImages ? BG_IMAGE_DAY_MOBILE : BG_IMAGE_DAY_DESKTOP;

  return (
    <div className={`edu-page lesson-font-body relative min-h-screen overflow-x-clip ${isSoftCopy ? 'lesson-one-cinematic' : ''}`}>
      {/* ═══════════ HERO: заголовок → обещание → видео → CTA ═══════════ */}
      <section
        ref={heroRef}
        data-depth-scroll={isSoftCopy ? 'true' : undefined}
        className={`edu-hero relative w-full overflow-hidden bg-black ${isSoftCopy ? 'edu-hero--parallax' : ''}`}
        style={{ minHeight: '100dvh' }}
      >
        {isSoftCopy ? (
          <ParallaxComponent className="absolute inset-0 z-10" />
        ) : (
          <div
            className="hero-zoom absolute inset-0 z-10 bg-center bg-cover bg-no-repeat"
            style={{ backgroundImage: `url(${baseHeroImage})` }}
          />
        )}
        {!isSoftCopy && <RevealLayer image={revealHeroImage} cursorX={cursorPos.x} cursorY={cursorPos.y} />}
        <div className="absolute inset-0 z-40 bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.40)_42%,rgba(0,0,0,0.86)_100%)] pointer-events-none" />
        <div className="absolute inset-0 z-40 bg-[radial-gradient(circle_at_50%_25%,rgba(185,255,76,0.22),transparent_36%)] pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 z-40 h-40 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.92))] pointer-events-none" />

        <div className="relative z-50 mx-auto flex min-h-[100dvh] max-w-6xl flex-col items-center justify-center px-5 py-10 text-center sm:py-12 md:px-8 md:py-14">
          <div className="hero-anim hero-fade" style={{ animationDelay: '0.12s' }}>
            <EduPill tone="dark">Урок 1 из 4 · бесплатный курс</EduPill>
          </div>
          <h1 className="hero-title mx-auto mt-5 max-w-5xl text-white">
            <span className="hero-anim hero-reveal block" style={{ animationDelay: '0.25s' }}>
              Твой первый <span className="text-[#baff4a]">премиум-сайт</span>
            </span>
            <span className="hero-anim hero-reveal block" style={{ animationDelay: '0.42s' }}>
              {' '}руками ИИ
            </span>
          </h1>
          <p className="hero-anim hero-fade mx-auto mt-4 max-w-2xl text-[15px] font-medium leading-7 text-white/72 md:mt-5 md:text-lg" style={{ animationDelay: '0.62s' }}>
            15 минут. 0 строчек кода с твоей стороны. <span className="font-semibold text-white">Готовый актив на экране.</span>
          </p>

          <div className="hero-anim hero-fade mx-auto mt-6 w-full max-w-[600px] md:mt-8 md:max-w-[820px]" style={{ animationDelay: '0.78s' }}>
            <VslVideo
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Урок 1"
              strip="Смотри урок и повторяй за мной"
              compact={isPhonePreview}
              duration="14:32"
              caption="Смотри, как я делаю это за 3 минуты — и повторяй за мной"
              stripClassName="bg-[#E6CF5D] text-[#111006] border-t border-[#f2df88]"
            />
          </div>

          <div className="hero-anim hero-fade mt-6" style={{ animationDelay: '0.92s' }}>
            <EduNextCta label="Я прошёл урок 1" hint="Следующий — заявки в Telegram" onClick={goNext} />
          </div>

          <div className="hero-anim hero-fade mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-white/60" style={{ animationDelay: '1.05s' }}>
            <span className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={13} className="fill-[#E6CF5D] text-[#E6CF5D]" />
              ))}
            </span>
            4.9 — средняя оценка учеников курса
          </div>
        </div>
      </section>

      {/* ═══════════ ИНСТРУМЕНТЫ ИЗ УРОКА ═══════════ */}
      <section className="lesson-one-tools bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <div data-lesson-reveal>
            <EduHeading
              light={isSoftCopy}
              align="center"
              kicker={isSoftCopy ? '01 · Всё для старта' : undefined}
              title="Инструменты из урока"
              sub="Всё бесплатное — ничего покупать не нужно. Открывай и работай прямо в браузере."
            />
          </div>
          <div className="mx-auto mt-9 grid max-w-3xl gap-4 sm:grid-cols-2" data-lesson-reveal>
            {TOOLS.map(({ title, desc, href, tag, Logo, logoClass }) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="edu-card edu-card-hover group relative flex items-start gap-4 p-6">
                <span className={`edu-tool-logo-shell ${logoClass} grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f3f4f7]`}>
                  <Logo size={26} />
                </span>
                <span className="flex-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#161a22]/60">{tag}</span>
                  <span className="mt-1 block text-lg font-extrabold text-[#161a22]">{title}</span>
                  <span className="mt-1.5 block text-sm font-medium leading-6 text-[#5b6270]">{desc}</span>
                </span>
                <ArrowUpRight size={18} className="shrink-0 text-[#9aa1ad] transition group-hover:text-[#161a22]" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ РАБОТЫ НАШИХ УЧЕНИКОВ ═══════════ */}
      <section id="student-works" className="lesson-one-gallery edu-soft py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div data-lesson-reveal>
            <EduHeading light={isSoftCopy} align="center" kicker={isSoftCopy ? '02 · Уже после урока' : undefined} title="Работы наших учеников" />
            <p className="mx-auto mt-4 max-w-lg text-center text-sm font-medium leading-6 text-white/50">
              Примеры учебных работ, которые можно собрать уже после первого урока.
            </p>
          </div>
          <div className="mt-8 -mx-5 sm:mx-0" data-lesson-reveal>
            <CircularStudentGallery items={isSoftCopy ? CINEMATIC_STUDENT_WORKS : STUDENT_WORKS} />
          </div>
        </div>
      </section>

      {/* ═══════════ САЙТ — ПОКА ДЕКОРАЦИЯ → УРОК 2 ═══════════ */}
      <section className="lesson-one-finale edu-dark py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <div data-lesson-reveal>
            <EduHeading light align="center" kicker={isSoftCopy ? '03 · Дальше — результат' : undefined} title="Сайт выглядит круто, верно?" />
            <p className="mx-auto mt-4 max-w-xl text-center text-[15px] font-medium leading-7 text-white/65">
              Ты только что сэкономил <strong className="font-extrabold text-white">$300 на дизайнере</strong>. Но у нас есть проблема: сейчас твой сайт — это просто <span className="font-bold text-[#baff4a]">красивая декорация.</span>
            </p>
          </div>

          <div className="lesson-one-problem-list edu-card-dark mx-auto mt-9 max-w-2xl space-y-4 p-7 md:p-9" data-lesson-reveal>
            {PROBLEMS.map(({ Icon, text }) => (
              <div key={text} className="lesson-one-problem flex items-start gap-3.5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[3px] bg-[#baff4a]/15 text-[#baff4a]"><Icon size={17} /></span>
                <p className="text-[15px] font-medium leading-7 text-white/85">{text}</p>
              </div>
            ))}
          </div>

          <p className="edu-h mx-auto mt-10 max-w-2xl text-center text-2xl text-white md:text-[30px]" data-lesson-reveal>
            Бизнес не платит за декорации.
            <br />
            Бизнес платит за <span className="text-[#baff4a]">заявки.</span>
          </p>
          <p className="mx-auto mt-5 max-w-xl text-center text-[15px] font-medium leading-7 text-white/65" data-lesson-reveal>
            В Уроке 2 мы оживим твой сайт: добавим анимации, адаптируем под iPhone и настроим форму так, чтобы заявки от клиентов приходили тебе прямо в Telegram.
          </p>

          <div className="mt-10" data-lesson-reveal>
            <EduNextCta label="Я прошёл урок 1. Идём настраивать заявки" hint="Урок 2" onClick={goNext} />
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="lesson-one-footer edu-dark border-t border-white/10 py-10 text-center">
        <div className="inline-flex items-baseline gap-2">
          <span className="edu-h text-lg tracking-tight text-white">AI SITE</span>
          <span className="rounded-[2px] border border-[#baff4a] px-2 py-0.5 text-xs font-extrabold tracking-[0.14em] text-[#baff4a]">LAB</span>
        </div>
        <div className="mt-3 text-xs font-medium text-white/45">AI Site Lab · © 2026 · Урок 1 из 4 — дизайн с ИИ</div>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs font-semibold text-white/35">
          <span className="cursor-pointer transition hover:text-white/70">Условия</span>
          <span>·</span>
          <span className="cursor-pointer transition hover:text-white/70">Поддержка</span>
          <span>·</span>
          <span className="cursor-pointer transition hover:text-white/70">Конфиденциальность</span>
        </div>
      </footer>
    </div>
  );
}
