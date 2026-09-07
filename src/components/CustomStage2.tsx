import React from 'react';
import { CheckCircle2, Download, ExternalLink, Link2, Lock, MousePointerClick, Star } from 'lucide-react';
import { useScrollReveal } from './lessons/useScrollReveal';
import { VslVideo } from './lessons/vsl';
import { EduFooter, EduHeading, EduLessonHero, EduNextCta } from './lessons/edu';
import { HomeworkChallengeCard } from './lessons/HomeworkChallengeCard';


interface CustomStage2Props {
  onCTAClick: (block?: any) => void;
  isPhonePreview?: boolean;
  stageData?: any;
}


const STEPS = [
  {
    Icon: Download,
    title: 'Скачай код на компьютер',
    text: 'В правом верхнем углу Gemini Canvas нажми кнопку экспорта. Весь готовый код сайта скачается одним файлом.',
  },
  {
    Icon: MousePointerClick,
    title: 'Закинь папку на сервер',
    text: 'Открой Netlify Drop по кнопке ниже. Возьми папку с твоим сайтом и перетащи её мышкой в круг по центру экрана.',
  },
  {
    Icon: Link2,
    title: 'Забери ссылку',
    text: 'Через 10 секунд Netlify покажет “Site is live”. Под этой надписью будет твоя живая ссылка на сайт.',
  },
];

const WINS = [
  'Создал структуру премиального сайта.',
  'Добавил дорогие анимации и видео-фон.',
  'Привязал форму заявок к своему Telegram.',
  'Выложил всё это на боевой сервер.',
];

export default function CustomStage2({ onCTAClick, isPhonePreview, stageData }: CustomStage2Props) {
  useScrollReveal();

  const goNext = () => onCTAClick();

  return (
    <div className="edu-page lesson-font-body relative min-h-screen overflow-x-clip">
      {/* ═══════════ HERO ═══════════ */}
      <EduLessonHero
        pill="Урок 3 из 4 · бесплатный курс"
        title={
          <>
            Даём сайту жизнь.
            <br />
            <span className="text-[#baff4a]">Публикация</span> в интернет
          </>
        }
        subtitle={
          <>
            3 минуты. $0 за сервер. Твой сайт открывается{' '}
            <span className="font-semibold text-white">с любого телефона в мире.</span>
          </>
        }
      >
        <div className="hero-anim hero-fade mx-auto mt-6 flex w-full max-w-md items-center gap-3 rounded-[6px] border border-[#baff4a]/20 bg-white/[0.04] px-4 py-3.5 backdrop-blur" style={{ animationDelay: '0.62s' }}>
          <Lock size={14} className="shrink-0 text-[#baff4a]" />
          <span className="truncate font-mono text-sm font-bold text-white/80">
            https://<span className="text-[#baff4a]">tvoy-sait</span>.netlify.app
          </span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#baff4a]/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#baff4a]">
            <span className="h-2 w-2 rounded-full bg-[#baff4a]" />
            Live
          </span>
        </div>

        <div className="hero-anim hero-fade mx-auto mt-6 w-full max-w-[600px] md:mt-7 md:max-w-[820px]" style={{ animationDelay: '0.78s' }}>
          <VslVideo
            src="https://www.youtube.com/embed/S2pEicQ1760"
            title="Урок 3"
            strip="В интернет за 3 клика"
            compact={isPhonePreview}
            duration="08:24"
            caption="Скачать в Gemini → перетащить в Netlify Drop → забрать ссылку"
            stripClassName="bg-[#E6CF5D] text-[#111006] border-t border-[#f2df88]"
          />
        </div>

        <div className="hero-anim hero-fade mt-6" style={{ animationDelay: '0.92s' }}>
          <EduNextCta label="Ссылка готова! Хочу узнать, как на этом заработать" hint="Урок 4" onClick={goNext} />
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

      {/* ═══════════ ТЕКСТ + ЧЕКЛИСТ ═══════════ */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <div data-lesson-reveal>
            <EduHeading
              align="center"
              title="Твой алгоритм на ближайшие 3 минуты"
              sub="Сейчас твой код видит только Gemini. Пришло время выпустить его в мир: без аренды хостинга, доменов и сложных настроек."
            />
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3" data-lesson-reveal>
            {STEPS.map(({ Icon, title, text }, index) => (
              <div key={title} className="edu-card edu-card-hover relative p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#161a22]/[0.05] text-[#161a22]">
                    <Icon size={20} />
                  </span>
                  <span className="edu-h text-3xl text-[#161a22]/12">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-[#161a22]">{title}</h3>
                <p className="mt-1.5 text-sm font-medium leading-6 text-[#5b6270]">{text}</p>
                {index === 1 && (
                  <a
                    href="https://app.netlify.com/drop"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 bg-[#CEF563] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#111] transition hover:scale-[1.02]"
                  >
                    Открыть Netlify Drop
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ПОБЕДА + ДЕНЬГИ ═══════════ */}
      <section className="edu-soft py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <div data-lesson-reveal>
            <EduHeading
              light
              align="center"
              title="Получилось? Поздравляю."
              sub="Скопируй ссылку, открой с телефона, отправь друзьям. Теперь твой проект официально в интернете."
            />
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-[0.95fr_1.05fr]" data-lesson-reveal>
            <div className="edu-card-dark p-6 md:p-7">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#CEF563]">Давай подведём итог</div>
              <div className="mt-5 grid gap-3">
                {WINS.map((win) => (
                  <div key={win} className="flex items-start gap-3 text-sm font-semibold leading-6 text-white/72">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#CEF563]" />
                    <span>{win}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="edu-card-dark p-6 md:p-7">
              <p className="text-[15px] font-semibold leading-7 text-white/70">
                Раньше бизнес платил за такую работу от $1000 и ждал неделями. Ты собрал это сам, управляя ИИ.
              </p>
              <p className="mt-4 text-[15px] font-semibold leading-7 text-white/70">
                Навык у тебя в кармане. Теперь пора превратить его в деньги.
              </p>
              <div className="mt-5 space-y-2 text-sm font-semibold leading-6 text-white/55">
                <p>— где искать клиентов на такие сайты за $300–500;</p>
                <p>— что написать им в Директ или мессенджер;</p>
                <p>— как перейти от сайтов к ИИ-сервисам с чеками от $1500.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ ПАНЧ + CTA → ФИНАЛ ═══════════ */}
      <section className="edu-dark py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <p className="edu-h mx-auto max-w-2xl text-center text-2xl text-white md:text-[30px]" data-lesson-reveal>
            Сайт уже в интернете.
            <br />
            Теперь пора понять, <span className="text-[#baff4a]">как на этом заработать.</span>
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[15px] font-medium leading-7 text-white/65" data-lesson-reveal>
            В финальном Уроке 4 разберём математику: кому писать, что предлагать и как перейти от простых сайтов к ИИ-системам с более дорогими чеками.
          </p>

          {stageData?.requireHomework && (
            <div data-lesson-reveal>
              <HomeworkChallengeCard
                stageTitle="Урок 3: Публикация сайта"
                criteria={stageData.homeworkCriteria}
                expertUsername={stageData.expertTelegramUsername}
                status={stageData.homeworkStatus}
                onCTAClick={goNext}
              />
            </div>
          )}

          <div className="mt-10" data-lesson-reveal>
            <EduNextCta label="Ссылка готова! Хочу узнать, как на этом заработать" hint="Урок 4" onClick={goNext} />
          </div>
        </div>
      </section>


      <EduFooter stageLabel="Урок 3 из 4 — публикация сайта" />
    </div>
  );
}
