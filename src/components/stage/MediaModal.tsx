import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2 } from 'lucide-react';

export interface MediaModalState {
    type: 'photo' | 'video' | 'videoNote' | 'gif';
    action: 'add' | 'edit';
    value: string;
    target?: { kind: 'firstMessage' } | { kind: 'reminder'; reminderId: string };
}

interface MediaModalProps {
    modal: MediaModalState;
    onClose: () => void;
    onSave: (url: string) => void;
}

export default function MediaModal({ modal, onClose, onSave }: MediaModalProps) {
    const [value, setValue] = useState(modal.value);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', modal.type);
            const resp = await fetch('/api/media/upload', { method: 'POST', body: formData });
            const result = await resp.json();
            if (resp.ok && result.url) {
                onSave(result.url);
            } else {
                alert(result.error || 'Ошибка загрузки файла');
            }
        } catch (e) {
            alert('Ошибка загрузки файла');
            console.error(e);
        }
        setUploading(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full relative shadow-2xl border border-slate-100 flex flex-col text-left">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
                        {modal.type === 'photo' && (modal.action === 'add' ? 'Добавить изображение' : 'Изменить изображение')}
                        {modal.type === 'video' && (modal.action === 'add' ? 'Добавить обычное видео' : 'Изменить обычное видео')}
                        {modal.type === 'videoNote' && (modal.action === 'add' ? 'Добавить видео-кругляшок' : 'Изменить видео-кругляшок')}
                        {modal.type === 'gif' && (modal.action === 'add' ? 'Добавить GIF' : 'Изменить GIF')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* File Upload Zone */}
                <div
                    className={`mb-4 border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                        uploading
                            ? 'border-indigo-300 bg-indigo-50/50'
                            : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 bg-slate-50/50'
                    }`}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) void handleFileUpload(file);
                    }}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={modal.type === 'photo' ? 'image/*' : modal.type === 'gif' ? 'image/gif,video/mp4' : 'video/*'}
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleFileUpload(file);
                            e.target.value = '';
                        }}
                    />
                    {uploading ? (
                        <div className="flex flex-col items-center gap-2 py-2">
                            <Loader2 size={32} className="text-indigo-500 animate-spin" />
                            <span className="text-sm font-semibold text-indigo-600">Загрузка...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 py-2">
                            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center">
                                <Upload size={24} className="text-indigo-500" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">
                                {modal.type === 'photo' ? 'Загрузить фото' : modal.type === 'gif' ? 'Загрузить GIF' : 'Загрузить видео'}
                            </span>
                            <span className="text-xs text-slate-400">
                                Нажмите или перетащите файл сюда
                            </span>
                            {modal.type === 'videoNote' && (
                                <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-lg mt-1">
                                    Кругляшок: квадратное видео до 1 минуты
                                </span>
                            )}
                            {modal.type === 'gif' && (
                                <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-lg mt-1">
                                    GIF или mp4 без звука — отправится как зацикленная анимация
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-slate-200"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">или вставьте ссылку</span>
                    <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                {/* URL Input */}
                <div className="mb-5">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={
                            modal.type === 'photo'
                                ? 'https://images.unsplash.com/...'
                                : modal.type === 'gif'
                                    ? 'https://example.com/animation.gif'
                                    : 'https://example.com/video.mp4'
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all font-mono"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold rounded-xl transition-all text-xs uppercase tracking-wider text-center"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={() => {
                            if (value.trim()) {
                                onSave(value.trim());
                            }
                        }}
                        disabled={!value.trim()}
                        className={`flex-1 py-3 px-4 font-bold rounded-xl shadow-lg transition-all text-xs uppercase tracking-wider text-center active:scale-[0.98] ${
                            value.trim()
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            }`}
                    >
                        Сохранить ссылку
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
