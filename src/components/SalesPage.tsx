import React, { useState, useEffect } from 'react';
import { ShoppingCart, DollarSign, CreditCard, Package, Search, Download, MoreHorizontal, CheckCircle2, Clock, XCircle } from 'lucide-react';


export default function SalesPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // Fetch orders from server
    useEffect(() => {
        fetch('/api/orders')
            .then(async r => {
                const data = await r.json().catch(() => null);
                if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
                return data;
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setOrders(data);
                }
            })
            .catch((error) => setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить продажи'))
            .finally(() => setLoading(false));
    }, []);

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.product.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const now = new Date();
    const paidThisMonth = orders.filter(o => {
        if (o.status !== 'paid') return false;
        const timestamp = Date.parse(o.createdAt || o.date || '');
        if (!Number.isFinite(timestamp)) return false;
        const date = new Date(timestamp);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const revenueByCurrency = paidThisMonth.reduce<Record<string, number>>((totals, order) => {
        const currency = String(order.currency || 'RUB').toUpperCase();
        totals[currency] = (totals[currency] || 0) + (Number(order.amount) || 0);
        return totals;
    }, {});
    const totalOrders = orders.length;
    const successfulOrders = orders.filter(o => o.status === 'paid').length;
    const averageByCurrency = Object.fromEntries(Object.entries(revenueByCurrency).map(([currency, total]) => {
        const count = paidThisMonth.filter(order => String(order.currency || 'RUB').toUpperCase() === currency).length;
        return [currency, count > 0 ? Math.round(Number(total) / count) : 0];
    })) as Record<string, number>;
    const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat('ru-RU', {
        style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount);

    const handleExport = () => {
        if (filteredOrders.length === 0) return;
        const headers = ['Заказ', 'Клиент', 'Username', 'Продукт', 'Сумма', 'Статус', 'Дата', 'Бот'];
        const rows = filteredOrders.map(o => [
            o.id, `"${o.customer}"`, o.username, `"${o.product}"`,
            o.amount, o.status === 'paid' ? 'Оплачен' : o.status === 'pending' ? 'Ожидание' : 'Возврат',
            `"${o.date}"`, o.bot
        ]);
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + headers.join(',') + '\n'
            + rows.map(r => r.join(',')).join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="admin-page flex-1 min-w-0 overflow-y-auto bg-[#f8f8fb] p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-5 sm:space-y-8">
                {/* Header Section */}
                <div className="admin-page-header flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Продажи</h1>
                        <p className="text-slate-500 text-sm mt-1 cursor-default">Управление транзакциями и статистика по всем воронкам.</p>
                    </div>
                    <div className="flex w-full gap-3 sm:w-auto">
                        <button
                            onClick={handleExport}
                            className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-3 sm:py-2.5 text-[13px] font-medium text-slate-600 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors shadow-sm"
                        >
                            <Download size={16} />
                            Экспорт CSV
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                <DollarSign size={20} />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                Итого
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Выручка ({new Date().toLocaleDateString('ru-RU', { month: 'long' }).replace(/^./, c => c.toUpperCase())})</p>
                            <div className="space-y-1">
                                {Object.entries(revenueByCurrency).length > 0
                                    ? Object.entries(revenueByCurrency).map(([currency, total]) => <h3 key={currency} className="text-xl font-bold text-slate-800">{formatCurrency(Number(total), currency)}</h3>)
                                    : <h3 className="text-2xl font-bold text-slate-800">0 ₽</h3>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <Package size={20} />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                Всего
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Всего заказов</p>
                            <h3 className="text-2xl font-bold text-slate-800">{totalOrders}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <CreditCard size={20} />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                Средний
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Средний чек месяца</p>
                            <div className="space-y-1">
                                {Object.entries(averageByCurrency).length > 0
                                    ? Object.entries(averageByCurrency).map(([currency, average]) => <h3 key={currency} className="text-xl font-bold text-slate-800">{formatCurrency(average, currency)}</h3>)
                                    : <h3 className="text-2xl font-bold text-slate-800">0 ₽</h3>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                                <ShoppingCart size={20} />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                Успешно
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Успешных оплат</p>
                            <h3 className="text-2xl font-bold text-slate-800">{successfulOrders} <span className="text-lg font-medium text-slate-400">/ {totalOrders}</span></h3>
                        </div>
                    </div>
                </div>

                {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Поиск по номеру, имени или продукту..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl text-[14px] transition-all outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-colors ${statusFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Все
                        </button>
                        <button
                            onClick={() => setStatusFilter('paid')}
                            className={`px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-colors ${statusFilter === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Оплачены
                        </button>
                        <button
                            onClick={() => setStatusFilter('pending')}
                            className={`px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-colors ${statusFilter === 'pending' ? 'bg-amber-50 text-amber-600' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Ожидание
                        </button>
                        <button
                            onClick={() => setStatusFilter('refund')}
                            className={`px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-colors ${statusFilter === 'refund' ? 'bg-rose-50 text-rose-600' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Возвраты
                        </button>
                    </div>
                </div>

                {/* Orders Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="px-6 py-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Заказ & Дата</th>
                                    <th className="px-6 py-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Клиент</th>
                                    <th className="px-6 py-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Продукт</th>
                                    <th className="px-6 py-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Сумма</th>
                                    <th className="px-6 py-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
                                    <th className="px-6 py-4 text-[12px] font-semibold text-slate-500 uppercase tracking-wider text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredOrders.length > 0 ? (
                                    filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-mono text-[13px] font-medium text-slate-700">{order.id}</div>
                                                <div className="text-[12px] text-slate-400 mt-0.5">{order.date}</div>
                                            </td>
                                            <td className="px-6 py-4 flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                                                    {order.customer.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-[14px] font-medium text-slate-800">{order.customer}</div>
                                                    <div className="text-[12px] text-slate-400">{order.username}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-[14px] font-medium text-slate-800">{order.product}</div>
                                                <div className="text-[12px] text-slate-400 mt-0.5">через {order.bot}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-slate-800">{formatCurrency(Number(order.amount) || 0, String(order.currency || 'RUB').toUpperCase())}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {order.status === 'paid' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-emerald-50 text-emerald-600">
                                                        <CheckCircle2 size={14} /> Оплачен
                                                    </span>
                                                )}
                                                {order.status === 'pending' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-amber-50 text-amber-600">
                                                        <Clock size={14} /> Ожидание
                                                    </span>
                                                )}
                                                {order.status === 'refund' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-rose-50 text-rose-600">
                                                        <XCircle size={14} /> Возврат
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            {loading ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                                    <span>Загрузка...</span>
                                                </div>
                                            ) : orders.length === 0 ? (
                                                <>
                                                    <p className="text-[15px] font-medium">Заказов пока нет</p>
                                                    <p className="text-[13px] text-slate-400 mt-1">Заказы появятся после первой оплаты через Lava.top</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-[15px] font-medium">Заказы не найдены</p>
                                                    <p className="text-[13px] text-slate-400 mt-1">Попробуйте изменить параметры поиска или фильтры</p>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
