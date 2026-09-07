import React, { useState } from 'react';
import { Gift, Check, Copy, Trophy, Sparkles, Download, ChevronDown, ChevronUp, FileText, Bot, Zap } from 'lucide-react';

interface ChallengeBonusCardProps {
  expertUsername?: string;
}

const BONUS_PROMPTS_SAMPLE = [
  {
    title: 'Промпт №1: Архитектура дорогого лендинга',
    text: 'Ты — Senior UI/UX дизайнер и frontend-архитектор. Спроектируй структуру одностраничного сайта в темной теме в стиле Linear/Apple для сервиса [Название]. Используй неоновые акценты, стек Vanilla CSS + HTML, добавь плавные анимации при скролле и адаптивную мобильную версию.',
  },
  {
    title: 'Промпт №2: Моментальный Telegram-бот для сбора заявок',
    text: 'Напиши компактный серверный скрипт на Node.js (Express), который принимает POST-запрос с формы сайта (имя, телефон, ник в Telegram) и мгновенно отправляет форматированную HTML-карточку заявки в Telegram-канал администратора через Bot API.',
  },
  {
    title: 'Промпт №3: Дожим клиента без навязчивости',
    text: 'Напиши 3 коротких сообщения для диалога с потенциальным клиентом, который посмотрел демо-версию сайта, но замолчал. Сообщения должны показывать ценность, не давить и закрывать на 15-минутный звонок для обсуждения деталей.',
  },
];

export function ChallengeBonusCard({ expertUsername }: ChallengeBonusCardProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const targetUsername = expertUsername?.replace(/^@/, '') || 'bot';
  const telegramBonusLink = targetUsername !== 'bot'
    ? `https://t.me/${targetUsername}?text=${encodeURIComponent('Привет! Я прошел 100% челленджа по вайб-кодингу 🏆 Хочу забрать секретный бонусный архив (50 промптов + чек-лист клиента на $300)!')}`
    : `https://t.me?text=${encodeURIComponent('Привет! Забираю секретный бонус за 100% челленджа 🏆')}`;

  const handleCopy = (text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };


  return (
    <div id="challenge-bonus-section" className="mx-auto my-12 max-w-4xl px-4 scroll-mt-20">
      <div className="relative overflow-hidden rounded-3xl border-2 border-[#baff4a]/40 bg-gradient-to-b from-[#161f18] via-[#0d130e] to-black p-6 sm:p-10 shadow-[0_0_50px_rgba(186,255,74,0.15)] text-left backdrop-blur-2xl">
        {/* Фоновые декоративные сферы */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#baff4a]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-600/15 blur-3xl" />

        {/* Верхний бейдж */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#baff4a]/15 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-[#baff4a] border border-[#baff4a]/30">
            <Trophy size={14} />
            <span>Секретный бонус разблокирован • 100%</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-white/40">
            Доступно только выпускникам
          </span>
        </div>

        {/* Заголовок */}
        <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              Поздравляем с финишем! <span className="text-[#baff4a]">Забери свой подарок 🎁</span>
            </h3>
            <p className="mt-2 text-sm sm:text-base text-white/70 max-w-2xl leading-relaxed">
              Ты прошёл все уроки челленджа и на практике создал готовый IT-продукт. Чтобы закрепить успех и быстрее сделать первые $500, забирай этот боевой комплект материалов:
            </p>
          </div>

          <a
            href={telegramBonusLink}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#baff4a] px-7 py-4 text-sm font-black text-slate-950 transition-all hover:bg-[#a6ee33] hover:shadow-[0_0_25px_rgba(186,255,74,0.4)] active:scale-95"
          >
            <Download size={18} />
            <span>Забрать архив в Telegram</span>
          </a>
        </div>

        {/* Список бонусов */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-[#baff4a]/30 hover:bg-white/[0.05]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#baff4a]/15 text-[#baff4a]">
              <Sparkles size={20} />
            </div>
            <h4 className="mt-3 text-base font-bold text-white">Пакет 50 промптов</h4>
            <p className="mt-1.5 text-xs text-white/60 leading-relaxed">
              Готовые промпты для сборки сайтов, Telegram-ботов, баз данных и продающих экранов.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-[#baff4a]/30 hover:bg-white/[0.05]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
              <FileText size={20} />
            </div>
            <h4 className="mt-3 text-base font-bold text-white">Чек-лист закрытия на $300</h4>
            <p className="mt-1.5 text-xs text-white/60 leading-relaxed">
              Пошаговый план поиска клиентов за 48 часов: скрипты переписок, шаблон КП и договора.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-[#baff4a]/30 hover:bg-white/[0.05]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Bot size={20} />
            </div>
            <h4 className="mt-3 text-base font-bold text-white">Шаблон WebApp</h4>
            <p className="mt-1.5 text-xs text-white/60 leading-relaxed">
              Исходный код чистого мини-приложения Telegram с готовой адаптацией и стилями.
            </p>
          </div>
        </div>

        {/* Аккордеон с предпросмотром промптов */}
        <div className="mt-8 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between text-left text-sm font-bold text-white/80 hover:text-white transition"
          >
            <span className="inline-flex items-center gap-2">
              <Zap size={16} className="text-[#baff4a]" />
              <span>Посмотреть примеры промптов из бонусного набора</span>
            </span>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {expanded && (
            <div className="mt-4 space-y-3">
              {BONUS_PROMPTS_SAMPLE.map((prompt, idx) => (
                <div
                  key={prompt.title}
                  className="rounded-xl border border-white/10 bg-black/40 p-4 transition hover:border-white/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[#baff4a]">{prompt.title}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(prompt.text, idx)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check size={13} className="text-[#baff4a]" />
                          <span className="text-[#baff4a]">Скопировано!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Скопировать</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-white/70 font-mono leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                    {prompt.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
