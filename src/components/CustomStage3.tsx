import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Crown, Gift, MessageSquareText, Star, X } from 'lucide-react';
import MockPayment from './MockPayment';
import { useScrollReveal } from './lessons/useScrollReveal';
import { VslVideo } from './lessons/vsl';
import { EduButton, EduFooter, EduHeading, EduLessonHero, EduPromptCard } from './lessons/edu';
import { ChallengeBonusCard } from './lessons/ChallengeBonusCard';


interface CustomStage3Props {
  onCTAClick: (block?: any) => void;
  isPhonePreview?: boolean;
  stageData?: any;
}


const MODULES = [
  {
    title: 'Инструмент вайб-кодера и премиум-фронтенд',
    text: 'Переходим в Antigravity. Учимся собирать многостраничные сайты, дорогие анимации и полноценные Telegram Web Apps.',
  },
  {
    title: 'Интеграция с AmoCRM',
    text: 'Связываем сайт с бизнес-системой клиента: заявка появляется в базе, менеджер видит лид, ничего не теряется.',
  },
  {
    title: 'ИИ-продавец в WhatsApp / Telegram',
    text: 'Настраиваем ИИ-бота, который сам пишет клиенту, отрабатывает вопросы по базе знаний и помогает закрывать сделку 24/7.',
  },
  {
    title: 'Свой IT-сервис и приём платежей',
    text: 'Собираем ИИ-платформу с регистрацией, личными кабинетами и оплатами картой или криптой.',
  },
  {
    title: 'Монетизация: стратегия выхода на $2000+',
    text: 'Как упаковать навыки, вести переговоры и продавать внедрение ИИ-систем бизнесу на чеки от $1500.',
  },
];

const PKG_BASE = [
  'Доступ к модулям 1, 2, 3 и 4',
  'Установка и полная настройка Antigravity',
  'Интеграции AmoCRM, Telegram Web Apps и ИИ-ботов',
  'Сборка своего сервиса с платежами',
  'Итог: умеешь собирать IT-активы, за которые бизнес платит от $1500',
];

const PKG_PRO = [
  'Все из пакета IT-Архитектор',
  'Модуль 5: стратегия поиска VIP-клиентов и продаж',
  'Готовый исходный код ИИ-сервиса',
  'ИИ-трафик: органика из Instagram и Threads',
  'Шаблоны договоров и коммерческих предложений',
  'База из 30 архитектурных промптов при оплате сегодня',
];

const MONEY_SCRIPTS = [
  {
    title: 'Способ 1: пост / сторис',
    text: 'Просто зацените эту систему 😍 Закончил сборку нового проекта. Премиум-дизайн, плавная анимация, а главное — прикрутил логику: теперь все заявки с сайта моментально падают владельцу прямо в Telegram. Ни один клиент не потеряется.\n\nЕсли кому-то из знакомых нужно так же стильно упаковать свой проект и настроить поток заявок — маякните в личку. Возьму на этой неделе один проект, сделаю очень выгодные условия 🤝',
  },
  {
    title: 'Способ 2: скрипт для знакомых',
    text: 'Привет! Слушай, я тут плотно занялся веб-разработкой. Собираю премиум-сайты с интеграцией Telegram-ботов. Видел, что у твоего проекта до сих пор нет нормального сайта.\n\nЯ ради интереса уже набросал для тебя классный черновик. Посмотри с телефона: [Твоя ссылка на Netlify].\n\nЕсли нравится — за $200 по себестоимости допилю туда твои тексты, привяжу бота для заявок и отдам навсегда. Что скажешь?',
  },
  {
    title: 'Способ 3: холодный трафик',
    text: 'Здравствуйте, [Имя]! Наткнулся на ваш профиль. Заметил, что у вас трафик идёт просто на голую ссылку в мессенджер. Вы теряете клиентов, которым важно посмотреть ваши услуги в красивой упаковке.\n\nЯ веб-разработчик. Мне понравился ваш проект, и я ради интереса уже собрал для вас новый премиум-сайт. Вот живая ссылка: [Твоя ссылка на Netlify].\n\nОткройте с телефона. Если вам нравится — цена всего $300. Я полностью адаптирую его под вас и привяжу форму заявок напрямую к вашему Telegram. Если нет — ничего страшного, хорошего дня!',
  },
];

