import type { FunnelType } from '../types/funnel';

// Названия видов оффера. Те же слова, что и в окне создания воронки: человек
// выбирает «Лид-магнит» и потом ищет его этим же словом в списке и в галерее.
export const FUNNEL_TYPE_LABELS: Record<FunnelType, string> = {
    blank: 'Своя',
    lead: 'Лид-магнит',
    course: 'Продающий урок',
    sales: 'Продажа услуги',
};

export const FUNNEL_TYPE_ORDER: FunnelType[] = ['lead', 'course', 'sales', 'blank'];

// У воронок, созданных до появления поля, вида нет — и придумывать его за
// владельца нечестно: пусть будет видно, что он не проставлен.
export const UNTYPED_LABEL = 'Без вида';

export function getFunnelTypeLabel(type?: string): string {
    return type && type in FUNNEL_TYPE_LABELS
        ? FUNNEL_TYPE_LABELS[type as FunnelType]
        : UNTYPED_LABEL;
}
