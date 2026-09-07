import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import ModernSelect from './ModernSelect';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  ariaLabel?: string;
}

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function parseLocalDateTime(value?: string) {
  if (!value) return new Date(Date.now() + 60 * 60 * 1000);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
}

function toLocalDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function clampToMin(date: Date, minDate?: Date) {
  if (!minDate || date.getTime() >= minDate.getTime()) return date;
  return new Date(minDate);
}

export default function DateTimePicker({ value, onChange, min, ariaLabel = 'Дата и время отправки' }: DateTimePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueDate = useMemo(() => parseLocalDateTime(value), [value]);
  const minDate = useMemo(() => min ? parseLocalDateTime(min) : undefined, [min]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(valueDate);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(valueDate.getFullYear(), valueDate.getMonth(), 1));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!rootRef.current?.contains(target) && !target.closest('[role="listbox"]')) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const openPicker = () => {
    const nextDraft = clampToMin(valueDate, minDate);
    setDraft(nextDraft);
    setVisibleMonth(new Date(nextDraft.getFullYear(), nextDraft.getMonth(), 1));
    setOpen(current => !current);
  };

  const setQuickValue = (next: Date) => {
    const safe = clampToMin(next, minDate);
    setDraft(safe);
    setVisibleMonth(new Date(safe.getFullYear(), safe.getMonth(), 1));
  };

  const selectDate = (date: Date) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), draft.getHours(), draft.getMinutes());
    const safe = clampToMin(next, minDate);
    setDraft(safe);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const updateTime = (part: 'hours' | 'minutes', nextValue: string) => {
    const next = new Date(draft);
    if (part === 'hours') next.setHours(Number(nextValue));
    else next.setMinutes(Number(nextValue));
    setDraft(clampToMin(next, minDate));
  };

  const apply = () => {
    const safe = clampToMin(draft, minDate);
    onChange(toLocalDateTimeValue(safe));
    setOpen(false);
  };

  const tomorrowAtTen = () => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(10, 0, 0, 0);
    setQuickValue(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`flex h-12 w-full items-center gap-3 rounded-xl border bg-white px-4 text-left text-sm shadow-sm outline-none transition ${
          open ? 'border-[#1677e8] ring-4 ring-blue-100' : 'border-slate-200 hover:border-blue-200'
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1677e8]">
          <CalendarDays size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-800">{dateTimeFormatter.format(valueDate)}</span>
          <span className="mt-0.5 block text-[10px] text-slate-400">по вашему часовому поясу</span>
        </span>
        <ChevronRight size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90 text-[#1677e8]' : ''}`} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/30 p-3 backdrop-blur-[2px] sm:p-5"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className="max-h-[calc(100dvh-24px)] w-full max-w-[620px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_28px_90px_-20px_rgba(15,23,42,0.48)] ring-1 ring-slate-900/5"
        >
          <div className="grid lg:grid-cols-[minmax(0,1fr)_230px]">
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#1677e8]"
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-sm font-semibold capitalize text-slate-800">{monthFormatter.format(visibleMonth)}</div>
                <button
                  type="button"
                  onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#1677e8]"
                  aria-label="Следующий месяц"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                {weekdays.map(day => <div key={day} className="py-1 text-[10px] font-medium uppercase text-slate-400">{day}</div>)}
                {calendarDays.map(date => {
                  const outsideMonth = date.getMonth() !== visibleMonth.getMonth();
                  const selected = sameDay(date, draft);
                  const today = sameDay(date, new Date());
                  const disabled = !!minDate && startOfDay(date).getTime() < startOfDay(minDate).getTime();
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectDate(date)}
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-xs transition ${
                        selected
                          ? 'bg-[#1677e8] font-semibold text-white shadow-sm'
                          : disabled
                            ? 'cursor-not-allowed text-slate-200'
                            : outsideMonth
                              ? 'text-slate-300 hover:bg-slate-50'
                              : today
                                ? 'bg-blue-50 font-semibold text-[#1677e8] hover:bg-blue-100'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 p-4 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Clock3 size={15} className="text-[#1677e8]" /> Время отправки
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <ModernSelect
                  value={String(draft.getHours())}
                  onChange={nextValue => updateTime('hours', nextValue)}
                  searchable={false}
                  options={Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: String(hour).padStart(2, '0') }))}
                  buttonClassName="h-10 justify-center gap-1 px-2 shadow-none"
                  ariaLabel="Часы"
                />
                <span className="text-sm font-semibold text-slate-400">:</span>
                <ModernSelect
                  value={String(draft.getMinutes())}
                  onChange={nextValue => updateTime('minutes', nextValue)}
                  searchable={false}
                  options={Array.from({ length: 60 }, (_, minute) => ({ value: String(minute), label: String(minute).padStart(2, '0') }))}
                  buttonClassName="h-10 justify-center gap-1 px-2 shadow-none"
                  ariaLabel="Минуты"
                />
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setQuickValue(new Date(Date.now() + 60 * 60 * 1000))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-blue-200 hover:text-[#1677e8]"
                >
                  Через 1 час
                </button>
                <button
                  type="button"
                  onClick={tomorrowAtTen}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-blue-200 hover:text-[#1677e8]"
                >
                  Завтра в 10:00
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-xs text-slate-400">Выбрано: <span className="font-medium text-slate-600">{dateTimeFormatter.format(draft)}</span></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-10 flex-1 rounded-xl border border-slate-200 px-4 text-xs text-slate-600 hover:bg-slate-50 sm:flex-none">
                Отмена
              </button>
              <button type="button" onClick={apply} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1677e8] px-4 text-xs font-medium text-white hover:bg-[#0f69ce] sm:flex-none">
                <Check size={14} /> Готово
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
