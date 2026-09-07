import type { FunnelSite, FunnelStage, StageWebApp } from '../types/funnel';
import type { WebAppBlock } from '../types/webapp';

function block(id: string, type: WebAppBlock['type'], content: Record<string, unknown>): WebAppBlock {
  return { id, type, content };
}

function page(blocks: WebAppBlock[]): StageWebApp {
  return {
    enabled: true,
    access: 'public',
    theme: 'alice',
    pageEvents: [
      { id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: 'Страница открыта', eventKey: 'page_view' },
    ],
    blocks,
  };
}

function entryPage(prefix: string): StageWebApp {
  return page([
    block(`${prefix}-banner`, 'top_banner', {
      text: 'Бесплатная программа · 3 коротких урока',
      bgColor: '#fff1ad',
      textColor: '#171717',
    }),
    block(`${prefix}-hero`, 'headline', {
      preText: 'ПРАКТИЧЕСКИЙ МИНИ-КУРС',
      mainText: 'Получите первый измеримый результат за три урока',
      subText: 'Без длинной теории: каждый урок заканчивается конкретным действием и понятным результатом.',
      bgColor: '#e9e5ff',
      mainTextColor: '#171717',
    }),
    block(`${prefix}-proof`, 'text_block', {
      eyebrow: 'Доказательства',
      variant: 'proof',
      title: 'Люди доходят до результата',
      text: '<ul><li>3 коротких урока без перегруза</li><li>Практика сразу после объяснения</li><li>Готовый итог к завершению курса</li></ul>',
      bgColor: '#ffffff',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-audience`, 'text_block', {
      eyebrow: 'Для кого',
      variant: 'audience',
      title: 'Подойдёт, если вы устали собирать знания по кусочкам',
      text: '<p>Программа ведёт от первой понятной задачи к готовой системе. Не нужно заранее разбираться в инструментах или терминологии.</p>',
      bgColor: '#dcecfb',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-solution`, 'text_block', {
      eyebrow: 'Маршрут',
      variant: 'solution',
      title: 'Три урока — один законченный результат',
      text: '<ul><li>Урок 1 — фундамент и быстрый результат</li><li>Урок 2 — система и разбор ошибок</li><li>Урок 3 — внедрение и план действий</li></ul>',
      bgColor: '#ffffff',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-expertise`, 'text_block', {
      eyebrow: 'Метод',
      variant: 'expertise',
      title: 'Сначала делаем — потом усложняем',
      text: '<p>Каждый следующий урок опирается на предыдущий. Поэтому участник не просто смотрит контент, а последовательно собирает рабочую систему.</p>',
      bgColor: '#dff2dc',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-testimonial`, 'testimonial', {
      quote: 'После первого урока уже было что показать. К финалу всё сложилось в понятный план, который можно использовать дальше.',
      name: 'Участник программы',
      title: 'Результат после трёх уроков',
      bgColor: '#fff1ad',
    }),
    block(`${prefix}-future`, 'text_block', {
      eyebrow: 'Что изменится',
      variant: 'future',
      title: 'Вместо хаоса появится следующий понятный шаг',
      text: '<p>Вы закончите курс не с набором заметок, а с результатом, чек-листом и планом внедрения на ближайшую неделю.</p>',
      bgColor: '#e9e5ff',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-faq`, 'text_block', {
      eyebrow: 'Частые вопросы',
      variant: 'faq',
      title: 'Перед стартом',
      text: '<p><strong>Сколько времени нужно?</strong><br>Уроки короткие, проходить можно в своём темпе.</p><p><strong>Нужна подготовка?</strong><br>Нет, первый урок начинается с основы.</p><p><strong>Будет практика?</strong><br>Да, каждый урок заканчивается конкретным действием.</p>',
      bgColor: '#ffffff',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-cta`, 'cta_button', {
      btnText: 'Начать с первого урока',
      subText: 'Доступ открывается сразу',
      bgColor: '#171717',
      hoverBgColor: '#4947ff',
      sectionBgColor: '#dff2dc',
      textColor: '#ffffff',
    }),
    block(`${prefix}-footer`, 'footer', {
      logoText: 'Учебная программа',
      copyright: 'Три урока · практика · готовый результат',
      bgColor: '#171717',
    }),
  ]);
}

function lessonPage(prefix: string, _lessonNumber: number, title: string): StageWebApp {
  const webApp = page([
    block(`${prefix}-hero`, 'lesson_video_hero', {
      eyebrow: 'Бесплатный практический урок',
      kicker: 'Хотите получить первый результат уже сегодня?',
      title,
      subtitle: 'Покажите человеку один сильный принцип в видео, помогите применить его и предложите недорогой следующий шаг.',
      videoUrl: '',
      duration: '10–15 минут',
      bullets: [
        'Пошаговый продукт с быстрым результатом',
        'Готовые шаблоны для внедрения',
        'Доступ сразу после оплаты',
      ],
      ctaText: 'Получить доступ за 490₽',
      caption: 'Включите звук и досмотрите до конца — внутри одно конкретное действие',
      isPayment: true,
      offerId: `${prefix}-tripwire`,
      amount: 490,
      currency: 'RUB',
      offerLabel: 'Специальное предложение к уроку',
      offerTitle: 'Ваш трипваер',
      price: '490 ₽',
      oldPrice: '4 900 ₽',
      offerNote: 'Разовый платёж · доступ открывается сразу',
      topBannerText: 'Бесплатный урок + специальное предложение после просмотра',
      practiceTitle: 'Сделайте один шаг прямо сейчас',
      practiceText: 'Повторите действие из урока на своём примере. На выполнение достаточно 10–15 минут. Сохраните результат.',
      bonusTitle: 'Не начинайте следующую неделю с пустого листа',
      bonusText: 'Трипваер даёт пошаговые уроки, готовые шаблоны и план внедрения, чтобы превратить разовый результат в систему.',
      finalEyebrow: 'Готовы перейти от одного результата к системе?',
      finalTitle: 'Заберите полный практический набор за 490₽',
      footerTitle: 'Практический мини-курс',
      footerText: 'Уроки, шаблоны и последовательный план внедрения.',
      disclaimer: 'Результаты зависят от исходной ситуации, качества внедрения и регулярности действий.',
    }),
  ]);

  webApp.pageEvents = [
    ...(webApp.pageEvents || []),
    { id: `${prefix}-offer-viewed`, label: 'Оффер показан', eventKey: 'offer_viewed' },
    { id: `${prefix}-checkout-started`, label: 'Оформление начато', eventKey: 'checkout_started' },
    { id: `${prefix}-payment-completed`, label: 'Оплата завершена', eventKey: 'payment_completed' },
  ];

  return webApp;
}

function offerPage(prefix: string): StageWebApp {
  return page([
    block(`${prefix}-banner`, 'top_banner', {
      text: 'Программа завершена · следующий шаг',
      bgColor: '#fff1ad',
      textColor: '#171717',
    }),
    block(`${prefix}-hero`, 'headline', {
      preText: 'ФИНАЛЬНОЕ ПРЕДЛОЖЕНИЕ',
      mainText: 'Теперь соберите полную систему',
      subText: 'Продолжение для тех, кто хочет внедрить результат быстрее и с поддержкой.',
      bgColor: '#e9e5ff',
      mainTextColor: '#171717',
    }),
    block(`${prefix}-proof`, 'text_block', {
      eyebrow: 'Результаты',
      variant: 'proof',
      title: 'Основа уже готова',
      text: '<ul><li>Пройдены три последовательных урока</li><li>Собраны первые рабочие материалы</li><li>Есть план следующего внедрения</li></ul>',
      bgColor: '#ffffff',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-audience`, 'text_block', {
      eyebrow: 'Точка роста',
      variant: 'audience',
      title: 'Самостоятельно можно двигаться дальше — но медленнее',
      text: '<p>На этом этапе чаще всего мешают разрозненные действия, отсутствие обратной связи и попытка улучшить всё одновременно.</p>',
      bgColor: '#dcecfb',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-solution`, 'text_block', {
      eyebrow: 'Решение',
      variant: 'solution',
      title: 'Полная программа превращает знания в систему',
      text: '<p>Вы получаете пошаговый маршрут, расширенные материалы, шаблоны и поддержку на каждом этапе внедрения.</p>',
      bgColor: '#dff2dc',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-expertise`, 'text_block', {
      eyebrow: 'Почему работает',
      variant: 'expertise',
      title: 'Практика построена вокруг реальных задач',
      text: '<p>Каждый модуль заканчивается проверяемым результатом. Вы всегда знаете, что делать сейчас и по какому признаку оценивать качество.</p>',
      bgColor: '#ffffff',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-stack`, 'text_block', {
      eyebrow: 'Внутри',
      variant: 'offer',
      title: 'Всё необходимое для внедрения',
      text: '<ul><li>Полная программа по шагам</li><li>Шаблоны и рабочие материалы</li><li>Обратная связь и поддержка</li></ul>',
      bgColor: '#e9e5ff',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-future`, 'text_block', {
      eyebrow: 'После программы',
      variant: 'future',
      title: 'Результат становится повторяемым',
      text: '<p>Вы сможете не только один раз выполнить задачу, но и повторять процесс для новых проектов без возвращения к хаосу.</p>',
      bgColor: '#fff1ad',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-testimonial`, 'testimonial', {
      quote: 'Самое ценное — ясность. Я перестал метаться между инструментами и начал двигаться по одному понятному маршруту.',
      name: 'Участник полной программы',
      title: 'После внедрения системы',
      bgColor: '#dcecfb',
    }),
    block(`${prefix}-faq`, 'text_block', {
      eyebrow: 'Вопросы',
      variant: 'faq',
      title: 'Перед участием',
      text: '<p><strong>Когда можно начать?</strong><br>Сразу после оплаты.</p><p><strong>Как долго доступна программа?</strong><br>Укажите свои условия доступа в настройках предложения.</p><p><strong>Есть ли поддержка?</strong><br>Добавьте здесь формат и сроки обратной связи.</p>',
      bgColor: '#ffffff',
      titleColor: '#171717',
      textColor: '#171717',
    }),
    block(`${prefix}-cta`, 'cta_button', {
      btnText: 'Получить полный доступ',
      subText: 'Безопасная оплата · доступ сразу',
      bgColor: '#171717',
      hoverBgColor: '#4947ff',
      sectionBgColor: '#dff2dc',
      textColor: '#ffffff',
    }),
    block(`${prefix}-footer`, 'footer', {
      logoText: 'Полная программа',
      copyright: 'Условия участия и реквизиты проекта',
      bgColor: '#171717',
    }),
  ]);
}

export function buildCourseTemplateStages(funnelId: string): FunnelStage[] {
  const definitions = [
    {
      title: 'Бесплатный продающий урок',
      message: '🎬 {name}, бесплатный урок готов.\n\nДайте быстрый результат за 10–15 минут и предложите трипваер прямо на странице урока.',
    },
  ];

  const stages = definitions.map((definition, index): FunnelStage => {
    const id = `${funnelId}-stage-${index + 1}`;
    const webApp = lessonPage(id, 1, 'Дайте быстрый результат и покажите следующий шаг');

    return {
      id,
      index,
      title: definition.title,
      firstMessage: {
        delay: 'Сразу',
        text: definition.message,
        buttonText: 'Смотреть бесплатный урок',
        buttonAction: 'open_webapp',
        buttonStyle: 'primary',
      },
      webApp,
      rules: [],
      reminders: [{
        id: `${id}-reminder-1`,
        delayMinutes: 60,
        delayLabel: '1 час',
        condition: 'not_opened',
        message: '{name}, бесплатный урок уже готов. Посмотрите и повторите одно действие за автором 👇',
        buttonText: 'Смотреть урок',
        buttonAction: 'open_webapp',
      }, {
        id: `${id}-reminder-2`,
        delayMinutes: 180,
        delayLabel: '3 часа',
        condition: 'not_paid',
        message: '{name}, вы уже видели урок, но ещё не забрали практический набор. Специальная цена 490₽ пока действует 👇',
        buttonText: 'Забрать за 490₽',
        buttonAction: 'open_webapp',
      }, {
        id: `${id}-reminder-3`,
        delayMinutes: 1380,
        delayLabel: '23 часа',
        condition: 'not_paid',
        message: '{name}, последнее напоминание: специальная цена 490₽ закончится после сегодняшнего дня.',
        buttonText: 'Последний шанс — 490₽',
        buttonAction: 'open_webapp',
      }],
    };
  });

  return stages.map((stage, index) => {
    const next = stages[index + 1];
    return next
      ? { ...stage, nextStage: { targetStageId: next.id, label: `Далее: ${next.title}` } }
      : { ...stage, nextStage: { label: 'Конец воронки' } };
  });
}

export function buildCourseTemplateSite(funnelId: string, funnelTitle: string, stages: FunnelStage[]): FunnelSite {
  return {
    id: `${funnelId}-site`,
    title: funnelTitle,
    slug: funnelId,
    isPrimary: true,
    pages: stages.map((stage, index) => ({
      id: `${stage.id}-page`,
      title: stage.title,
      slug: index === 0 ? '' : `step-${index}`,
      stageId: stage.id,
      source: 'stage',
    })),
  };
}
