import React from 'react';
import { Gift, Trophy } from 'lucide-react';

interface ChallengeProgressBarProps {
  stageId?: string;
  stageIndex?: number;
  onBonusClick?: () => void;
}

const STAGES_META: Record<string, { step: number; title: string; percent: number }> = {
  'stage-0': { step: 1, title: 'Каркас сайта', percent: 25 },
  'stage-1': { step: 2, title: 'Анимации и заявки', percent: 50 },
  'stage-2': { step: 3, title: 'Публикация в сеть', percent: 75 },
  'stage-3': { step: 4, title: 'Монетизация & Финал', percent: 100 },
};

export function ChallengeProgressBar({
  stageId = 'stage-0',
  stageIndex,
  onBonusClick,
}: ChallengeProgressBarProps) {
  // Определяем мета-данные по stageId или по stageIndex
  let meta = STAGES_META[stageId];
  if (!meta && typeof stageIndex === 'number') {
    const keys = ['stage-0', 'stage-1', 'stage-2', 'stage-3'];
    meta = STAGES_META[keys[stageIndex] || 'stage-0'];
  }
  if (!meta) {
    meta = { step: 1, title: 'Обучение', percent: 25 };
  }

  const isCompleted = meta.percent === 100;
  const markerLabelTransform = meta.percent >= 90 ? 'translateX(-100%)' : 'translateX(-50%)';

  return (
    <aside
      aria-label="Прогресс курса"
      className="challenge-progress-bar relative z-10 w-full border-b border-white/[0.09] bg-[#0A0E13]/90 text-white shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl"
    >
      <div className="mx-auto max-w-5xl px-4 pb-3 pt-2.5 sm:px-6 sm:pb-4 sm:pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.13] bg-white/[0.07] text-[13px] font-semibold text-[#BAFF4A]">
              {isCompleted ? (
                <Trophy size={15} />
              ) : (
                meta.step
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold leading-5 text-white">
                {isCompleted ? 'Финальный урок' : `Урок ${meta.step} из 4`}
              </div>
              <div className="truncate text-[12px] leading-4 text-white/52">{meta.title}</div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[16px] font-semibold leading-5 text-white">{meta.percent}%</div>
            <div className="text-[11px] text-white/45">пройдено</div>
          </div>
        </div>

        <div className="relative mt-8 pr-11">
          <div className="relative">
            {!isCompleted && (
              <span
                className="absolute -top-[23px] whitespace-nowrap rounded-[5px] bg-[#BAFF4A] px-2 py-1 text-[10px] font-semibold leading-none text-[#101707] transition-[left] duration-500"
                style={{ left: `${meta.percent}%`, transform: markerLabelTransform }}
              >
                Вы здесь
              </span>
            )}
            <div
              className="relative h-2 rounded-full bg-white/[0.09] shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
              role="progressbar"
              aria-label={`Урок ${meta.step} из 4`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={meta.percent}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[#BAFF4A] transition-[width] duration-700"
                style={{ width: `${meta.percent}%` }}
              />
              {!isCompleted && (
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#F3FFE0] bg-[#BAFF4A] shadow-[0_0_0_5px_rgba(186,255,74,0.12),0_5px_14px_rgba(0,0,0,0.4)] transition-[left] duration-700"
                  style={{ left: `${meta.percent}%` }}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          <button
            onClick={onBonusClick}
            type="button"
            className={`group absolute right-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border transition active:scale-95 ${
              isCompleted
                ? 'border-[#BAFF4A] bg-[#BAFF4A] text-[#101707] shadow-[0_0_0_5px_rgba(186,255,74,0.13)]'
                : 'border-white/[0.16] bg-[#141920] text-[#BAFF4A] hover:border-[#BAFF4A]/45'
            }`}
            aria-label={isCompleted ? 'Открыть бонус' : 'Бонус откроется после четвёртого урока'}
          >
            <Gift size={15} strokeWidth={2.2} />
            <span
              className={`pointer-events-none absolute -top-[18px] right-0 whitespace-nowrap text-[10px] font-semibold transition-colors ${
                isCompleted ? 'text-[#BAFF4A]' : 'text-white/48 group-hover:text-white/72'
              }`}
            >
              {isCompleted ? 'Бонус открыт' : 'Бонус после 4 урока'}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
