import React from 'react';
import { RotateCw, ExternalLink, Smartphone } from 'lucide-react';
import ModernSelect from '../ui/ModernSelect';

// The preview frame is narrower than a real mobile CSS viewport. Rendering the
// iframe at 390px and scaling it into the frame keeps responsive breakpoints,
// typography and spacing identical to a real phone instead of creating a
// non-existent 228px-wide device with horizontal scrolling.
const PHONE_VIEWPORT_WIDTH = 390;
const PHONE_VIEWPORT_HEIGHT = 812;
const PHONE_SCREEN_WIDTH = 268;
const PHONE_VIEWPORT_SCALE = PHONE_SCREEN_WIDTH / PHONE_VIEWPORT_WIDTH;

interface StagePhonePreviewProps {
    stageId: string;
    funnelId: string;
    enabled?: boolean;
    access?: 'public' | 'signed' | 'paid';
    onAccessChange?: (access: 'public' | 'signed' | 'paid') => void;
}

export default function StagePhonePreview({
    stageId,
    funnelId,
    enabled = false,
    access = 'public',
    onAccessChange,
}: StagePhonePreviewProps) {
    if (!enabled) {
        return (
            <div className="flex min-h-[300px] flex-col p-5">
                <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.15em]">Web App страница</h4>
                <div className="my-auto flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                        <Smartphone size={22} />
                    </div>
                    <div className="mt-4 text-sm font-medium text-slate-700">Страница не подключена</div>
                    <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
                        Этот этап работает как обычная Telegram-цепочка: сообщение, кнопки, переход и напоминания.
                    </p>
                </div>
            </div>
        );
    }

    return (
                        <div className="p-5 flex flex-col items-center justify-start space-y-4 bg-slate-50/15">
                            <div className="w-full flex items-center justify-between">
                                <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.15em]">Сайт (Мобильная версия)</h4>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            const iframe = document.getElementById(`iframe-preview-${stageId}`) as HTMLIFrameElement;
                                            if (iframe) {
                                                const currentSrc = iframe.src;
                                                iframe.src = '';
                                                iframe.src = currentSrc;
                                            }
                                        }}
                                        className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                                        title="Обновить предпросмотр"
                                    >
                                        <RotateCw size={11} />
                                    </button>
                                    <a
                                        href={`/?funnel=${funnelId}&stage=${stageId}&preview=phone`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                                        title="Открыть в новой вкладке"
                                    >
                                        <ExternalLink size={11} />
                                    </a>
                                </div>
                            </div>

                            <label className="w-full">
                                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                    Доступ к контенту
                                </span>
                                <ModernSelect
                                    value={access}
                                    onChange={nextValue => onAccessChange?.(nextValue as 'public' | 'signed' | 'paid')}
                                    options={[
                                        { value: 'public', label: 'Публичный / бесплатный' },
                                        { value: 'signed', label: 'Только по защищённой ссылке' },
                                        { value: 'paid', label: 'Только после оплаты' },
                                    ]}
                                    buttonClassName="h-9 rounded-lg px-2 text-xs shadow-none"
                                    ariaLabel="Доступ к контенту"
                                />
                            </label>

                            {/* Mobile iPhone Frame Mockup */}
                            <div className="relative mx-auto h-[580px] w-[280px] shrink-0 overflow-hidden rounded-[38px] border-[6px] border-slate-800 bg-slate-950 shadow-lg ring-4 ring-slate-800/10">
                                {/* Notch */}
                                <div className="absolute top-0 inset-x-0 h-3 flex justify-center z-50">
                                    <div className="w-16 h-2 bg-slate-800 rounded-b-md flex items-center justify-center">
                                        <div className="w-5 h-0.5 bg-slate-900 rounded-full"></div>
                                    </div>
                                </div>
                                {/* Content Screen */}
                                <div className="absolute inset-x-0 bottom-0 top-2.5 overflow-hidden bg-white font-sans">
                                    <iframe
                                        id={`iframe-preview-${stageId}`}
                                        src={`/?funnel=${funnelId}&stage=${stageId}&preview=phone`}
                                        className="block origin-top-left select-none border-none bg-white"
                                        style={{
                                            width: `${PHONE_VIEWPORT_WIDTH}px`,
                                            height: `${PHONE_VIEWPORT_HEIGHT}px`,
                                            transform: `scale(${PHONE_VIEWPORT_SCALE})`,
                                        }}
                                        title={`Mobile-Preview-${stageId}`}
                                    />
                                </div>
                                {/* Home Bar */}
                                <div className="absolute bottom-0.5 inset-x-0 h-1 flex justify-center z-50">
                                    <div className="w-16 h-0.5 bg-slate-300 rounded-full"></div>
                                </div>
                            </div>

                            {/* Mini label/URL */}
                            <div className="w-full text-center">
                                <span className="text-[9px] font-mono text-slate-400 select-all hover:text-slate-600 break-all leading-tight block max-w-full truncate px-1">
                                    /?funnel={funnelId}&stage={stageId}
                                </span>
                            </div>
                        </div>
    );
}
