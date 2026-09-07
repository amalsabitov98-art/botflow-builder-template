import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, ExternalLink } from 'lucide-react';
import type { Funnel, PlatformLesson } from '../../types/funnel';
import PhoneFrame from '../ui/PhoneFrame';
import { openPreviewWindow, previewWindows } from './platformPreviewChannel';

type Tier = 'pkg-1' | 'pkg-2';

interface PlatformPreviewProps {
    funnel: Funnel;
}

const DEFAULT_TIER_LABELS: Record<Tier, string> = {
    'pkg-1': 'IT-Архитектор',
    'pkg-2': '⭐ IT-Владелец',
};

// Данные в превью передаются из редактора, а не запрашиваются с сервера:
// платформа закрыта оплатой, а показать надо в том числе несохранённые правки.
export default function PlatformPreview({ funnel }: PlatformPreviewProps) {
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const previewUrl = `/?funnel=${encodeURIComponent(funnel.id)}&stage=platform&preview=phone`;
    // Страница внутри рамки сама сообщает о готовности. Если сообщения нет —
    // она не загрузилась (в dev так бывает после правок: старый модуль отдаёт
    // 404), и вместо пустого белого прямоугольника честнее сказать об этом.
    const [ready, setReady] = useState(false);
    const [stalled, setStalled] = useState(false);

    const reload = useCallback(() => {
        setReady(false);
        setStalled(false);
        if (frameRef.current) frameRef.current.src = previewUrl;
    }, [previewUrl]);

    useEffect(() => {
        setReady(false);
        setStalled(false);
    }, [previewUrl]);

    useEffect(() => {
        if (ready) return;
        const timer = setTimeout(() => setStalled(true), 12000);
        return () => clearTimeout(timer);
    }, [ready, previewUrl]);

    const sessions = funnel.platform?.sessions;
    const bonus = funnel.platform?.bonus;
    const curatorUrl = funnel.platform?.curatorUrl;
    const lessons = funnel.platform?.lessons;
    const platformTitle = funnel.platform?.title;
    const tiers = funnel.platform?.tiers;
    // Смотреть платформу глазами младшего тарифа важнее, чем старшего: именно
    // там видно, что закрыто и чем это подписано.
    const [tier, setTier] = useState<Tier>('pkg-2');
    const tierName = (level: Tier) => (tiers?.[level]?.label || '').trim() || DEFAULT_TIER_LABELS[level];

    const publish = useCallback(() => {
        const targets: Window[] = [
            ...(frameRef.current?.contentWindow ? [frameRef.current.contentWindow] : []),
            ...previewWindows(),
        ];
        if (targets.length === 0) return;

        const now = Date.now();
        const visible = (minTier?: string) => tier === 'pkg-2' || (minTier || 'pkg-1') === 'pkg-1';
        const allLessons = lessons || [];

        const message = {
            type: 'platform-preview',
            tier,
            title: platformTitle || '',
            tierLabels: {
                'pkg-1': tiers?.['pkg-1']?.label || '',
                'pkg-2': tiers?.['pkg-2']?.label || '',
            },
            lessons: allLessons.filter((lesson: PlatformLesson) => visible(lesson.minTier)).map((lesson: PlatformLesson) => ({
                id: lesson.id,
                module: lesson.module,
                title: lesson.title,
                icon: lesson.icon || '',
                duration: lesson.duration || '',
                description: lesson.description || '',
                coverUrl: lesson.coverUrl || '',
                videoSrc: lesson.videoSrc || '',
                minTier: lesson.minTier || 'pkg-1',
                resources: (lesson.resources || []).filter(resource => visible(resource.minTier)),
            })),
            lockedLessons: allLessons.filter((lesson: PlatformLesson) => !visible(lesson.minTier)).map((lesson: PlatformLesson) => ({
                id: lesson.id,
                module: lesson.module,
                title: lesson.title,
                duration: lesson.duration || '',
            })),
            sessions: (sessions || []).filter(session => visible(session.minTier)).map(session => {
                const startsAt = session.startsAt ? new Date(session.startsAt).getTime() : null;
                const upcoming = Boolean(startsAt && startsAt > now);
                return {
                    id: session.id,
                    title: session.title,
                    description: session.description || '',
                    startsAt: session.startsAt || null,
                    durationMin: session.durationMin || null,
                    joinUrl: upcoming ? session.joinUrl || null : null,
                    recordingUrl: upcoming ? null : session.recordingUrl || null,
                    materials: session.materials || [],
                    upcoming,
                };
            }),
            bonus: bonus?.enabled
                ? {
                    balance: 0,
                    currencyLabel: bonus.currencyLabel || 'бонусов',
                    perLesson: bonus.perLesson || 0,
                    perQuestion: bonus.perQuestion || 0,
                    rewards: (bonus.rewards || []).map(reward => ({
                        id: reward.id,
                        title: reward.title,
                        description: reward.description || '',
                        price: reward.price,
                        unlocked: false,
                    })),
                }
                : null,
            curatorUrl: curatorUrl || '',
        };

        for (const target of targets) target.postMessage(message, window.location.origin);
    }, [sessions, bonus, curatorUrl, lessons, platformTitle, tiers, tier]);

    // Превью само сообщает о готовности: иначе первое сообщение уходит
    // раньше, чем внутри страницы появится слушатель.
    useEffect(() => {
        const onReady = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type !== 'platform-preview-ready') return;
            setReady(true);
            setStalled(false);
            publish();
        };
        window.addEventListener('message', onReady);
        return () => window.removeEventListener('message', onReady);
    }, [publish]);

    // Правки в редакторе уезжают в превью сразу, без сохранения.
    useEffect(() => { publish(); }, [publish]);

    return (
        <div className="flex flex-col items-center">
            <div className="mb-3 flex w-full items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Платформа глазами ученика
                </span>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={reload}
                        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                        title="Обновить предпросмотр"
                    >
                        <RotateCw size={12} />
                    </button>
                    <button
                        onClick={() => openPreviewWindow(previewUrl)}
                        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                        title="Открыть в новой вкладке"
                    >
                        <ExternalLink size={12} />
                    </button>
                </div>
            </div>

            <div className="mb-3 flex w-full items-center gap-1 rounded-xl bg-slate-100 p-1">
                {(['pkg-1', 'pkg-2'] as Tier[]).map(level => (
                    <button
                        key={level}
                        onClick={() => setTier(level)}
                        className={`h-8 flex-1 truncate rounded-lg px-2 text-[11px] font-bold transition ${
                            tier === level ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                        title={`Показать платформу глазами тарифа «${tierName(level)}»`}
                    >
                        {tierName(level)}
                    </button>
                ))}
            </div>

            <PhoneFrame
                src={previewUrl}
                title="Платформа — предпросмотр"
                iframeRef={frameRef}
                onLoad={publish}
            />

            {stalled && !ready && (
                <div className="mt-3 flex max-w-[280px] flex-col items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                    <p className="text-[11px] font-semibold leading-4 text-amber-800">
                        Предпросмотр не ответил. Обычно помогает перезагрузка.
                    </p>
                    <button
                        onClick={reload}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-[11px] font-bold text-white transition hover:bg-amber-600"
                    >
                        <RotateCw size={12} /> Перезагрузить
                    </button>
                </div>
            )}

            <p className="mt-3 max-w-[280px] text-center text-[11px] leading-4 text-slate-400">
                Показаны текущие правки, включая несохранённые. Баланс бонусов в предпросмотре нулевой.
            </p>
        </div>
    );
}
