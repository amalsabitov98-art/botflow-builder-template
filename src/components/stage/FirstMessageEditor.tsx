import React, { useState, useRef } from 'react';
import { MessageSquare, Smartphone, ImageIcon, Film, Play, AlertTriangle, Edit3, Pin } from 'lucide-react';
import { FunnelStage } from '../../types/funnel';
import ButtonsEditor from './ButtonsEditor';
import type { MediaModalState } from './MediaModal';
import ModernSelect from '../ui/ModernSelect';

interface FirstMessageEditorProps {
    stage: FunnelStage;
    onUpdate: (stage: FunnelStage) => void;
    onOpenMediaModal: (modal: MediaModalState) => void;
}

export default function FirstMessageEditor({ stage, onUpdate, onOpenMediaModal }: FirstMessageEditorProps) {
    const [editingMessage, setEditingMessage] = useState(false);

    const updateFirstMessage = (field: string, value: string) => {
        onUpdate({
            ...stage,
            firstMessage: { ...stage.firstMessage, [field]: value }
        });
    };

    const messageRef = useRef<HTMLTextAreaElement>(null);

    // Оборачивает выделенный фрагмент текста сообщения в HTML-теги Telegram (<b>, <i>, ...).
    const wrapMessageSelection = (open: string, close: string, placeholder = 'текст') => {
        const el = messageRef.current;
        const current = stage.firstMessage.text || '';
        const start = el?.selectionStart ?? current.length;
        const end = el?.selectionEnd ?? current.length;
        const selected = current.slice(start, end) || placeholder;
        const next = current.slice(0, start) + open + selected + close + current.slice(end);
        updateFirstMessage('text', next);
        requestAnimationFrame(() => {
            const node = messageRef.current;
            if (!node) return;
            node.focus();
            const caret = start + open.length;
            node.setSelectionRange(caret, caret + selected.length);
        });
    };

    const messageFormatTools = [
        { label: 'Ж', title: 'Жирный', open: '<b>', close: '</b>', cls: 'font-bold' },
        { label: 'К', title: 'Курсив', open: '<i>', close: '</i>', cls: 'italic' },
        { label: 'П', title: 'Подчёркнутый', open: '<u>', close: '</u>', cls: 'underline' },
        { label: 'З', title: 'Зачёркнутый', open: '<s>', close: '</s>', cls: 'line-through' },
    ];

    return (
                        <div className="p-5 space-y-4">
                            <h4 className="text-red-500 text-[11px] font-bold uppercase tracking-[0.15em]">Первое сообщение</h4>
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 text-xs font-medium">{stage.firstMessage.delay}</span>
                                        {stage.firstMessage.pinMessage && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"><Pin size={10} /> Закрепится</span>}
                                    </div>
                                    <button
                                        onClick={() => setEditingMessage(!editingMessage)}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors"
                                    >
                                        <Edit3 size={12} />
                                    </button>
                                </div>
                                <div className="p-4">
                                    {/* Video Note (Кругляшок) */}
                                    {stage.firstMessage.videoNote && (
                                        <div className="mb-3 relative group flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1.5 block">Telegram Кругляшок</span>
                                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-400 shadow-sm relative flex items-center justify-center bg-slate-100">
                                                <video
                                                    src={stage.firstMessage.videoNote}
                                                    className="w-full h-full object-cover"
                                                    autoPlay
                                                    muted
                                                    loop
                                                    playsInline
                                                    onError={(e) => {
                                                        const target = e.target as HTMLVideoElement;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) {
                                                            const fallback = parent.querySelector('.fallback-vn-preview');
                                                            if (fallback) fallback.classList.remove('hidden');
                                                        }
                                                    }}
                                                />
                                                <div className="fallback-vn-preview hidden flex flex-col items-center justify-center p-2 text-center text-slate-500 bg-amber-50/50 w-full h-full">
                                                    <AlertTriangle size={16} className="mb-1 text-amber-500 animate-pulse" />
                                                    <span className="text-[9px] font-bold text-amber-800 leading-tight">Ошибка кругляшка</span>
                                                    <span className="text-[7px] text-slate-400 font-mono break-all truncate max-w-[80%]">{stage.firstMessage.videoNote}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex gap-3 justify-center w-full">
                                                <button
                                                    onClick={() => onOpenMediaModal({ type: 'videoNote', action: 'edit', value: stage.firstMessage.videoNote || '', target: { kind: 'firstMessage' } })}
                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase"
                                                >
                                                    Изменить
                                                </button>
                                                <button
                                                    onClick={() => updateFirstMessage('videoNote', '')}
                                                    className="text-[10px] font-bold text-red-500 hover:text-red-650 uppercase"
                                                >
                                                    Удалить
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {!stage.firstMessage.videoNote && (
                                        <button
                                            onClick={() => onOpenMediaModal({ type: 'videoNote', action: 'add', value: '', target: { kind: 'firstMessage' } })}
                                            className="mb-3 w-full py-2 bg-slate-50 hover:bg-indigo-50 border border-dashed border-slate-200 hover:border-indigo-300 rounded-lg text-xs text-slate-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Smartphone size={12} />
                                            + Добавить кругляшок (Видео)
                                        </button>
                                    )}

                                    {/* Photo above message */}
                                    {stage.firstMessage.photo && (
                                        <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200 relative group text-left">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Изображение к сообщению</span>
                                            <div className="relative w-full h-32 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200/50">
                                                <img
                                                    src={stage.firstMessage.photo}
                                                    alt="Фото к сообщению"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) {
                                                            const fallback = parent.querySelector('.fallback-img-preview');
                                                            if (fallback) fallback.classList.remove('hidden');
                                                        }
                                                    }}
                                                />
                                                <div className="fallback-img-preview hidden flex flex-col items-center justify-center p-3 text-center text-slate-500 bg-amber-50/50 w-full h-full">
                                                    <AlertTriangle size={24} className="mb-1.5 text-amber-500 animate-pulse" />
                                                    <span className="text-[11px] font-bold text-amber-800 leading-tight mb-1">Не удалось показать картинку в браузере</span>
                                                    <span className="text-[9px] text-slate-500 leading-tight max-w-[90%] mx-auto mb-1">
                                                        В боте она отправится нормально, но для предпросмотра здесь скопируйте <b>прямой адрес изображения</b> (Правый клик → Копировать адрес изображения).
                                                    </span>
                                                    <span className="text-[8px] break-all text-slate-400 font-mono leading-none max-w-[90%] truncate">{stage.firstMessage.photo}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex gap-3 justify-end w-full">
                                                <button
                                                    onClick={() => onOpenMediaModal({ type: 'photo', action: 'edit', value: stage.firstMessage.photo || '', target: { kind: 'firstMessage' } })}
                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase"
                                                >
                                                    Изменить
                                                </button>
                                                <button
                                                    onClick={() => updateFirstMessage('photo', '')}
                                                    className="text-[10px] font-bold text-red-500 hover:text-red-650 uppercase"
                                                >
                                                    Удалить
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {!stage.firstMessage.photo && !stage.firstMessage.video && !stage.firstMessage.gif && (
                                        <button
                                            onClick={() => onOpenMediaModal({ type: 'photo', action: 'add', value: '', target: { kind: 'firstMessage' } })}
                                            className="mb-3 w-full py-2 bg-slate-50 hover:bg-indigo-50 border border-dashed border-slate-200 hover:border-indigo-300 rounded-lg text-xs text-slate-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <ImageIcon size={12} />
                                            + Добавить фото
                                        </button>
                                    )}

                                    {/* Standard Video */}
                                    {stage.firstMessage.video && (
                                        <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200 relative group text-left">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Видео к сообщению</span>
                                            <div className="relative w-full h-32 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200/50">
                                                <video
                                                    src={stage.firstMessage.video}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                    onError={(e) => {
                                                        const target = e.target as HTMLVideoElement;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) {
                                                            const fallback = parent.querySelector('.fallback-std-preview');
                                                            if (fallback) fallback.classList.remove('hidden');
                                                        }
                                                    }}
                                                />
                                                <div className="fallback-std-preview hidden flex flex-col items-center justify-center p-3 text-center text-slate-500 bg-amber-50/50 w-full h-full">
                                                    <AlertTriangle size={24} className="mb-1.5 text-amber-500 animate-pulse" />
                                                    <span className="text-[11px] font-bold text-amber-800 leading-tight mb-1">Видео не воспроизводится в браузере</span>
                                                    <span className="text-[9px] text-slate-500 leading-tight max-w-[90%] mx-auto mb-1">
                                                        В боте видео отправится нормально, но для предпросмотра здесь используйте <b>прямую ссылку на .mp4 файл</b>.
                                                    </span>
                                                    <span className="text-[8px] break-all text-slate-400 font-mono leading-none max-w-[90%] truncate">{stage.firstMessage.video}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex gap-3 justify-end w-full">
                                                <button
                                                    onClick={() => onOpenMediaModal({ type: 'video', action: 'edit', value: stage.firstMessage.video || '', target: { kind: 'firstMessage' } })}
                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase"
                                                >
                                                    Изменить
                                                </button>
                                                <button
                                                    onClick={() => updateFirstMessage('video', '')}
                                                    className="text-[10px] font-bold text-red-500 hover:text-red-650 uppercase"
                                                >
                                                    Удалить
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {!stage.firstMessage.video && !stage.firstMessage.photo && !stage.firstMessage.gif && (
                                        <button
                                            onClick={() => onOpenMediaModal({ type: 'video', action: 'add', value: '', target: { kind: 'firstMessage' } })}
                                            className="mb-3 w-full py-2 bg-slate-50 hover:bg-indigo-50 border border-dashed border-slate-200 hover:border-indigo-300 rounded-lg text-xs text-slate-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Film size={12} />
                                            + Добавить обычное видео
                                        </button>
                                    )}

                                    {/* GIF / анимация */}
                                    {stage.firstMessage.gif && (
                                        <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200 relative group text-left">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">GIF-анимация к сообщению</span>
                                            <div className="relative w-full h-32 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200/50">
                                                <video
                                                    src={stage.firstMessage.gif}
                                                    className="w-full h-full object-cover"
                                                    autoPlay
                                                    muted
                                                    loop
                                                    playsInline
                                                    onError={(e) => {
                                                        const target = e.target as HTMLVideoElement;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) {
                                                            const fallback = parent.querySelector('.fallback-gif-preview');
                                                            if (fallback) fallback.classList.remove('hidden');
                                                        }
                                                    }}
                                                />
                                                <div className="fallback-gif-preview hidden flex flex-col items-center justify-center p-3 text-center text-slate-500 bg-amber-50/50 w-full h-full">
                                                    <AlertTriangle size={24} className="mb-1.5 text-amber-500 animate-pulse" />
                                                    <span className="text-[11px] font-bold text-amber-800 leading-tight mb-1">GIF не воспроизводится в браузере</span>
                                                    <span className="text-[9px] text-slate-500 leading-tight max-w-[90%] mx-auto mb-1">
                                                        В боте анимация отправится нормально (sendAnimation). Для предпросмотра здесь используйте прямую ссылку на .gif или .mp4.
                                                    </span>
                                                    <span className="text-[8px] break-all text-slate-400 font-mono leading-none max-w-[90%] truncate">{stage.firstMessage.gif}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex gap-3 justify-end w-full">
                                                <button
                                                    onClick={() => onOpenMediaModal({ type: 'gif', action: 'edit', value: stage.firstMessage.gif || '', target: { kind: 'firstMessage' } })}
                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase"
                                                >
                                                    Изменить
                                                </button>
                                                <button
                                                    onClick={() => updateFirstMessage('gif', '')}
                                                    className="text-[10px] font-bold text-red-500 hover:text-red-650 uppercase"
                                                >
                                                    Удалить
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {!stage.firstMessage.gif && !stage.firstMessage.photo && !stage.firstMessage.video && (
                                        <button
                                            onClick={() => onOpenMediaModal({ type: 'gif', action: 'add', value: '', target: { kind: 'firstMessage' } })}
                                            className="mb-3 w-full py-2 bg-slate-50 hover:bg-indigo-50 border border-dashed border-slate-200 hover:border-indigo-300 rounded-lg text-xs text-slate-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Play size={12} />
                                            + Добавить GIF
                                        </button>
                                    )}

                                    {editingMessage ? (
                                        <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                                            {stage.firstMessage.videoNote && (
                                                <div className="mb-3">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Порядок отправки кругляшка</label>
                                                    <ModernSelect
                                                        value={stage.firstMessage.mediaOrder || 'media_first'}
                                                        onChange={nextValue => updateFirstMessage('mediaOrder', nextValue)}
                                                        options={[
                                                            { value: 'media_first', label: '🎬 Сначала кругляшок, затем текст через 10с' },
                                                            { value: 'text_first', label: '📝 Сначала текст, затем кругляшок через 10с' },
                                                        ]}
                                                        buttonClassName="h-9 rounded-lg px-2.5 text-sm shadow-none"
                                                        ariaLabel="Порядок отправки кругляшка"
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Текст сообщения</label>
                                                    <div className="flex items-center gap-1">
                                                        {messageFormatTools.map((tool) => (
                                                            <button
                                                                key={tool.label}
                                                                type="button"
                                                                title={tool.title}
                                                                onMouseDown={(e) => { e.preventDefault(); wrapMessageSelection(tool.open, tool.close); }}
                                                                className={`h-6 w-6 rounded-md border border-slate-200 bg-white text-[12px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors ${tool.cls}`}
                                                            >
                                                                {tool.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <textarea
                                                    ref={messageRef}
                                                    value={stage.firstMessage.text}
                                                    onChange={(e) => updateFirstMessage('text', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-700 text-sm leading-relaxed resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                                                    autoFocus
                                                />
                                                <div className="mt-1 text-[10px] text-slate-400">Выдели текст и нажми <span className="font-bold">Ж</span> — станет жирным в Telegram. Поддерживается <b>жирный</b>, курсив, подчёркивание.</div>
                                            </div>
                                            <ButtonsEditor
                                                buttonText={stage.firstMessage.buttonText || ''}
                                                buttonAction={stage.firstMessage.buttonAction || ''}
                                                buttonUrl={stage.firstMessage.buttonUrl || ''}
                                                buttonStyle={stage.firstMessage.buttonStyle || ''}
                                                onChange={(data) => {
                                                    onUpdate({
                                                        ...stage,
                                                        firstMessage: {
                                                            ...stage.firstMessage,
                                                            buttonText: data.buttonText,
                                                            buttonAction: data.buttonAction as any,
                                                            buttonUrl: data.buttonUrl,
                                                            buttonStyle: data.buttonStyle
                                                        }
                                                    });
                                                }}
                                            />
                                            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(stage.firstMessage.pinMessage)}
                                                    onChange={(event) => updateFirstMessage('pinMessage', event.target.checked as any)}
                                                    className="mt-0.5 accent-amber-500"
                                                />
                                                <span className="text-xs leading-4 text-amber-800"><span className="font-semibold">📌 Закрепить сообщение в Telegram</span><span className="block text-[10px] text-amber-700/80">Боту нужны права на закрепление сообщений в чате.</span></span>
                                            </label>
                                            <button
                                                onClick={() => setEditingMessage(false)}
                                                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors"
                                            >
                                                Готово
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                             {stage.firstMessage.videoNote && (
                                                 <div className="mb-2 text-[9px] text-slate-400 font-bold flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60 w-fit">
                                                     <span className="uppercase text-slate-500 tracking-wider">Очередь:</span>
                                                     <span className="text-indigo-600">
                                                         {stage.firstMessage.mediaOrder === 'text_first' 
                                                             ? '📝 Текст ➡️ 10с ➡️ 🎬 Кругляшок' 
                                                             : '🎬 Кругляшок ➡️ 10с ➡️ 📝 Текст'
                                                         }
                                                     </span>
                                                 </div>
                                            )}
                                            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                                {stage.firstMessage.text}
                                            </p>
                                            {stage.firstMessage.buttonText && (
                                                <div className="flex flex-col gap-2 mt-4">
                                                    {stage.firstMessage.buttonText.split('|').map((t, idx) => {
                                                        const actions = (stage.firstMessage.buttonAction || '').split('|');
                                                        const action = (actions[idx] || actions[0] || 'next_stage').trim();
                                                        const styles = (stage.firstMessage.buttonStyle || '').split('|');
                                                        const style = (styles[idx] || styles[0] || 'default').trim();

                                                        let bgClass = "bg-slate-900 text-white";
                                                        if (style === 'primary') bgClass = "bg-blue-600 text-white";
                                                        else if (style === 'success') bgClass = "bg-emerald-600 text-white";
                                                        else if (style === 'danger') bgClass = "bg-red-500 text-white";

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`w-full py-2.5 ${bgClass} text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 shadow-sm`}
                                                            >
                                                                {action === 'open_webapp' && <Smartphone size={12} />}
                                                                {t.trimStart()}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Message stats */}
                            <div className="flex items-center gap-2 text-slate-400 text-xs">
                                <MessageSquare size={12} />
                                <span>0</span>
                                <span className="text-slate-300">Количество полученных сообщений без учета недошедших</span>
                            </div>

                        </div>
    );
}
