import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ModernSelect from '../ui/ModernSelect';

interface VisualButton {
    text: string;
    action: string;
    url: string;
    style: string;
}
interface ButtonsEditorProps {
    buttonText: string;
    buttonAction: string;
    buttonUrl: string;
    buttonStyle: string;
    onChange: (data: { buttonText: string; buttonAction: string; buttonUrl: string; buttonStyle: string }) => void;
}

const parsePropsToButtons = (text: string, action: string, url: string, style: string): VisualButton[] => {
    if (!text) return [];
    const texts = text.split('|').map(t => t.trim());
    const actions = (action || '').split('|').map(a => a.trim());
    const urls = (url || '').split('|').map(u => u.trim());
    const styles = (style || '').split('|').map(s => s.trim());

    return texts.map((t, idx) => ({
        text: t,
        action: actions[idx] || 'next_stage',
        url: urls[idx] || '',
        style: styles[idx] || 'default'
    }));
};

export default function ButtonsEditor({
    buttonText,
    buttonAction,
    buttonUrl,
    buttonStyle,
    onChange
}: ButtonsEditorProps) {
    const [buttons, setButtons] = useState<VisualButton[]>(() => 
        parsePropsToButtons(buttonText, buttonAction, buttonUrl, buttonStyle)
    );

    const propTexts = buttonText ? buttonText.split('|').map(t => t.trim()) : [];
    const propActions = (buttonAction || '').split('|').map(a => a.trim());
    const propUrls = (buttonUrl || '').split('|').map(u => u.trim());
    const propStyles = (buttonStyle || '').split('|').map(s => s.trim());

    const isSyncNeeded = () => {
        if (propTexts.length !== buttons.length) return true;
        for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].text.trim() !== propTexts[i]) return true;
            if ((buttons[i].action || 'next_stage') !== (propActions[i] || 'next_stage')) return true;
            if ((buttons[i].url || '') !== (propUrls[i] || '')) return true;
            if ((buttons[i].style || 'default') !== (propStyles[i] || 'default')) return true;
        }
        return false;
    };

    if (isSyncNeeded()) {
        setButtons(parsePropsToButtons(buttonText, buttonAction, buttonUrl, buttonStyle));
    }

    const updateButtons = (newButtons: VisualButton[]) => {
        setButtons(newButtons);
        if (newButtons.length === 0) {
            onChange({
                buttonText: '',
                buttonAction: '',
                buttonUrl: '',
                buttonStyle: ''
            });
            return;
        }
        onChange({
            buttonText: newButtons.map(b => b.text).join(' | '),
            buttonAction: newButtons.map(b => b.action || 'next_stage').join(' | '),
            buttonUrl: newButtons.map(b => b.url || '').join(' | '),
            buttonStyle: newButtons.map(b => b.style || 'default').join(' | ')
        });
    };

    const handleTextChange = (idx: number, val: string) => {
        const copy = [...buttons];
        copy[idx].text = val.replace(/\|/g, ''); // prevent pipes in text
        updateButtons(copy);
    };

    const handleActionChange = (idx: number, val: string) => {
        const copy = [...buttons];
        copy[idx].action = val;
        if (val === 'next_stage' || val === 'open_webapp') {
            copy[idx].url = '';
        }
        updateButtons(copy);
    };

    const handleUrlChange = (idx: number, val: string) => {
        const copy = [...buttons];
        copy[idx].url = val.replace(/\|/g, ''); // prevent pipes in url
        updateButtons(copy);
    };

    const handleStyleChange = (idx: number, val: string) => {
        const copy = [...buttons];
        copy[idx].style = val;
        updateButtons(copy);
    };

    const handleAdd = () => {
        const newButtons = [...buttons, {
            text: 'Новая кнопка',
            action: 'next_stage',
            url: '',
            style: 'default'
        }];
        updateButtons(newButtons);
    };

    const handleDelete = (idx: number) => {
        const copy = buttons.filter((_, i) => i !== idx);
        updateButtons(copy);
    };

    const colorOptions = [
        { value: 'default', label: 'Серая', bg: 'bg-slate-400' },
        { value: 'primary', label: 'Синяя', bg: 'bg-blue-500' },
        { value: 'success', label: 'Зелёная', bg: 'bg-emerald-500' },
        { value: 'danger', label: 'Красная', bg: 'bg-red-500' },
    ];

    return (
        <div className="space-y-3 mt-2 mb-4 p-3 bg-slate-100/50 rounded-xl border border-slate-200/60 text-left">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Кнопки под сообщением</span>
                <button
                    type="button"
                    onClick={handleAdd}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2 py-1 rounded-md transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                    <Plus size={11} />
                    Добавить кнопку
                </button>
            </div>

            {buttons.length === 0 ? (
                <div className="text-center py-4 bg-white border border-dashed border-slate-200 rounded-lg text-[11px] text-slate-400">
                    У этого сообщения нет кнопок. Нажмите «Добавить кнопку» выше.
                </div>
            ) : (
                <div className="space-y-2.5">
                    {buttons.map((btn, idx) => (
                        <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-sm relative">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Кнопка #{idx + 1}</span>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(idx)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded cursor-pointer"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Текст на кнопке</label>
                                    <input
                                        type="text"
                                        value={btn.text}
                                        onChange={(e) => handleTextChange(idx, e.target.value)}
                                        placeholder="Например: Скачать PDF 📥"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-750 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Действие</label>
                                        <ModernSelect
                                            value={btn.action}
                                            onChange={nextValue => handleActionChange(idx, nextValue)}
                                            options={[
                                                { value: 'next_stage', label: 'Перейти на след. шаг' },
                                                { value: 'open_webapp', label: 'Открыть Web App (Сайт)' },
                                                { value: 'url', label: 'Внешняя ссылка (URL)' },
                                            ]}
                                            buttonClassName="h-8 rounded-lg bg-slate-50 px-2.5 text-xs shadow-none"
                                            ariaLabel="Действие кнопки"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Цвет кнопки</label>
                                        <div className="flex items-center justify-between bg-slate-50 p-1 rounded-lg border border-slate-200">
                                            <div className="flex gap-1.5 pl-1">
                                                {colorOptions.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        title={opt.label}
                                                        onClick={() => handleStyleChange(idx, opt.value)}
                                                        className={`w-4 h-4 rounded-full ${opt.bg} flex items-center justify-center transition-all ${
                                                            btn.style === opt.value
                                                                ? `ring-2 ring-offset-1 ring-indigo-500 scale-110`
                                                                : 'hover:scale-105 opacity-60 hover:opacity-100'
                                                        }`}
                                                    >
                                                        {btn.style === opt.value && (
                                                            <span className="w-1 h-1 bg-white rounded-full" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-500 pr-1">
                                                {colorOptions.find(o => o.value === btn.style)?.label || 'Серая'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {btn.action === 'url' && (
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Ссылка или @username</label>
                                        <input
                                            type="text"
                                            value={btn.url}
                                            onChange={(e) => handleUrlChange(idx, e.target.value)}
                                            placeholder="https://site.com или @ваш_telegram"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-750 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 font-medium"
                                        />
                                        <div className="mt-0.5 text-[9px] text-slate-400">Для «написать в личку» впиши <span className="font-bold">@свой_username</span> — откроется чат с тобой.</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
