import React from 'react';
import { Bot, ExternalLink, KeyRound, Send, Smartphone, Star, Waves } from 'lucide-react';
import { useScrollReveal } from './lessons/useScrollReveal';
import { VslVideo } from './lessons/vsl';
import { EduFooter, EduHeading, EduLessonHero, EduNextCta, EduPromptCard } from './lessons/edu';
import { HomeworkChallengeCard } from './lessons/HomeworkChallengeCard';


interface CustomStage1Props {
  onCTAClick: (block?: any) => void;
  isPhonePreview?: boolean;
  stageData?: any;
}


const OUTCOMES = [
  { Icon: Waves, title: 'Scroll-анимации', text: 'Блоки плавно появляются при скролле — сайт выглядит как дорогой продукт.' },
  { Icon: Smartphone, title: 'Мобильная версия', text: 'Без горизонтального скролла и мелкого текста — удобно с любого телефона.' },
  { Icon: Send, title: 'Заявки в Telegram', text: 'Форма отправляет лид прямо тебе в бот — клиент не теряется.' },
];

const PROMPTS = [
  {
    title: 'Кинематографичный видео-фон',
    text: 'Сделай главный экран (hero section) дорогим и динамичным. Добавь фоновое видео: используй тег <video> с атрибутами autoplay, loop, muted, playsinline. Поверх видео наложи полупрозрачный темный слой (overlay), чтобы белый текст заголовка читался идеально. В качестве ссылки на видео вставь любой красивый стоковый ролик, например с Coverr или Pexels.',
  },
  {
    title: 'Премиальные анимации при скролле',
    text: 'Добавь анимацию появления элементов при скролле. Пусть блоки, карточки и текст плавно всплывают снизу (fade-in up), когда пользователь до них докручивает. Главная кнопка должна слегка пульсировать и плавно менять цвет при наведении (hover).',
  },
  {
    title: 'Идеальная мобильная версия',
    text: 'Сделай этот сайт полностью адаптивным для мобильных устройств. Пропиши медиа-запросы так, чтобы на экранах смартфонов до 768px меню сворачивалось в бургер, шрифты масштабировались для удобного чтения, а блоки выстраивались в одну колонку. Убедись, что нет горизонтального скролла.',
  },
  {
    title: 'Заявки в Telegram-бот',
    text: 'Оживи форму захвата на сайте. Сделай так, чтобы заявки поступали мне в Telegram. Собери данные из формы (имя и телефон) и отправь их POST-запросом в Telegram Bot API. Используй токен бота: [ТОКЕН_БОТА]. В качестве chat_id используй [ТВОЙ_ID]. После успешной отправки покажи на сайте уведомление: "Заявка успешно отправлена!".',
  },
  {
    title: 'Фавикон сайта',
    text: 'Добавь в код подключение фавикона. Сделай фавикон как SVG прямо в коде, чтобы иконка сразу отображалась на вкладке браузера. Иконка должна визуально совпадать со стилем сайта.',
  },
];

const TOOLS = [
  {
    Icon: Bot,
    title: 'Открыть @BotFather',
    desc: 'Нажми /start, напиши /newbot, придумай имя и скопируй длинный ключ API Token.',
    href: 'https://t.me/BotFather',
    tag: 'Token',
  },
  {
    Icon: KeyRound,
    title: 'Узнать свой ID',
    desc: 'Нажми /start в @userinfobot или @getmyid_bot и скопируй цифры в строке Id.',
    href: 'https://t.me/userinfobot',
    tag: 'chat_id',
  },
];

