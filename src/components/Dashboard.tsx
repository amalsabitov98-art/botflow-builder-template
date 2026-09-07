import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Users, Zap, ArrowRight, TrendingUp, CreditCard, Activity, Bot } from 'lucide-react';

// Кумулятивный ряд за последние `days` дней из реальных событий (подписки/оплаты).
// Каждый элемент items: { time: мс, value: вклад }. Точки до окна формируют базовую линию.
const buildCumulativeSeries = (items: { time: number; value: number }[], days: number = 30) => {
  const result: { name: string; value: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(23, 59, 59, 999);
    const sum = items.reduce((acc, item) => (item.time <= d.getTime() ? acc + item.value : acc), 0);
    result.push({ name: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), value: Math.round(sum) });
  }
  return result;
};

const pluralRu = (value: number, one: string, few: string, many: string) => {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

interface DashboardProps {
  funnels: any[];
  onOpenFunnel: (id: string) => void;
  onCreateFunnel: () => void;
  onDeleteFunnel?: (id: string, e: React.MouseEvent) => void; // Optional here since we don't delete from Dashboard anymore
}

export default function Dashboard({ funnels, onOpenFunnel, onCreateFunnel }: DashboardProps) {
  const [bots, setBots] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => { if (data.bots) setBots(data.bots); })
      .catch(console.error);

    fetch('/api/subscribers')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setSubscribers(data); })
      .catch(console.error);

    fetch('/api/orders')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setOrders(data); })
      .catch(console.error);
  }, []);

  // ===== Реальные показатели =====
  const totalSubscribers = subscribers.length;
  const totalActiveSubscribers = subscribers.filter(s => s.status === 'active').length;
  const activeFunnelsCount = funnels.filter(f => f.status === 'active').length;

  const paidOrders = orders.filter(o => o.status === 'paid');
  const salesByCurrency = paidOrders.reduce<Record<string, number>>((totals, order) => {
    const currency = String(order.currency || 'RUB').toUpperCase();
    totals[currency] = (totals[currency] || 0) + (Number(order.amount) || 0);
    return totals;
  }, {});
  const primaryCurrency = Object.entries(salesByCurrency)
    .sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] || 'RUB';
  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount);
  const payingUsers = new Set(paidOrders.map(o => o.chatId ?? o.username)).size;
  const avgConversion = totalSubscribers > 0 ? (payingUsers / totalSubscribers) * 100 : 0;

  // Время "первого появления" подписчика: самое раннее событие, иначе lastActive.
  const firstSeen = (s: any): number => {
    const events = s.progress?.events || [];
    const times = events.map((e: any) => Date.parse(e.timestamp)).filter((t: number) => !isNaN(t));
    if (times.length) return Math.min(...times);
    const la = Date.parse(s.lastActive);
    return isNaN(la) ? Date.now() : la;
  };

  const dynamicSubscribersData = React.useMemo(
    () => buildCumulativeSeries(subscribers.map(s => ({ time: firstSeen(s), value: 1 }))),
    [subscribers]
  );
  const dynamicSalesData = React.useMemo(
    () => buildCumulativeSeries(paidOrders
      .filter(order => String(order.currency || 'RUB').toUpperCase() === primaryCurrency)
      .map(o => ({ time: Date.parse(o.createdAt || o.date), value: Number(o.amount) || 0 }))),
    [orders, primaryCurrency]
  );

  // Топ воронок по реальному числу подписчиков (группировка по названию воронки).
  const topFunnels = React.useMemo(() => {
    return [...funnels].map(f => {
      const subs = subscribers.filter(s => s.funnel === f.title);
      const active = subs.filter(s => s.status === 'active').length;
      const paid = paidOrders.filter(o => o.funnelId === f.id).length;
      const conv = subs.length > 0 ? Math.round((paid / subs.length) * 100) : 0;
      return { ...f, realSubscribers: subs.length, realActive: active, realConversion: conv };
    }).sort((a, b) => b.realSubscribers - a.realSubscribers).slice(0, 3);
  }, [funnels, subscribers, orders]);

  const getConnectedBotName = (botId: string) => {
    const bot = bots.find(b => b.id === botId);
    return bot ? `@${bot.name}` : 'Нет бота';
  };

  return (
    <div className="admin-page flex-1 min-w-0 overflow-y-auto bg-[#f8f8fb] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-8">

        {/* Header Section */}
        <div className="admin-page-header flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Дашборд</h1>
            <p className="text-slate-500 text-sm mt-1 cursor-default object-cover">Ключевые показатели эффективности ваших воронок.</p>
          </div>
          <button
            onClick={onCreateFunnel}
            className="flex w-full sm:w-auto items-center justify-center gap-2 whitespace-nowrap bg-indigo-600 px-5 py-3 sm:py-2.5 rounded-xl text-[13px] font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Создать воронку
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={20} />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                Всего
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Всего подписчиков</p>
              <h3 className="text-2xl font-bold text-slate-800">{totalSubscribers.toLocaleString('ru-RU')}</h3>
              <p className="text-xs text-slate-400 mt-2">{totalActiveSubscribers.toLocaleString('ru-RU')} активных</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CreditCard size={20} />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                Факт
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Сумма продаж</p>
              <div className="space-y-1">
                {Object.entries(salesByCurrency).length > 0
                  ? Object.entries(salesByCurrency).map(([currency, total]) => <h3 key={currency} className="text-xl font-bold text-slate-800">{formatCurrency(Number(total), currency)}</h3>)
                  : <h3 className="text-2xl font-bold text-slate-800">0 ₽</h3>}
              </div>
              <p className="text-xs text-slate-400 mt-2">{paidOrders.length} {pluralRu(paidOrders.length, 'оплата', 'оплаты', 'оплат')}</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Zap size={20} />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                Средняя
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Конверсия в оплату</p>
              <h3 className="text-2xl font-bold text-slate-800">{avgConversion.toFixed(1)}%</h3>
              <p className="text-xs text-slate-400 mt-2">{payingUsers} из {totalSubscribers} купили</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                <Activity size={20} />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                За 30 дней
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Активных воронок</p>
              <h3 className="text-2xl font-bold text-slate-800">{activeFunnelsCount} <span className="text-lg font-medium text-slate-400">/ {funnels.length}</span></h3>
              <p className="text-xs text-slate-400 mt-2">Запущены и собирают лиды</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Registrations Chart */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6 relative z-10 w-full">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Динамика регистраций</h2>
                <p className="text-xs text-slate-500 mt-1">Прирост подписчиков за последние 30 дней</p>
              </div>
            </div>
            <div className="h-56 w-full relative z-10 mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamicSubscribersData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSubscribers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ color: '#0f172a', fontWeight: 500 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSubscribers)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sales Chart */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6 relative z-10 w-full">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Объем продаж</h2>
                <p className="text-xs text-slate-500 mt-1">Выручка за последние 30 дней · {primaryCurrency}</p>
              </div>
            </div>
            <div className="h-56 w-full relative z-10 mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamicSalesData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ color: '#0f172a', fontWeight: 500 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Funnels List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-800">Топ воронок 🏆</h2>
            {/* The sidebar 'funnels' tab will handle showing everything, so this is just a teaser */}
            <span className="text-xs text-slate-400 font-medium">По количеству подписчиков</span>
          </div>

          <div className="divide-y divide-slate-50">
            {topFunnels.length > 0 ? topFunnels.map((funnel, index) => (
              <div
                key={funnel.id}
                onClick={() => onOpenFunnel(funnel.id)}
                className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg
                    ${index === 0 ? 'bg-amber-100 text-amber-600' :
                      index === 1 ? 'bg-slate-100 text-slate-500' :
                        index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-indigo-50 text-indigo-500'}`}
                  >
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base mb-1 group-hover:text-indigo-600 transition-colors">{funnel.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Bot size={12} className="text-slate-400" />
                        {getConnectedBotName(funnel.connectedBotId)}
                      </span>
                      <span>•</span>
                      <span className={funnel.status === 'active' ? 'text-emerald-500 font-medium flex items-center gap-1' : ''}>
                        {funnel.status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                        {funnel.status === 'active' ? 'Запущена' : 'Черновик'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 sm:gap-12 pl-16 sm:pl-0">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 mb-1">Аудитория</span>
                    <span className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                      {funnel.realSubscribers || 0}
                      {funnel.realActive > 0 && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-medium">
                          {funnel.realActive} акт.
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 mb-1">Конверсия</span>
                    <span className="font-bold text-emerald-600 text-base">{funnel.realConversion || 0}%</span>
                  </div>
                  <div className="hidden md:flex text-slate-300 group-hover:text-indigo-400 transition-colors">
                    <ArrowRight size={20} />
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-500">
                <p>У вас пока нет созданных воронок.</p>
                <button
                  onClick={onCreateFunnel}
                  className="mt-4 text-indigo-600 font-medium hover:text-indigo-700 hover:underline"
                >
                  Создать первую воронку
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
