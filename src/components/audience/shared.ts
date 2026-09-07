import { Users, UserCheck, MousePointerClick, Smartphone, Video, CreditCard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type BroadcastMediaType = 'none' | 'photo' | 'video' | 'videoNote';

export interface SegmentPreset {
    key: string;
    label: string;
    description: string;
    icon: LucideIcon;
}

export const segmentPresets: SegmentPreset[] = [
    {
        key: 'all',
        label: 'Все',
        description: 'Вся аудитория',
        icon: Users,
    },
    {
        key: 'profile_opened',
        label: 'Открыли профиль',
        description: 'Были в “Мой прогресс”',
        icon: UserCheck,
    },
    {
        key: 'profile_continue_clicked',
        label: 'Нажали продолжить',
        description: 'Вернулись к уроку',
        icon: MousePointerClick,
    },
    {
        key: 'menu_button_opened_not_continued',
        label: 'Открыл «Мой прогресс», но не продолжил',
        description: 'Зашёл в прогресс и не вернулся к уроку',
        icon: Smartphone,
    },
    {
        key: 'lesson_opened_not_viewed',
        label: 'Открыл урок, но не досмотрел',
        description: 'Можно мягко напомнить об уроке',
        icon: Video,
    },
    {
        key: 'completed_not_paid',
        label: 'Прошёл урок, но не оплатил',
        description: 'Можно напомнить о предложении',
        icon: CreditCard,
    },
];

export const pluralizeContacts = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    let word = 'контактов';
    if (mod10 === 1 && mod100 !== 11) word = 'контакт';
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'контакта';
    return `${n} ${word}`;
};

export const formatRelativeTime = (isoString: string) => {
    if (!isoString) return '—';
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return `только что`;
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    return `${Math.floor(hours / 24)} дн назад`;
};

export const getProgressLabel = (contact: any) => {
    const progress = contact.progress;
    if (!progress) return 'Нет событий';
    const currentStageId = progress.currentStageId;
    if (progress.purchaseStatus === 'paid') return 'Купил';
    if (currentStageId && progress.completedStages?.includes(currentStageId)) return 'Завершил этап';
    if (currentStageId && progress.viewedStages?.includes(currentStageId)) return 'Досмотрел видео';
    if (currentStageId && progress.openedStages?.includes(currentStageId)) return 'Открыл урок';
    if (currentStageId && progress.sentStages?.includes(currentStageId)) return 'Получил урок';
    return 'Нет событий';
};

export const getProgressClass = (label: string) => {
    if (label === 'Купил') return 'bg-emerald-50 text-emerald-600';
    if (label === 'Завершил этап') return 'bg-blue-50 text-blue-600';
    if (label === 'Досмотрел видео') return 'bg-violet-50 text-violet-600';
    if (label === 'Открыл урок') return 'bg-amber-50 text-amber-600';
    if (label === 'Получил урок') return 'bg-slate-100 text-slate-500';
    return 'bg-slate-50 text-slate-400';
};

export const getNextActionLabel = (contact: any) => {
    const label = getProgressLabel(contact);
    if (label === 'Купил') return 'Оплатил';
    if (label === 'Завершил этап') return 'Ждет следующий этап';
    if (label === 'Досмотрел видео') return 'Не нажал кнопку';
    if (label === 'Открыл урок') return 'Не досмотрел';
    if (label === 'Получил урок') return 'Не открыл';
    return 'Нет действий';
};

export const eventLabels: Record<string, string> = {
    stage_sent: 'урок отправлен',
    webapp_opened: 'открыл урок',
    lesson_viewed: 'смотрел видео',
    stage_completed: 'завершил этап',
    menu_button_opened: 'открыл меню прогресса',
    profile_opened: 'открыл профиль',
    profile_continue_clicked: 'нажал продолжить',
    offer_viewed: 'открыл оффер',
    checkout_started: 'начал оплату',
};

export const getLastEventLabel = (contact: any) => {
    const event = contact.progress?.events?.[contact.progress.events.length - 1]?.event;
    return event ? eventLabels[event] || event : '';
};
