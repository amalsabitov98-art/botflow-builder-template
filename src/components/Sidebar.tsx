import React, { useEffect, useState } from 'react';
import { Route, Users, ShoppingCart, Settings, LogOut, LayoutDashboard, Hexagon, ChevronLeft, ChevronRight, Plus, BarChart3, MonitorSmartphone, Menu, X, Images, Megaphone, GraduationCap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type TabType = 'dashboard' | 'analytics' | 'funnels' | 'flow' | 'platform' | 'sites' | 'gallery' | 'audience' | 'broadcasts' | 'sales' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { signOut, user } = useAuth();

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--botflow-sidebar-width',
      isExpanded ? '15rem' : '5rem',
    );

    return () => {
      document.documentElement.style.removeProperty('--botflow-sidebar-width');
    };
  }, [isExpanded]);

  const navItem = (tab: TabType, icon: React.ReactNode, title: string) => (
    <button
      onClick={() => {
        setActiveTab(tab);
        setIsMobileOpen(false);
      }}
      className={`h-10 rounded-xl flex items-center transition-all ${isExpanded ? 'px-3 w-full justify-start' : 'w-10 justify-center mx-auto'} max-sm:w-full max-sm:justify-start max-sm:px-3 ${activeTab === tab
        ? 'bg-indigo-50 text-indigo-600 font-medium'
        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-medium'
        }`}
      title={!isExpanded ? title : undefined}
    >
      <div className="shrink-0">{icon}</div>
      {(isExpanded || isMobileOpen) && <span className="ml-3 truncate text-sm">{title}</span>}
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed bottom-4 left-4 z-40 hidden h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.28)] max-sm:flex"
        aria-label="Открыть меню"
      >
        <Menu size={21} />
      </button>

      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 hidden bg-slate-950/35 backdrop-blur-[2px] max-sm:block"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Закрыть меню"
        />
      )}

      <aside className={`${isExpanded ? 'w-60' : 'w-20'} bg-white border-r border-slate-200 flex flex-col h-full py-5 z-50 relative shrink-0 transition-all duration-300 max-sm:fixed max-sm:inset-y-0 max-sm:left-0 max-sm:w-[min(82vw,300px)] max-sm:shadow-2xl ${isMobileOpen ? 'max-sm:translate-x-0' : 'max-sm:-translate-x-full'}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-7 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-full w-6 h-6 flex items-center justify-center shadow-sm z-40 transition-colors max-sm:hidden"
      >
        {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Logo */}
      <div className={`flex items-center mb-6 px-4 ${!isExpanded && 'justify-center max-sm:justify-start'}`}>
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold shrink-0">
          <Hexagon size={18} className="fill-white text-white" />
        </div>
        {(isExpanded || isMobileOpen) && <span className="ml-3 font-bold text-lg tracking-tight text-slate-900">BotFlow</span>}
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="ml-auto hidden h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 max-sm:flex"
          aria-label="Закрыть меню"
        >
          <X size={18} />
        </button>
      </div>

      {/* Quick Create Action */}
      <div className="px-4 mb-6">
        <button
          onClick={() => {
            setActiveTab('funnels');
            setIsMobileOpen(false);
          }}
          className={`bg-indigo-400 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition-all shadow-sm ${isExpanded ? 'px-4 h-10 w-full justify-start' : 'w-12 h-12 mx-auto rounded-xl'
            }`}
          title={!isExpanded ? 'Мои воронки' : undefined}
        >
          <Plus size={isExpanded ? 18 : 22} className="shrink-0" />
          {(isExpanded || isMobileOpen) && <span className="ml-2 font-medium text-sm">Мои воронки</span>}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex flex-col gap-1 w-full px-4 flex-1">
        <p className={`text-[10px] uppercase font-bold text-slate-400 mb-2 mt-2 ${!isExpanded && 'text-center'}`}>
          <span>{isExpanded || isMobileOpen ? 'Аналитика' : '–––'}</span>
        </p>
        {navItem('dashboard', <LayoutDashboard size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />, 'Дашборд')}
        {navItem('analytics', <BarChart3 size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />, 'Аналитика этапов')}

        <p className={`text-[10px] uppercase font-bold text-slate-400 mb-2 mt-4 ${!isExpanded && 'text-center'}`}>
          <span>{isExpanded || isMobileOpen ? 'Инструменты' : '–––'}</span>
        </p>
        {navItem('funnels', <Route size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'funnels' ? 2.5 : 2} />, 'Мои воронки')}
        {navItem('platform', <GraduationCap size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'platform' ? 2.5 : 2} />, 'Платформа')}
        {navItem('sites', <MonitorSmartphone size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'sites' ? 2.5 : 2} />, 'Сайты')}
        {navItem('gallery', <Images size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'gallery' ? 2.5 : 2} />, 'Галерея')}

        {navItem('audience', <Users size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'audience' ? 2.5 : 2} />, 'Контакты')}
        {navItem('broadcasts', <Megaphone size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'broadcasts' ? 2.5 : 2} />, 'Рассылки')}
        {navItem('sales', <ShoppingCart size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'sales' ? 2.5 : 2} />, 'Продажи')}
      </div>

      {/* Footer Navigation */}
      <div className="flex flex-col gap-1 w-full px-4 mt-auto">
        {navItem('settings', <Settings size={isExpanded ? 18 : 20} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />, 'Настройки')}

        <div className="h-px bg-slate-100 my-2 mx-2"></div>

        <button
          onClick={() => signOut()}
          className={`h-10 rounded-xl flex items-center transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50 ${isExpanded ? 'px-3 w-full justify-start' : 'w-10 justify-center mx-auto'} max-sm:w-full max-sm:justify-start max-sm:px-3`}
          title={!isExpanded ? 'Выход' : undefined}
        >
          <div className="shrink-0"><LogOut size={isExpanded ? 18 : 20} strokeWidth={2} /></div>
          {(isExpanded || isMobileOpen) && <span className="ml-3 font-medium text-sm">Выход</span>}
        </button>
      </div>
      </aside>
    </>
  );
}
