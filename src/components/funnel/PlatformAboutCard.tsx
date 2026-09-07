import React from 'react';
import { CreditCard, GraduationCap, LockKeyhole } from 'lucide-react';
import type { Funnel } from '../../types/funnel';
import { DEFAULT_LESSONS } from '../platform/defaultProgram';

interface PlatformAboutCardProps {
  funnel: Funnel;
}

function pluralRu(n: number, one: string, two: string, five: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return five;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return two;
  return five;
}

// Объяснение, как устроен доступ. Раньше карточка жила в редакторе воронки и
// занимала там экран, хотя рассказывает только про платформу. Заодно перестала
// врать: состав курса берётся из программы воронки, а не из текста в коде.
export default function PlatformAboutCard({ funnel }: PlatformAboutCardProps) {
  const lessons = funnel.platform?.lessons || [];
  const usesDefault = lessons.length === 0;
  const source = usesDefault ? DEFAULT_LESSONS : lessons;
  const moduleCount = new Set(source.map(lesson => lesson.module)).size;

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 border-b border-emerald-100 bg-gradient-to-r from-[#071006] to-[#14220a] p-4 sm:p-6 text-white lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#CEF563]/15 text-[#CEF563] ring-1 ring-[#CEF563]/20">
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black tracking-tight">Как открывается платформа</h2>
              <span className="rounded-full bg-[#CEF563]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#CEF563]">
                Tripwire Platform
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/58">
              Это не бесплатный этап воронки. Это пост-оплатный WebApp с уроками, модулями, ресурсами и доступом по тарифу.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-3">
        <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-[#CEF563]">
            <CreditCard size={20} />
          </div>
          <h3 className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-slate-900">Триггер доступа</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Ученик оплачивает пакет на последнем этапе воронки. Сервер создаёт paid-order, и бот присылает персональную кнопку «Открыть платформу».
          </p>
        </div>

        <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-[#CEF563]">
            <GraduationCap size={20} />
          </div>
          <h3 className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-slate-900">Что внутри</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            {moduleCount} {pluralRu(moduleCount, 'модуль', 'модуля', 'модулей')}, {source.length}{' '}
            {pluralRu(source.length, 'урок', 'урока', 'уроков')}, материалы, эфиры и прогресс прохождения.
            {usesDefault && ' Это встроенный курс — заведите программу выше, чтобы платформа показывала ваши уроки.'}
          </p>
        </div>

        <div className="p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-[#CEF563]">
            <LockKeyhole size={20} />
          </div>
          <h3 className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-slate-900">Защита</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Боевой доступ работает только внутри Telegram WebApp. Скопированная браузерная ссылка покажет экран «Открой через Telegram-бота».
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-emerald-50/50 p-5">
        <div className="flex flex-col gap-3 text-sm font-bold text-emerald-900 md:flex-row md:items-center md:justify-between">
          <span>Логика: последний урок → оплата тарифа → paid-order → кнопка в Telegram → stage=platform</span>
          <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 shadow-sm">
            системный этап, не удаляется
          </span>
        </div>
      </div>
    </div>
  );
}
