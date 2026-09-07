import React from 'react';
import { GraduationCap, ExternalLink, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface HomeworkChallengeCardProps {
  stageTitle: string;
  criteria?: string;
  expertUsername?: string;
  status?: 'none' | 'pending_review' | 'approved' | 'rejected';
  onCTAClick?: () => void;
}

export function HomeworkChallengeCard({
  stageTitle,
  criteria,
  expertUsername,
  status = 'none',
  onCTAClick,
}: HomeworkChallengeCardProps) {
  const targetUsername = expertUsername?.replace(/^@/, '') || 'bot';
  const prefilledText = encodeURIComponent(`Привет! Сдаю домашнее задание по уроку «${stageTitle}». Вот мой проект: `);
  const telegramLink = targetUsername !== 'bot'
    ? `https://t.me/${targetUsername}?text=${prefilledText}`
    : `https://t.me?text=${prefilledText}`;

  if (status === 'approved') {
    return (
      <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 backdrop-blur text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-base font-bold text-emerald-200">Домашнее задание принято! 🎉</h4>
            <p className="text-xs text-emerald-300/70">
              Куратор одобрил вашу работу. Следующий урок открыт!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending_review') {
    return (
      <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 backdrop-blur text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 animate-pulse">
            <Clock size={22} />
          </div>
          <div>
            <h4 className="text-base font-bold text-amber-200">Задание на проверке у автора ⏳</h4>
            <p className="text-xs text-amber-300/70">
              ИИ выполнил экспресс-разбор. Автор скоро подключится в личке с обратной связью и откроет следующий урок!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-950/30 to-black/50 p-6 md:p-8 backdrop-blur text-left shadow-xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
          <GraduationCap size={26} />
        </div>
        <div className="flex-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-300">
            Челлендж курса
          </div>
          <h4 className="mt-2 text-lg md:text-xl font-bold text-white">
            Сдать домашнее задание автору
          </h4>
          <p className="mt-1 text-sm text-white/70 leading-relaxed">
            {criteria || 'Пришлите ссылку на выполненный проект или ответ прямо автору в Telegram. ИИ сделает быстрый разбор, а автор даст персональную обратную связь!'}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href={telegramLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/25 active:scale-98"
            >
              <span>Сдать ДЗ автору в личку</span>
              <ExternalLink size={16} />
            </a>
            {onCTAClick && (
              <button
                onClick={onCTAClick}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 text-sm font-medium text-white/80 transition hover:bg-white/5"
              >
                Я уже сдал в боте
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
