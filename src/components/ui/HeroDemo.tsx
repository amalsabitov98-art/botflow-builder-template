import React from 'react';
import Hero from '@/components/ui/animated-shader-hero';

// Demo Component showing how to use the Hero
const HeroDemo: React.FC = () => {
  const handlePrimaryClick = () => {
    window.location.href = '/platform?preview=1';
  };

  const handleSecondaryClick = () => {
    window.location.href = '/?stage=stage-0&preview=1';
  };

  return (
    <div className="w-full min-h-screen bg-[#07070c] text-white">
      <Hero
        trustBadge={{
          text: "Платформа автоматизации воронки и IT-сервисов ✨",
          icons: ["🚀", "✨"]
        }}
        headline={{
          line1: "Твой IT-бизнес на автопилоте:",
          line2: "От идеи до первых $2000+"
        }}
        subtitle="Запускай связки с ИИ-продавцами в Telegram, автоматизируй воронки и управляй продажами нового поколения — быстрее, стабильнее и без ограничений."
        buttons={{
          primary: {
            text: "Открыть платформу курса",
            onClick: handlePrimaryClick
          },
          secondary: {
            text: "Смотреть воронку",
            onClick: handleSecondaryClick
          }
        }}
      />
      
      {/* Дополнительный блок под Hero */}
      <div className="bg-[#0e0f15] border-t border-white/10 p-8 sm:p-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-['Outfit',sans-serif] font-bold text-white">
              Как использовать компонент Animated Shader Hero
            </h2>
            <a
              href="/platform?preview=1"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
            >
              ← Назад в платформу
            </a>
          </div>

          <div className="bg-black/60 border border-white/10 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
            <pre className="text-xs sm:text-sm font-mono text-purple-200/80 overflow-x-auto">
{`<Hero
  trustBadge={{
    text: "Trusted by forward-thinking teams.",
    icons: ["🚀", "⭐", "✨"]
  }}
  headline={{
    line1: "Launch Your",
    line2: "Workflow Into Orbit"
  }}
  subtitle="Supercharge productivity with AI-powered automation..."
  buttons={{
    primary: {
      text: "Primary CTA",
      onClick: handlePrimaryClick
    },
    secondary: {
      text: "Secondary CTA", 
      onClick: handleSecondaryClick
    }
  }}
/>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroDemo;
