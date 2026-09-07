import React from 'react';
import { HelpCircle, Plus, Trash2, GitBranch } from 'lucide-react';
import { FunnelStage, StageQuestion, StageQuestionOption } from '../../types/funnel';
import ModernSelect from '../ui/ModernSelect';

interface QuestionsSectionProps {
    stage: FunnelStage;
    stages: FunnelStage[];
    onUpdate: (stage: FunnelStage) => void;
}

// Идентификаторы намеренно короткие: они уезжают в callback_data кнопки,
// а Telegram обрезает её на 64 байтах.
function nextId(prefix: string, used: string[]) {
    for (let index = 1; index < 100; index += 1) {
        const candidate = `${prefix}${index}`;
        if (!used.includes(candidate)) return candidate;
    }
    return `${prefix}${Date.now() % 1000}`;
}

export default function QuestionsSection({ stage, stages, onUpdate }: QuestionsSectionProps) {
    const questions = stage.questions || [];

    const save = (next: StageQuestion[]) => onUpdate({ ...stage, questions: next });

    const addQuestion = () => {
        const id = nextId('q', questions.map(question => question.id));
        save([...questions, {
            id,
            key: `answer_${questions.length + 1}`,
            text: 'Новый вопрос',
            options: [
                { id: 'o1', label: 'Первый вариант' },
                { id: 'o2', label: 'Второй вариант' },
            ],
        }]);
    };

    const patchQuestion = (questionId: string, changes: Partial<StageQuestion>) => {
        save(questions.map(question => (question.id === questionId ? { ...question, ...changes } : question)));
    };

    const patchOption = (questionId: string, optionId: string, changes: Partial<StageQuestionOption>) => {
        save(questions.map(question => (question.id === questionId
            ? {
                ...question,
                options: question.options.map(option => (option.id === optionId ? { ...option, ...changes } : option)),
            }
            : question)));
    };

    const stageOptions = [
        { value: '', label: 'Остаться на этапе' },
        ...stages
            .filter(item => item.id !== stage.id)
            .map(item => ({ value: item.id, label: `→ ${item.title}` })),
    ];

    return (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                        <HelpCircle size={16} className="text-violet-500" />
                    </div>
                    <div>
                        <div className="text-[14px] font-semibold text-slate-800">Вопросы подписчику</div>
                        <div className="text-[12px] text-slate-400">
                            Уходят кнопками после сообщения этапа. Ответ попадает в профиль и виден ассистенту.
                        </div>
                    </div>
                </div>
                <button
                    onClick={addQuestion}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-500 px-3 text-[13px] font-semibold text-white transition hover:bg-violet-600"
                >
                    <Plus size={15} /> Вопрос
                </button>
            </div>

            {questions.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[13px] text-slate-400">
                    Пока вопросов нет. Один вопрос на этапе — это ответ, на который можно опереться дальше.
                </div>
            ) : (
                <div className="mt-4 space-y-4">
                    {questions.map(question => (
                        <div key={question.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                            <div className="flex items-start gap-2">
                                <input
                                    value={question.text}
                                    onChange={event => patchQuestion(question.id, { text: event.target.value })}
                                    placeholder="Текст вопроса. Можно {name}"
                                    className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                                />
                                <button
                                    onClick={() => save(questions.filter(item => item.id !== question.id))}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                                    aria-label="Удалить вопрос"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Ключ в профиле
                                </span>
                                <input
                                    value={question.key}
                                    onChange={event => patchQuestion(question.id, {
                                        key: event.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24),
                                    })}
                                    placeholder="goal"
                                    className="h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-[12px] text-slate-600 outline-none focus:border-violet-300 focus:bg-white"
                                />
                                <span className="text-[11px] text-slate-400">
                                    под этим именем ответ увидит ассистент
                                </span>
                            </div>

                            <div className="mt-3 space-y-2">
                                {question.options.map(option => (
                                    <div key={option.id} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-2 sm:flex-row sm:items-center">
                                        <input
                                            value={option.label}
                                            onChange={event => patchOption(question.id, option.id, { label: event.target.value })}
                                            placeholder="Текст кнопки"
                                            className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-violet-300"
                                        />
                                        <div className="flex items-center gap-2">
                                            <GitBranch size={14} className="shrink-0 text-slate-300" />
                                            <div className="w-52">
                                                <ModernSelect
                                                    value={option.targetStageId || ''}
                                                    onChange={value => patchOption(question.id, option.id, {
                                                        targetStageId: value || undefined,
                                                    })}
                                                    options={stageOptions}
                                                />
                                            </div>
                                            <button
                                                onClick={() => patchQuestion(question.id, {
                                                    options: question.options.filter(item => item.id !== option.id),
                                                })}
                                                disabled={question.options.length <= 1}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300"
                                                aria-label="Удалить вариант"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => patchQuestion(question.id, {
                                    options: [...question.options, {
                                        id: nextId('o', question.options.map(item => item.id)),
                                        label: 'Ещё вариант',
                                    }],
                                })}
                                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-600 hover:text-violet-700"
                            >
                                <Plus size={13} /> Вариант ответа
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