export default function CustomStage1({ onCTAClick, isPhonePreview, stageData }: CustomStage1Props) {
  useScrollReveal();

  const goNext = () => onCTAClick();

  return (
    <div className="edu-page lesson-font-body relative min-h-screen overflow-x-clip">
      {/* ═══════════ HERO ═══════════ */}
      <EduLessonHero
        pill="Урок 2 из 4 · бесплатный курс"
        title={
          <>
            Оживляем сайт.
            <br />
            <span className="text-[#baff4a]">Анимации и заявки</span> в Telegram
          </>
        }
        subtitle={
          <>
            Превращаем статичную картинку в динамичный актив{' '}
            <span className="font-semibold text-white">за $500+.</span>
          </>
        }
      >
        <div className="hero-anim hero-fade mx-auto mt-6 w-full max-w-[600px] md:mt-8 md:max-w-[820px]" style={{ animationDelay: '0.7s' }}>
          <VslVideo
            src="https://www.youtube.com/embed/dQw4w9WgXcQ"
            title="Урок 2"
            strip="4 команды — и сайт живой"
            compact={isPhonePreview}
            duration="11:08"
            caption="Смотри урок и повторяй за мной"
            stripClassName="bg-[#E6CF5D] text-[#111006] border-t border-[#f2df88]"
          />
        </div>

        <div className="hero-anim hero-fade mt-6" style={{ animationDelay: '0.9s' }}>
          <EduNextCta label="Я прошёл урок 2" hint="Следующий — публикуем сайт" onClick={goNext} />
        </div>

        <div className="hero-anim hero-fade mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-white/60" style={{ animationDelay: '1.05s' }}>
          <span className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={13} className="fill-[#E6CF5D] text-[#E6CF5D]" />
            ))}
          </span>
          4.9 — средняя оценка учеников курса
        </div>
      </EduLessonHero>

      {/* ═══════════ ЧТО ПОЯВИТСЯ У САЙТА ═══════════ */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <div data-lesson-reveal>
            <EduHeading align="center" title="Что появится у твоего сайта" sub="После четырёх команд статичная страница превращается в живой инструмент продаж." />
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3" data-lesson-reveal>
            {OUTCOMES.map(({ Icon, title, text }) => (
              <div key={title} className="edu-card edu-card-hover p-6">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#161a22]/[0.05] text-[#161a22]">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-[#161a22]">{title}</h3>
                <p className="mt-1.5 text-sm font-medium leading-6 text-[#5b6270]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ РЕСУРСЫ ═══════════ */}
      <section className="bg-[#f3f3f3] py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <div data-lesson-reveal>
            <EduHeading
              align="center"
              title="Ресурсы для Telegram-заявок"
              sub="Два быстрых действия: создать бота, получить свой chat_id и вставить данные в промпт ниже."
            />
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-2" data-lesson-reveal>
            {TOOLS.map(({ Icon, title, desc, href, tag }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="edu-card edu-card-hover flex min-h-[190px] flex-col justify-between p-6"
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="grid h-14 w-14 place-items-center rounded-[4px] bg-[#161a22]/[0.05] text-[#161a22]">
                    <Icon size={24} />
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-[3px] bg-[#222]/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#222]">
                    {tag}
                    <ExternalLink size={13} />
                  </span>
                </div>
                <div>
                  <h3 className="mt-5 text-xl font-black text-[#161a22]">{title}</h3>
                  <p className="mt-2 text-[15px] font-medium leading-7 text-[#5b6270]">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ЧИТ-КОДЫ ДЛЯ ИИ ═══════════ */}
      <section className="edu-soft py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <div data-lesson-reveal>
            <EduHeading
              light
              align="center"
              title="Чит-коды для ИИ"
              sub="Копируй по очереди, вставляй в нейросеть и смотри, как страница оживает после каждой команды."
            />
          </div>
          <div className="mx-auto mt-9 grid max-w-3xl gap-4 md:grid-cols-2" data-lesson-reveal>
            {PROMPTS.map((prompt, index) => (
              <React.Fragment key={prompt.title}>
                <EduPromptCard index={index + 1} title={prompt.title} text={prompt.text} />
              </React.Fragment>
            ))}
          </div>

        </div>
      </section>

      {/* ═══════════ ПАНЧ + CTA → УРОК 3 ═══════════ */}
      <section className="edu-dark py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <p className="edu-h mx-auto max-w-2xl text-center text-2xl text-white md:text-[30px]" data-lesson-reveal>
            Готово. Проверь сам.
            <br />
            Твой сайт стал <span className="text-[#baff4a]">машиной по сбору лидов.</span>
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[15px] font-medium leading-7 text-white/65" data-lesson-reveal>
            Введи свои данные в форму на сайте и нажми кнопку. Через секунду телефон звякнет — бот пришлёт заявку в Telegram.
            Но прямо сейчас всё это работает только локально, на твоём компьютере. В Уроке 3 мы выложим сайт на боевой сервер за 3 минуты, бесплатно, и ты сможешь отправить рабочую ссылку кому угодно.
          </p>

          {stageData?.requireHomework && (
            <div data-lesson-reveal>
              <HomeworkChallengeCard
                stageTitle="Урок 2: Анимации и заявки"
                criteria={stageData.homeworkCriteria}
                expertUsername={stageData.expertTelegramUsername}
                status={stageData.homeworkStatus}
                onCTAClick={goNext}
              />
            </div>
          )}

          <div className="mt-10" data-lesson-reveal>
            <EduNextCta label="Сайт ожил. Идём выкладывать его в интернет" hint="Урок 3" onClick={goNext} />
          </div>
        </div>
      </section>


      <EduFooter stageLabel="Урок 2 из 4 — анимации и заявки" />
    </div>
  );
}
