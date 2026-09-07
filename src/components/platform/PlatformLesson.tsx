import React, { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Timer, VideoOff } from 'lucide-react';
import { hasRealVideo, lessonIcon } from './lessonIcons';
import TrackedYouTubeEmbed from '../TrackedYouTubeEmbed';

export interface PlatformLessonData {
  id: string;
  module: string;
  title: string;
  icon?: string;
  duration: string;
  description: string;
  videoSrc: string;
  resources?: Array<{ label: string; href: string }>;
}

interface PlatformLessonProps {
  lesson: PlatformLessonData;
  index: number;
  total: number;
  isDone: boolean;
  prevLesson?: PlatformLessonData;
  nextLesson?: PlatformLessonData;
  onToggleDone: (id: string) => void;
  onOpenLesson: (id: string) => void;
  onBack: () => void;
  // С витрины можно прийти сразу за материалами — тогда открываем урок на них.
  focusMaterials?: boolean;
}

// Внутри Telegram обычная ссылка в новой вкладке часто никуда не ведёт:
// WebApp сам решает, что открывать, поэтому просим об этом его.
function openResource(href: string) {
  const telegram = (window as any).Telegram?.WebApp;
  if (telegram?.openLink) {
    telegram.openLink(href);
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}

// Во встроенном курсе ссылки на материалы стоят заглушками «#». Показывать их
// кнопками нечестно: человек жмёт и ничего не происходит.
function isPlaceholderLink(href?: string) {
  const clean = (href || '').trim();
  return !clean || clean === '#';
}

export default function PlatformLesson({
  lesson,
  index,
  total,
  isDone,
  prevLesson,
  nextLesson,
  onToggleDone,
  onOpenLesson,
  onBack,
  focusMaterials,
}: PlatformLessonProps) {
  const materialsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!focusMaterials) return;
    materialsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusMaterials, lesson.id]);

  return (
    <div className="platform-page min-h-screen text-slate-900 p-3 sm:p-5 lg:p-7 selection:bg-indigo-100 selection:text-indigo-900 antialiased relative overflow-x-hidden">
      <div aria-hidden className="platform-bg" />

      <div className="mx-auto max-w-4xl space-y-6">

        {/* ШАПКА УРОКА */}
        <header className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
              aria-label="К программе"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-500 truncate">{lesson.module}</div>
              <div className="text-sm font-black text-slate-900">Урок {index + 1} из {total}</div>
            </div>
          </div>

          {isDone && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-1 text-xs font-bold text-emerald-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <Check size={14} /> Пройден
            </span>
          )}
        </header>

        {/* ЗАГОЛОВОК И ДЛИТЕЛЬНОСТЬ */}
        <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-24px_rgba(15,23,42,0.18)] flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-indigo-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] border border-slate-200/80">
            {React.createElement(lessonIcon(lesson.icon), { size: 22 })}
          </span>
          <div>
            <h1 className="platform-display text-2xl sm:text-3xl text-slate-900 leading-snug">{lesson.title}</h1>
            <div className="mt-2 flex items-center gap-2 text-xs platform-nums text-slate-500 font-medium">
              <Timer size={13} className="text-indigo-500" /> {lesson.duration}
            </div>
          </div>
        </div>

        {/* ВИДЕОПЛЕЕР */}
        {hasRealVideo(lesson.videoSrc) ? (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-black shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-24px_rgba(15,23,42,0.18)]">
            <TrackedYouTubeEmbed src={lesson.videoSrc} title={lesson.title} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-indigo-600">
              <VideoOff size={22} />
            </span>
            <div className="mt-4 text-base font-bold text-slate-900">Видео скоро появится</div>
            <p className="mt-1.5 max-w-xs text-xs leading-5 text-slate-500">
              Материалы и чек-листы урока уже доступны ниже — начните с них.
            </p>
          </div>
        )}

        {/* ОПИСАНИЕ УРОКА */}
        {lesson.description && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">О чем этот урок</h2>
            <p className="text-sm leading-relaxed text-slate-600">{lesson.description}</p>
          </div>
        )}

        {/* РЕСУРСЫ И АРТЕФАКТЫ */}
        {lesson.resources && lesson.resources.length > 0 && (
          <section ref={materialsRef} className="scroll-mt-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">Материалы и артефакты урока</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {lesson.resources.map(resource => (
                isPlaceholderLink(resource.href) ? (
                  <div
                    key={resource.label}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3.5 text-xs sm:text-sm font-bold text-slate-400"
                  >
                    <Download size={16} className="text-slate-300" />
                    <span className="truncate">{resource.label}</span>
                    <span className="ml-auto shrink-0 rounded-full border border-slate-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      скоро
                    </span>
                  </div>
                ) : (
                  <button
                    key={resource.label}
                    type="button"
                    onClick={() => openResource(resource.href)}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-left text-xs sm:text-sm font-bold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:bg-slate-900"
                  >
                    <Download size={16} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                    <span className="truncate">{resource.label}</span>
                  </button>
                )
              ))}
            </div>
          </section>
        )}

        {/* КНОПКА ОТМЕТКИ ПРОХОЖДЕНИЯ */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => onToggleDone(lesson.id)}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-xs sm:text-sm font-black transition active:scale-95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
              isDone
                ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {isDone ? 'Снять отметку о прохождении' : 'Отметить как пройденный'}
            {!isDone && <Check size={16} />}
          </button>
        </div>

        {/* НАВИГАЦИЯ ПО УРОКАМ */}
        {(prevLesson || nextLesson) && (
          <nav className="grid gap-3 border-t border-slate-200/80 pt-6 sm:grid-cols-2">
            {prevLesson ? (
              <button
                onClick={() => onOpenLesson(prevLesson.id)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:bg-white"
              >
                <ArrowLeft size={18} className="shrink-0 text-indigo-500 group-hover:-translate-x-1 transition-transform" />
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Предыдущий</span>
                  <span className="block truncate text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{prevLesson.title}</span>
                </span>
              </button>
            ) : <span className="hidden sm:block" />}

            {nextLesson && (
              <button
                onClick={() => onOpenLesson(nextLesson.id)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-right shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:bg-white sm:justify-end"
              >
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Следующий</span>
                  <span className="block truncate text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{nextLesson.title}</span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-indigo-500 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </nav>
        )}

      </div>
    </div>
  );
}