export default function CustomStage3({ onCTAClick, isPhonePreview, stageData }: CustomStage3Props) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{ id: string; amount: number } | null>(null);
  const offerViewedTrackedRef = useRef(false);
  useScrollReveal();

  const pkg1Price = Number(stageData?.pkg1Price ?? stageData?.price ?? 49);
  const pkg1OldPrice = Number(stageData?.pkg1OldPrice ?? stageData?.oldPrice ?? 149);
  const pkg2Price = Number(stageData?.pkg2Price ?? 99);
  const pkg2OldPrice = Number(stageData?.pkg2OldPrice ?? 299);
  const currencySymbol = stageData?.currencySymbol || "$";


  const trackStageEvent = useCallback((event: 'offer_viewed' | 'checkout_started') => {
    if (isPhonePreview) return;

    const params = new URLSearchParams(window.location.search);
    const funnelId = params.get('funnel');
    const stageId = params.get('stage');
    const chatId = Number(params.get('chatId') || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 0);
    if (!funnelId || !stageId || !Number.isSafeInteger(chatId) || chatId <= 0) return;

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        chatId,
        event,
        funnelId,
        stageId,
        authTs: params.get('authTs') || '',
        authSig: params.get('authSig') || '',
        telegramInitData: window.Telegram?.WebApp?.initData || '',
      }),
    }).catch(console.error);
  }, [isPhonePreview]);

  const scrollToOffer = () => {
    document.getElementById('offer-packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleOpenCheckout = (pkgId: string, amount: number) => {
    trackStageEvent('checkout_started');

    const params = new URLSearchParams(window.location.search);
    const funnelId = params.get('funnel') || '';
    const stageId = params.get('stage') || '';
    const chatId = params.get('chatId') || String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '');

    params.set('offerId', pkgId);
    params.set('amount', amount.toString());
    params.set('funnelId', funnelId);
    params.set('stageId', stageId);
    if (chatId) params.set('chatId', chatId);
    window.history.pushState({ path: `${window.location.pathname}?${params.toString()}` }, '', `${window.location.pathname}?${params.toString()}`);
    setSelectedPackage({ id: pkgId, amount });
    setShowCheckout(true);
  };

  const handleCloseCheckout = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    ['offerId', 'amount', 'funnelId', 'stageId'].forEach((key) => params.delete(key));
    const nextSearch = params.toString();
    window.history.replaceState(
      { path: `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}` },
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
    );
    setShowCheckout(false);
    setSelectedPackage(null);
  }, []);

  useEffect(() => {
    if (isPhonePreview) return;

    const target = document.getElementById('offer-packages');
    if (!target) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting || entry.intersectionRatio < 0.35 || offerViewedTrackedRef.current) return;
      offerViewedTrackedRef.current = true;
      trackStageEvent('offer_viewed');
      observer.disconnect();
    }, { threshold: [0.35] });

    observer.observe(target);
    return () => observer.disconnect();
  }, [isPhonePreview, trackStageEvent]);

  return (
    <>
      <div className="edu-page lesson-font-body relative min-h-screen overflow-x-clip">
        {/* ═══════════ HERO ═══════════ */}
        <EduLessonHero
          pill="Урок 4 из 4 · финальная сборка"
          title={
            <>
              Математика денег.
              <br />
              <span className="text-[#baff4a]">Монетизируй</span> новый навык
            </>
          }
          subtitle={
            <>
              Бизнес платит не за часы в коде. Бизнес платит за решённую проблему, заявки и понятный результат.
            </>
          }
        >
          <div className="hero-anim hero-fade mx-auto mt-6 w-full max-w-[600px] md:mt-8 md:max-w-[820px]" style={{ animationDelay: '0.7s' }}>
            <VslVideo
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Урок 4"
              strip="Маркетинг, упаковка и деньги"
              compact={isPhonePreview}
              duration="12:00"
              caption="Как перейти от разовых заказов к IT-системам"
              stripClassName="bg-[#E6CF5D] text-[#111006] border-t border-[#f2df88]"
            />
          </div>

          <div className="hero-anim hero-fade mt-6 flex flex-col items-center gap-2" style={{ animationDelay: '0.9s' }}>
            <EduButton size="lg" arrow onClick={scrollToOffer} className="max-w-md whitespace-normal text-center leading-snug">
              Забрать систему за $49 / $99
            </EduButton>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">Практикум · два формата участия</span>
          </div>

          <div className="hero-anim hero-fade mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-white/60" style={{ animationDelay: '1.05s' }}>
            <span className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={13} className="fill-[#E6CF5D] text-[#E6CF5D]" />
              ))}
            </span>
            4.9 — средняя оценка выпускников
          </div>
        </EduLessonHero>

        {/* ═══════════ ДЕНЬГИ + СКРИПТЫ ═══════════ */}
        <section className="bg-white py-16 md:py-20">
          <div className="mx-auto max-w-5xl px-5 md:px-8">
            <div data-lesson-reveal>
              <EduHeading
                align="center"
                title="Ты получил навык. Теперь переходим к бизнесу."
                sub="За 3 урока ты создал премиальный сайт, привязал Telegram-бота и вывел проект в интернет. Теперь главный вопрос: как найти клиентов на $300–500?"
              />
            </div>

            <div className="edu-card mt-9 p-7 md:p-8" data-lesson-reveal>
              <p className="text-[17px] font-semibold leading-8 text-[#3b424e]">
                Главное правило рынка: клиенту не важно, писал ты код месяц или управлял нейросетью один вечер. Ему важно, что сайт выглядит дорого и приносит заявки.
              </p>
              <p className="mt-4 text-[17px] font-semibold leading-8 text-[#3b424e]">
                Твоя ценность — в результате. На рынке за такие проекты стабильно платят <span className="font-black text-[#161a22]">$300–500</span>.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3" data-lesson-reveal>
              {MONEY_SCRIPTS.map((script, index) => (
                <div key={script.title} className="min-w-0">
                  <EduPromptCard index={index + 1} title={script.title} text={script.text} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ СМЕНА ПАРАДИГМЫ ═══════════ */}
        <section className="edu-soft py-16 md:py-20">
          <div className="mx-auto max-w-5xl px-5 md:px-8">
            <div data-lesson-reveal>
              <EduHeading
                light
                align="center"
                title="Путь к чекам $1500+"
                sub="Заработать $300–500 на сайте — отличный старт. Но если продавать только сайты, ты быстро упрёшься в потолок."
              />
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-[0.95fr_1.05fr]" data-lesson-reveal>
              <div className="edu-card-dark p-7 md:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#CEF563]/15 text-[#CEF563]">
                  <MessageSquareText size={23} />
                </div>
                <h3 className="edu-h mt-6 text-3xl text-white">Бизнес покупает IT-системы</h3>
                <p className="mt-4 text-[15px] font-semibold leading-7 text-white/65">
                  Крупный бизнес не покупает просто картинки в интернете. Он покупает системы, которые заменяют менеджеров, собирают заявки, пишут клиентам и окупаются за неделю.
                </p>
              </div>

              <div className="edu-card-dark p-7 md:p-8">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#CEF563]">Пример оффера</div>
                <p className="mt-5 text-[22px] font-black leading-tight text-white md:text-[28px]">
                  «Я соберу вам кастомную CRM-систему, и когда лид оставит заявку, ИИ-продавец сам напишет ему в WhatsApp и закроет сделку».
                </p>
                <p className="mt-5 text-[15px] font-semibold leading-7 text-white/60">
                  За такую систему бизнес отдаст $1000–2000 не глядя, потому что она решает понятную денежную проблему.
                </p>
              </div>
            </div>

            <div className="mt-10" data-lesson-reveal>
              <EduHeading
                light
                align="center"
                title="Практикум: свой софт и автоматизации"
                sub="Мы уходим из браузерных песочниц в профессиональную среду Antigravity и собираем продукты, которые можно продавать бизнесу или запускать как свой SaaS."
              />
            </div>

            <div className="mt-9 grid gap-x-10 gap-y-6 md:grid-cols-2">
              {MODULES.map((module, index) => (
                <div key={module.title} className="flex gap-4 border-t border-white/10 pt-5" data-lesson-reveal style={{ transitionDelay: `${index * 70}ms` }}>
                  <span className="edu-h text-2xl leading-none text-white/25">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-base font-black leading-snug text-white">{module.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-7 text-white/58">{module.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ СЕКРЕТНЫЙ БОНУС ЗА 100% ═══════════ */}
        <section className="bg-black/90 py-10">
          <ChallengeBonusCard expertUsername={stageData?.expertTelegramUsername} />
        </section>

        {/* ═══════════ ПАКЕТЫ ═══════════ */}
        <section id="offer-packages" className="bg-white scroll-mt-6 py-16 md:py-20">

          <div className="mx-auto max-w-5xl px-5 md:px-8">
            <div data-lesson-reveal>
              <EduHeading align="center" title="Выбирай свой формат" sub="Первый пакет — техническая база. Второй — бизнес под ключ, исходники и монетизация." />
            </div>

            <div className="mt-9 grid gap-5 md:grid-cols-2" data-lesson-reveal>
              {/* IT-Архитектор */}
              <div className="edu-offer-card edu-card-dark flex flex-col p-7 md:p-8">
                <span className="inline-flex w-fit items-center rounded-[3px] border border-white/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/60">
                  Техническая база
                </span>
                <h3 className="edu-h mt-6 text-3xl text-white">IT-Архитектор</h3>
                <p className="mt-2 text-sm font-medium leading-7 text-white/55">
                  Вся техническая база: от сайтов до своих сервисов.
                </p>

                <div className="mt-7 flex-1 space-y-3.5">
                  {PKG_BASE.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm font-medium text-white/80">
                      <Check size={16} className="mt-0.5 shrink-0 text-[#baff4a]" />
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="flex flex-wrap items-end gap-3">
                    <span className="edu-price text-white">{currencySymbol}{pkg1Price}</span>
                    <span className="pb-2 text-base font-black text-white/42 line-through">{currencySymbol}{pkg1OldPrice}</span>
                  </div>
                  <button
                    onClick={() => handleOpenCheckout('offer-pkg-1', pkg1Price)}
                    className="tariff-cta mt-6 flex w-full items-center justify-center gap-2 rounded-[6px] border border-white/20 px-5 py-4 text-sm font-extrabold text-white transition hover:border-[#baff4a]/50 hover:text-[#baff4a]"
                  >
                    Забрать техническую базу
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>

              {/* IT-Владелец */}
              <div className="edu-offer-card relative flex flex-col overflow-hidden rounded-[14px] border border-[#baff4a]/35 bg-[#0c1206] p-7 md:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#baff4a]/15 blur-3xl" aria-hidden />
                <span className="relative inline-flex w-fit items-center gap-1.5 rounded-[3px] bg-[#baff4a]/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#baff4a]">
                  <Crown size={11} />
                  Лучший выбор
                </span>
                <h3 className="edu-h relative mt-6 text-3xl text-white">IT-Владелец</h3>
                <p className="relative mt-2 text-sm font-medium leading-7 text-white/60">
                  Исходный код, трафик, монетизация и юридическая база.
                </p>

                <div className="relative mt-7 flex-1 space-y-3.5">
                  {PKG_PRO.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm font-medium text-white/85">
                      <Check size={16} className="mt-0.5 shrink-0 text-[#baff4a]" />
                      {item}
                    </div>
                  ))}
                </div>

                <div className="relative mt-8 border-t border-white/10 pt-6">
                  <div className="flex flex-wrap items-end gap-3">
                    <span className="edu-price text-white">{currencySymbol}{pkg2Price}</span>
                    <span className="pb-2 text-base font-black text-white/42 line-through">{currencySymbol}{pkg2OldPrice}</span>
                  </div>
                  <button
                    onClick={() => handleOpenCheckout('offer-pkg-2', pkg2Price)}
                    className="tariff-cta tariff-cta-primary mt-6 flex w-full items-center justify-center gap-2 rounded-[6px] bg-[#CEF563] px-5 py-4 text-sm font-extrabold text-[#071006] transition hover:brightness-105"
                  >
                    Забрать исходники и трафик
                    <ChevronRight size={17} />
                  </button>

                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ БОНУС + ЧЕСТНАЯ ЛОГИКА ═══════════ */}
        <section className="edu-dark py-16 md:py-20">
          <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
            <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#CEF563]/15 text-[#CEF563]" data-lesson-reveal>
              <Gift size={26} />
            </div>
            <p className="edu-h mx-auto max-w-2xl text-2xl text-white md:text-[30px]" data-lesson-reveal>
              Бонус сегодня: <span className="text-[#baff4a]">30 архитектурных промптов</span>
            </p>
            <p className="mx-auto mt-5 text-[15px] font-medium leading-7 text-white/65" data-lesson-reveal>
              Только готовый исходный код из пакета IT-Владелец на рынке разработки обошёлся бы тебе в $3000+. Одна проданная связка «Сайт + AmoCRM + ИИ-бот» окупает практикум навсегда.
            </p>
            <div className="mt-9" data-lesson-reveal>
              <EduButton size="lg" arrow onClick={scrollToOffer} className="max-w-md whitespace-normal text-center leading-snug">
                Забрать систему за $49 / $99
              </EduButton>
            </div>
          </div>
        </section>

        <EduFooter stageLabel="Урок 4 из 4 — математика денег" />
      </div>

      {showCheckout && selectedPackage && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/82 p-4 pt-16 backdrop-blur-md"
          onClick={handleCloseCheckout}
        >
          <div className="relative w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={handleCloseCheckout}
              className="fixed right-4 top-4 z-[140] grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-black/70 text-white shadow-2xl shadow-black/40 backdrop-blur-md transition hover:bg-white hover:text-black"
              aria-label="Закрыть оплату"
            >
              <X size={20} />
            </button>
            <MockPayment />
          </div>
        </div>
      )}
    </>
  );
}
