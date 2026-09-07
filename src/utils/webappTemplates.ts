import { WebAppTemplate } from '../types/webapp';

export const webAppTemplates: WebAppTemplate[] = [
  {
    id: 'vsl-hormozi',
    name: 'VSL (Hormozi Style)',
    theme: 'hormozi',
    blocks: [
      {
        id: 'h-progress',
        type: 'progress_header',
        content: { label: 'Прогресс', progress: '0/5', livesLabel: 'Жизни:' }
      },
      {
        id: 'h-header',
        type: 'header',
        content: { title: 'ЭКСПЕРТ', highlight: '.ПРО' }
      },
      {
        id: 'h-video',
        type: 'video',
        content: { 
          videoUrl: '', 
          caption1: '"ЕСЛИ У ВАС НЕТ ЛИДОВ...',
          caption2: 'У ВАС НЕТ БИЗНЕСА."' 
        }
      },
      {
        id: 'h-pre',
        type: 'text',
        content: { 
          text: 'Бесплатный мастер-класс', 
          style: 'pre-headline' 
        }
      },
      {
        id: 'h-headline',
        type: 'text',
        content: { 
          text: 'КАК ПОЛУЧАТЬ 100 ЗАЯВОК В ДЕНЬ БЕЗ ВЛОЖЕНИЙ В РЕКЛАМУ.', 
          highlight: '100 ЗАЯВОК',
          style: 'headline' 
        }
      },
      {
        id: 'h-sub',
        type: 'text',
        content: { 
          text: 'Точная система, которую мы использовали для масштабирования 15+ проектов до 100 млн+ выручки. Никакой воды. Только практика.', 
          style: 'subheadline' 
        }
      },
      {
        id: 'h-deadline',
        type: 'deadline',
        content: { text: 'Доступ закроется через:', time: '14:59' }
      },
      {
        id: 'h-rich',
        type: 'rich_text',
        content: {
          headline: 'КНОПКА С ДЕМО-ДОСТУПОМ ПОЯВИТСЯ ПОСЛЕ ПРОСМОТРА ВИДЕО',
          paragraph: 'Внимательно просмотри его, чтобы понять, в чем суть методологии и как работает наш сервис.'
        }
      },
      {
        id: 'h-button',
        type: 'button',
        content: { text: 'Получить Бесплатный Доступ', subtext: 'Займет 10 секунд • 100% Бесплатно' }
      },
      {
        id: 'h-stack',
        type: 'value_stack',
        content: {
          title: 'Что вы получите',
          titleHighlight: 'Сегодня',
          items: [
            { name: 'Система "100 Заявок в день"', value: '99 000 ₽' },
            { name: 'Скрипты холодных продаж', value: '49 000 ₽' },
            { name: 'Шаблоны контент-машины', value: '29 000 ₽' }
          ],
          totalValue: '177 000 ₽',
          offerPrice: 'БЕСПЛАТНО'
        }
      },
      {
        id: 'h-experts',
        type: 'expert_grid',
        content: {
          title: 'Супер-звезды инфобизнеса запускают воронки по моей модели 👇',
          experts: [
            { name: 'МИХАИЛ ГРАЧЁВ', img: 'https://i.pravatar.cc/300?img=11' },
            { name: 'ДМИТРИЙ ВОЛКОВ', img: 'https://i.pravatar.cc/300?img=12' },
            { name: 'АЛЕКСЕЙ РЫБИН', img: 'https://i.pravatar.cc/300?img=13' },
            { name: 'ВИТАЛИЙ КОЗЛОВ', img: 'https://i.pravatar.cc/300?img=14' }
          ],
          footerText: '...а также другие звездные эксперты.'
        }
      },
      {
        id: 'h-tg-cta',
        type: 'telegram_cta',
        content: { text: 'Написать вопрос в личку', subtext: 'Я на связи 24/7 — спрашивайте что угодно' }
      },
      {
        id: 'h-guarantee',
        type: 'guarantee',
        content: { title: '100% ГАРАНТИЯ РЕЗУЛЬТАТА', text: 'Если вы внедрите систему и не получите результат за 30 дней, мы вернем вам деньги. Без лишних вопросов.' }
      },
      {
        id: 'h-footer',
        type: 'footer',
        content: {}
      }
    ]
  },
  {
    id: 'lesson-alice',
    name: 'Урок (Alice Fox Style)',
    theme: 'alice',
    blocks: [
      {
        id: 'a1',
        type: 'header',
        content: { title: 'ALICE\nFOX', subtitle: 'Добавьте описание,\nчем вы занимаетесь' }
      },
      {
        id: 'a2',
        type: 'hero_image',
        content: { 
          title: 'Формула вирусного контента',
          subtitle: 'Урок 2 — Хуки и структуры, дающие 10х охваты',
          badge: 'Урок 2 из 3 • Бесплатно'
        }
      },
      {
        id: 'a-video',
        type: 'video',
        content: { 
          videoUrl: '',
          title: 'Урок 2: Вирусный контент — Формула тредов с 10х охватом',
          linkText: 'Отдельная ссылка видео на YouTube' 
        }
      },
      {
        id: 'a3',
        type: 'text',
        content: { 
          text: 'Вирусный контент: формула тредов с 10х охватом', 
          style: 'headline' 
        }
      },
      {
        id: 'a4',
        type: 'text',
        content: { 
          text: 'Узнай, какие хуки и структуры поста заставляют алгоритм Threads раздавать твой контент тысячам людей — и как применить это уже в следующем посте.', 
          style: 'paragraph' 
        }
      },
      {
        id: 'a6',
        type: 'text',
        content: { 
          text: '📌 Досмотри до конца — в финале разбираем живой пример треда, который набрал 2М просмотров', 
          style: 'note' 
        }
      },
      {
        id: 'a7',
        type: 'features_list',
        content: {
          items: [
            { icon: '🪝', title: 'Анатомия вирусного хука', text: 'Первые 3 слова решают всё. Разбираем формулы хуков, которые останавливают скролл и заставляют дочитывать до конца.' },
            { icon: '📐', title: 'Структура треда с 10х охватом', text: 'Как выстроить пост так, чтобы алгоритм продолжал его раздавать через 6, 12 и 24 часа после публикации.' },
            { icon: '🔄', title: 'Триггеры репостов и сохранений', text: 'Что заставляет людей делиться контентом и сохранять его — и как встроить это в каждый пост.' }
          ]
        }
      },
      {
        id: 'a8',
        type: 'outcomes_list',
        content: {
          title: 'После этого урока ты будешь знать:',
          items: [
            'Формулу первой строки, которая останавливает скролл',
            'Почему одни посты улетают в вирус, а другие умирают за 30 минут',
            'Точную структуру треда, дающую 10х охваты',
            'Как писать контент, который люди сохраняют и пересылают друзьям'
          ]
        }
      },
      {
        id: 'a9',
        type: 'testimonials',
        content: {
          items: [
            { text: '**Иван** применил эту формулу после Урока 2 и вырос с 800 до **10 000 подписчиков** за месяц — а потом заработал **120 000 руб.** на партнёрке, продвигая продукты через вирусные треды.' },
            { text: 'Света: «Я всегда думала, что вирусность — это удача. После второго урока поняла, что это система. Теперь каждый мой пост бьёт в 3–5 раз лучше прежнего.»' }
          ]
        }
      }
    ]
  },
  {
    id: 'lead-magnet-dotcom',
    name: 'Lead Magnet (DotCom Style)',
    theme: 'alice',
    blocks: [
      {
        id: 'dc-banner',
        type: 'social_proof_banner',
        content: { text: '⭐ Бестселлер с 100 000+ копий', subtitle: 'Международное признание' }
      },
      {
        id: 'dc-header',
        type: 'header',
        content: { title: 'DOTCOM\nSECRETS', subtitle: 'БЕСПЛАТНАЯ\nКНИГА' }
      },
      {
        id: 'dc-pre',
        type: 'text',
        content: { text: 'ХОЧЕШЬ ЗАПУСТИТЬ СВОЙ ОНЛАЙН-БИЗНЕС?', style: 'pre-headline' }
      },
      {
        id: 'dc-headline',
        type: 'text',
        content: { text: 'ПОЛУЧИ ЭТУ БЕСПЛАТНУЮ КНИГУ', style: 'headline', highlight: 'БЕСПЛАТНУЮ' }
      },
      {
        id: 'dc-sub',
        type: 'text',
        content: { text: 'DotCom Secrets — это книга #1 о том, как из нуля построить систему продаж в интернете и вырасти до миллиона', style: 'subheadline' }
      },
      {
        id: 'dc-video',
        type: 'video',
        content: { videoUrl: '', title: 'Узнай, что внутри книги за 2 минуты', linkText: 'Смотреть на YouTube' }
      },
      {
        id: 'dc-product',
        type: 'product_image',
        content: { title: 'DOTCOM\nSECRETS', author: 'Russell Brunson', rating: '4.6 — 2 649 оценок на Amazon', imageUrl: '' }
      },
      {
        id: 'dc-button1',
        type: 'button',
        content: { text: '📖 ПОЛУЧИТЬ БЕСПЛАТНУЮ КОПИЮ', subtext: 'Только оплата доставки $9.95' }
      },
      {
        id: 'dc-quote1',
        type: 'quote_testimonial',
        content: {
          quote: 'Простой процесс, который любая компания может использовать для геометрического роста трафика, конверсии и онлайн-продаж.',
          author: 'Tony Robbins',
          title: 'Автор бестселлера «Разбуди в себе исполина»',
          imageUrl: ''
        }
      },
      {
        id: 'dc-quote2',
        type: 'quote_testimonial',
        content: {
          quote: 'Прочитай эту книгу, чтобы получить полное и ясное понимание структуры и науки эффективного маркетинга в онлайне.',
          author: 'Dan S. Kennedy',
          title: 'Автор серии «No B.S. Marketing»',
          imageUrl: ''
        }
      },
      {
        id: 'dc-features',
        type: 'features_list',
        content: {
          items: [
            { icon: '🔥', title: 'Секреты воронок продаж', text: 'Пошаговые инструкции по созданию воронок, которые конвертируют трафик в деньги' },
            { icon: '📈', title: 'Формула трафика', text: 'Как привлекать идеальных клиентов без бюджета на рекламу' },
            { icon: '💰', title: 'Масштабирование до $1M', text: 'Стратегии роста, которые использовали 500+ предпринимателей для первого миллиона' }
          ]
        }
      },
      {
        id: 'dc-testimonials',
        type: 'testimonials',
        content: {
          items: [
            { text: '**Алексей**: «Прочитал книгу за выходные. Через неделю запустил свою первую воронку. Через месяц — **первые 200 000₽** выручки. Книга окупилась в 20 000 раз.»' },
            { text: '**Мария**: «Я 3 года пыталась продавать онлайн и ничего не работало. После DotCom Secrets всё встало на свои места. Сейчас стабильно **500 000₽/мес**.»' }
          ]
        }
      },
      {
        id: 'dc-button2',
        type: 'button',
        content: { text: '📖 ПОЛУЧИТЬ БЕСПЛАТНУЮ КОПИЮ', subtext: 'Доступ закроется сегодня' }
      },
      {
        id: 'dc-guarantee',
        type: 'guarantee',
        content: { title: 'ГАРАНТИЯ ВОЗВРАТА 100%', text: '30-дневная гарантия возврата. Если книга не изменит ваш подход к онлайн-бизнесу — верну деньги за доставку без вопросов.' }
      },
      {
        id: 'dc-footer',
        type: 'footer',
        content: {}
      }
    ]
  }
];
