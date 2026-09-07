import React, { useEffect, useState } from 'react';

// Рамка уже реального мобильного вьюпорта, поэтому страница рендерится
// в 390px и масштабируется: брейкпоинты, типографика и отступы остаются
// такими же, как на телефоне, а не превращаются в несуществующее узкое
// устройство с горизонтальной прокруткой.
const VIEWPORT_WIDTH = 390;
const VIEWPORT_HEIGHT = 812;

interface PhoneFrameProps {
    src: string;
    title: string;
    width?: number;
    height?: number;
    // Нужен, когда родитель шлёт в превью данные через postMessage.
    iframeRef?: React.RefObject<HTMLIFrameElement | null>;
    onLoad?: () => void;
}

export default function PhoneFrame({ src, title, width = 268, height = 580, iframeRef, onLoad }: PhoneFrameProps) {
    const scale = width / VIEWPORT_WIDTH;
    // Пока страница внутри грузится, рамка остаётся пустой и белой — её легко
    // принять за сломанный предпросмотр. Поэтому показываем явное ожидание.
    const [loaded, setLoaded] = useState(false);

    useEffect(() => { setLoaded(false); }, [src]);

    return (
        <div
            className="relative max-w-full shrink-0 overflow-hidden rounded-[38px] border-[6px] border-slate-800 bg-slate-950 shadow-lg ring-4 ring-slate-800/10"
            style={{ width: width + 12, height }}
        >
            <div className="absolute inset-x-0 top-0 z-50 flex h-3 justify-center">
                <div className="flex h-2 w-16 items-center justify-center rounded-b-md bg-slate-800">
                    <div className="h-0.5 w-5 rounded-full bg-slate-900" />
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 top-2.5 overflow-hidden bg-white font-sans">
                <iframe
                    ref={iframeRef}
                    onLoad={() => {
                        setLoaded(true);
                        onLoad?.();
                    }}
                    src={src}
                    title={title}
                    className="block origin-top-left select-none border-none bg-white"
                    style={{
                        width: `${VIEWPORT_WIDTH}px`,
                        height: `${VIEWPORT_HEIGHT}px`,
                        transform: `scale(${scale})`,
                    }}
                />

                {!loaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                        <span className="text-[11px] font-semibold text-slate-400">Загружаем предпросмотр…</span>
                    </div>
                )}
            </div>

            <div className="absolute inset-x-0 bottom-0.5 z-50 flex h-1 justify-center">
                <div className="h-0.5 w-16 rounded-full bg-slate-300" />
            </div>
        </div>
    );
}
