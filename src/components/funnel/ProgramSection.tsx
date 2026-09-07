import React from 'react';
import { BookOpen, ChevronDown, ChevronUp, Crown, GraduationCap, Image as ImageIcon, Link2, Plus, Trash2, Video } from 'lucide-react';
import type { Funnel, PlatformLesson, PlatformLessonResource } from '../../types/funnel';
import { DEFAULT_LESSONS, DEFAULT_PLATFORM_TITLE, DEFAULT_TIER_LABELS } from '../platform/defaultProgram';
import { LESSON_ICONS } from '../platform/lessonIcons';
import ModernSelect from '../ui/ModernSelect';

interface ProgramSectionProps {
  funnel: Funnel;
  onChange: (platform: Funnel['platform']) => void;
}

const TIERS: Array<'pkg-1' | 'pkg-2'> = ['pkg-1', 'pkg-2'];

const ICON_OPTIONS = [
  { value: '', label: 'По умолчанию' },
  ...Object.keys(LESSON_ICONS).map(key => ({ value: key, label: key })),
];

export default function ProgramSection({ funnel, onChange }: ProgramSectionProps) {
  const platform = funnel.platform || {};
  const lessons = platform.lessons || [];

  const patchPlatform = (changes: Partial<NonNullable<Funnel['platform']>>) => {
    onChange({ ...platform, ...changes });
  };

  const saveLessons = (next: PlatformLesson[]) => patchPlatform({ lessons: next });

  const patchLesson = (id: string, changes: Partial<PlatformLesson>) => {
    saveLessons(lessons.map(lesson => (lesson.id === id ? { ...lesson, ...changes } : lesson)));
  };

  const addLesson = () => {
    // Новый урок попадает в тот же модуль, что и последний: курс почти всегда
    // добирается по одному уроку внутри модуля, а не по одному модулю.
    const lastModule = lessons[lessons.length - 1]?.module || 'Модуль 1';
    saveLessons([
      ...lessons,
      {
        id: `lesson-${Date.now().toString(36)}`,
        module: lastModule,
        title: 'Новый урок',
        duration: '',
        description: '',
        videoSrc: '',
        minTier: 'pkg-1',
        resources: [],
      },
    ]);
  };

  // Порядок уроков — это порядок прохождения, поэтому его двигают руками.
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= lessons.length) return;
    const next = [...lessons];
    [next[index], next[target]] = [next[target], next[index]];
    saveLessons(next);
  };

  const seedFromDefault = () => {
    saveLessons(DEFAULT_LESSONS.map(lesson => ({ ...lesson, resources: [...(lesson.resources || [])] })));
  };

  const patchResources = (lesson: PlatformLesson, next: PlatformLessonResource[]) => {
    patchLesson(lesson.id, { resources: next });
  };

  const tierLabel = (tier: 'pkg-1' | 'pkg-2') => (
    (platform.tiers?.[tier]?.label || '').trim() || DEFAULT_TIER_LABELS[tier]
  );

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <GraduationCap size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white">Программа платформы</h3>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/55">
              Модули и уроки, которые ученик видит после оплаты. Пока программа пустая, показывается встроенный курс.
            </p>
          </div>
        </div>
        <button
          onClick={addLesson}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-900 transition hover:bg-slate-100"
        >
          <Plus size={16} /> Урок
        </button>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Название платформы</span>
            <input
              value={platform.title || ''}
              onChange={event => patchPlatform({ title: event.target.value.slice(0, 80) || undefined })}
              placeholder={DEFAULT_PLATFORM_TITLE}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
            />
          </label>
          <div className="flex items-end">
            <p className="text-[12px] font-semibold leading-5 text-slate-400">
              Стоит в шапке платформы. Пусто — покажем «{DEFAULT_PLATFORM_TITLE}».
            </p>
          </div>
        </div>

        <div>
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <Crown size={12} /> Тарифы
          </span>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {TIERS.map(tier => (
              <div key={tier} className="rounded-2xl border border-slate-200 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {tier === 'pkg-1' ? 'Младший' : 'Старший'}
                </div>
                <input
                  value={platform.tiers?.[tier]?.label || ''}
                  onChange={event => patchPlatform({
                    tiers: {
                      ...(platform.tiers || {}),
                      [tier]: { ...(platform.tiers?.[tier] || {}), label: event.target.value.slice(0, 60) },
                    },
                  })}
                  placeholder={DEFAULT_TIER_LABELS[tier]}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
                />
                <input
                  value={platform.tiers?.[tier]?.description || ''}
                  onChange={event => patchPlatform({
                    tiers: {
                      ...(platform.tiers || {}),
                      [tier]: { ...(platform.tiers?.[tier] || {}), description: event.target.value.slice(0, 200) },
                    },
                  })}
                  placeholder="Что входит — одной строкой"
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                />
              </div>
            ))}
          </div>
        </div>

        {lessons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
            <BookOpen size={22} className="mx-auto text-slate-300" />
            <p className="mt-3 text-[13px] font-semibold text-slate-500">
              Программы пока нет — ученик увидит встроенный курс из кода.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={seedFromDefault}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[13px] font-bold text-white transition hover:bg-slate-800"
              >
                Взять встроенный курс за основу
              </button>
              <button
                onClick={addLesson}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <Plus size={15} /> Пустой урок
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson, index) => {
              const previous = lessons[index - 1];
              const startsModule = !previous || previous.module !== lesson.module;
              return (
                <div key={lesson.id}>
                  {startsModule && (
                    <div className="mb-2 mt-4 flex items-center gap-2 first:mt-0">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {lesson.module || 'Без модуля'}
                      </span>
                      <span className="h-px flex-1 bg-slate-100" />
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start gap-2">
                      <input
                        value={lesson.title}
                        onChange={event => patchLesson(lesson.id, { title: event.target.value })}
                        placeholder="Название урока"
                        className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] font-bold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
                      />
                      <div className="flex shrink-0 items-center">
                        <button
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="flex h-11 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30"
                          aria-label="Выше"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => move(index, 1)}
                          disabled={index === lessons.length - 1}
                          className="flex h-11 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30"
                          aria-label="Ниже"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          onClick={() => saveLessons(lessons.filter(item => item.id !== lesson.id))}
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                          aria-label="Удалить урок"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
                      <label className="block">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Модуль</span>
                        <input
                          value={lesson.module}
                          onChange={event => patchLesson(lesson.id, { module: event.target.value })}
                          placeholder="Модуль 1 · Основы"
                          list="platform-modules"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Длительность</span>
                        <input
                          value={lesson.duration || ''}
                          onChange={event => patchLesson(lesson.id, { duration: event.target.value.slice(0, 20) })}
                          placeholder="16 мин"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                        />
                      </label>
                    </div>

                    <textarea
                      value={lesson.description || ''}
                      onChange={event => patchLesson(lesson.id, { description: event.target.value.slice(0, 600) })}
                      rows={2}
                      placeholder="О чём урок — пара строк для карточки"
                      className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-5 text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                    />

                    <label className="mt-3 block">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <ImageIcon size={12} /> Обложка
                      </span>
                      <input
                        value={lesson.coverUrl || ''}
                        onChange={event => patchLesson(lesson.id, { coverUrl: event.target.value.trim() || undefined })}
                        placeholder="/images/lesson-1.webp или https://..."
                        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[12px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                      />
                      <span className="mt-1.5 block text-[11px] text-slate-400">
                        Пусто — в каталоге нарисуется цветная заглушка с иконкой урока.
                      </span>
                    </label>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_180px]">
                      <label className="block">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <Video size={12} /> Видео
                        </span>
                        <input
                          value={lesson.videoSrc || ''}
                          onChange={event => patchLesson(lesson.id, { videoSrc: event.target.value.trim() })}
                          placeholder="https://www.youtube.com/embed/..."
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[12px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                        />
                      </label>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Иконка</span>
                        <div className="mt-1.5">
                          <ModernSelect
                            value={lesson.icon || ''}
                            onChange={value => patchLesson(lesson.id, { icon: value || undefined })}
                            options={ICON_OPTIONS}
                            ariaLabel="Иконка урока"
                          />
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Кому доступен</span>
                        <div className="mt-1.5">
                          <ModernSelect
                            value={lesson.minTier || 'pkg-1'}
                            onChange={value => patchLesson(lesson.id, { minTier: value === 'pkg-2' ? 'pkg-2' : 'pkg-1' })}
                            options={[
                              { value: 'pkg-1', label: 'Всем оплатившим' },
                              { value: 'pkg-2', label: `Только ${tierLabel('pkg-2')}` },
                            ]}
                            ariaLabel="Доступ к уроку"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <Link2 size={12} /> Материалы
                        </span>
                        <button
                          onClick={() => patchResources(lesson, [
                            ...(lesson.resources || []),
                            { label: 'Новый материал', href: '' },
                          ])}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          <Plus size={13} /> Материал
                        </button>
                      </div>

                      {(lesson.resources || []).length > 0 && (
                        <div className="mt-2 space-y-2">
                          {(lesson.resources || []).map((resource, resourceIndex) => (
                            <div key={`${lesson.id}-res-${resourceIndex}`} className="flex items-center gap-2">
                              <input
                                value={resource.label}
                                onChange={event => patchResources(lesson, (lesson.resources || []).map((item, i) => (
                                  i === resourceIndex ? { ...item, label: event.target.value } : item
                                )))}
                                placeholder="Название"
                                className="h-10 w-40 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                              />
                              <input
                                value={resource.href}
                                onChange={event => patchResources(lesson, (lesson.resources || []).map((item, i) => (
                                  i === resourceIndex ? { ...item, href: event.target.value.trim() } : item
                                )))}
                                placeholder="https://..."
                                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[12px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                              />
                              <button
                                onClick={() => patchResources(lesson, (lesson.resources || []).filter((_, i) => i !== resourceIndex))}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                                aria-label="Удалить материал"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <datalist id="platform-modules">
              {Array.from(new Set(lessons.map(lesson => lesson.module))).filter(Boolean).map(module => (
                <option key={module} value={module} />
              ))}
            </datalist>
          </div>
        )}
      </div>
    </div>
  );
}
