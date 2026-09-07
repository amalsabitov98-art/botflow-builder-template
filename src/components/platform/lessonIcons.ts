import {
  Bot, Code2, CreditCard, Inbox, Palette, PlayCircle, Rocket, Smartphone, TrendingUp, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Иконки уроков — из того же линейного набора, что и весь интерфейс.
// Эмодзи выглядели чужеродно: у каждой ОС своя стилистика и толщина.
export const LESSON_ICONS: Record<string, LucideIcon> = {
  setup: Wrench,
  design: Palette,
  webapp: Smartphone,
  crm: Inbox,
  ai: Bot,
  payments: CreditCard,
  traffic: TrendingUp,
  code: Code2,
  launch: Rocket,
};

export function lessonIcon(key?: string): LucideIcon {
  return (key && LESSON_ICONS[key]) || PlayCircle;
}

// Заглушка, которой заполнены уроки до появления настоящего контента.
// Ролик запрещён к встраиванию, и плеер вместо урока показывает «Ошибка 153» —
// со стороны это выглядит как поломка платформы, хотя видео просто не залито.
const PLACEHOLDER_VIDEO_IDS = ['dQw4w9WgXcQ'];

export function hasRealVideo(src?: string) {
  if (!src || !src.trim()) return false;
  return !PLACEHOLDER_VIDEO_IDS.some(id => src.includes(id));
}
