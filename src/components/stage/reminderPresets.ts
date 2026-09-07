import { Reminder } from '../../types/funnel';

export const reminderConditionOptions = [
    { value: 'not_completed', label: 'Не завершил этап' },
    { value: 'not_opened', label: 'Не открыл урок' },
    { value: 'opened_not_viewed', label: 'Открыл, но не досмотрел' },
    { value: 'viewed_not_completed', label: 'Досмотрел, но не нажал кнопку' },
    { value: 'not_paid', label: 'Не оплатил' },
] as const;

export const getReminderConditionLabel = (condition?: Reminder['condition']) => {
    return reminderConditionOptions.find(option => option.value === (condition || 'not_completed'))?.label || 'Не завершил этап';
};

export const smartReminderPresets = [
    {
        id: 'not-opened',
        delayMinutes: 60,
        delayLabel: '1 час',
        condition: 'not_opened' as const,
        message: '👀 {name}, ты пока не открыл урок.\n\nЯ отправил его час назад — начни с видео, там самый короткий путь к результату 👇',
        buttonText: 'Открыть урок',
    },
    {
        id: 'opened-not-viewed',
        delayMinutes: 180,
        delayLabel: '3 часа',
        condition: 'opened_not_viewed' as const,
        message: '💡 {name}, ты открыл урок, но похоже не досмотрел видео.\n\nВернись и досмотри до конца — там как раз практический шаг 👇',
        buttonText: 'Досмотреть урок',
    },
    {
        id: 'viewed-not-completed',
        delayMinutes: 720,
        delayLabel: '12 часов',
        condition: 'viewed_not_completed' as const,
        message: '✅ {name}, видео уже посмотрено — остался один клик, чтобы перейти дальше.\n\nНажми кнопку под уроком и продолжим 👇',
        buttonText: 'Завершить этап',
    },
    {
        id: 'not-paid',
        delayMinutes: 120,
        delayLabel: '2 часа',
        condition: 'not_paid' as const,
        message: '🔥 {name}, предложение ещё доступно.\n\nЕсли хочешь забрать материалы и двигаться быстрее — вернись на страницу и оформи доступ 👇',
        buttonText: 'Вернуться к предложению',
    },
];
