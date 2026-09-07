import React, { useState } from 'react';
import { CreditCard, ShieldCheck, CheckCircle2, ArrowRight, XCircle } from 'lucide-react';

export default function MockPayment() {
  const params = new URLSearchParams(window.location.search);
  const offerId = params.get('offerId') || 'offer-pkg-1';
  const amount = params.get('amount') || '29';
  const currency = params.get('currency') || 'USD';
  const chatId = params.get('chatId') || '';
  const funnelId = params.get('funnelId') || '';
  const stageId = params.get('stageId') || '';
  const authTs = params.get('authTs') || '';
  const authSig = params.get('authSig') || '';

  const productName = offerId === 'offer-pkg-2' || offerId.includes('pkg-2')
    ? 'Пакет 2: «IT-Владелец: Исходный код + Продвижение»'
    : 'Пакет 1: «IT-Архитектор»';

  const [email, setEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholder, setCardholder] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    const matches = value.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(' '));
    } else {
      setCardNumber(value);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 2) {
      setExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setExpiry(value);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 3);
    setCvv(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !cardNumber || !expiry || !cvv || !cardholder) {
      setError('Пожалуйста, заполните все поля');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/payments/mock-success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          amount,
          currency,
          chatId,
          email,
          funnelId,
          stageId,
          authTs,
          authSig,
          telegramInitData: window.Telegram?.WebApp?.initData || '',
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Произошла ошибка при оплате. Попробуйте еще раз.');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.close();
    } else {
      window.close();
      alert('Оплата завершена! Вы можете закрыть эту вкладку.');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-center items-center px-4 lesson-font-body selection:bg-[#baff4a]/30 selection:text-white">
        {/* Glow effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] aspect-square rounded-full bg-[#baff4a]/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-5%] w-[50%] aspect-square rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl p-8 text-center space-y-6 shadow-2xl relative z-10 animate-scale-in">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 size={40} className="animate-bounce-gentle" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Оплата успешна!</h1>
            <p className="text-slate-400 text-sm">
              Мы получили твой платеж за <span className="text-emerald-400 font-bold">{productName}</span>.
            </p>
          </div>

          <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 space-y-2 text-left text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Сумма оплаты:</span>
              <span className="font-bold text-white">${amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Статус:</span>
              <span className="font-bold text-emerald-400">Paid (Тестовый режим)</span>
            </div>
            {chatId && (
              <div className="flex justify-between">
                <span className="text-slate-400">Telegram Chat ID:</span>
                <span className="font-mono text-slate-300">{chatId}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Инструкции и доступы уже отправлены в твой Telegram-бот.
          </p>

          <button
            onClick={handleClose}
            className="w-full py-4 bg-[#CEF563] text-[#071006] font-black text-sm uppercase tracking-wider rounded-2xl shadow-[0_0_30px_rgba(206,245,99,0.3)] hover:scale-[1.02] transition-all cursor-pointer"
          >
            Вернуться в Telegram Бот
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-center items-center px-4 py-8 lesson-font-body selection:bg-[#baff4a]/30 selection:text-white">
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] aspect-square rounded-full bg-[#baff4a]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-5%] w-[50%] aspect-square rounded-full bg-[#2563eb]/12 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-scale-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-[#baff4a]/20 rounded-full text-[10px] font-black text-[#baff4a] uppercase tracking-widest">
            <ShieldCheck size={12} className="text-[#baff4a]" />
            Безопасный 3D-Secure Мок-Эквайринг
          </div>
          <h1 className="edu-h text-3xl text-white">Оформление заказа</h1>
          <p className="text-slate-400 text-xs">{productName}</p>
        </div>

        {/* Pricing Summary Box */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Итого к оплате</p>
            <p className="text-lg text-slate-300 font-medium">Lava.top Test Mode</p>
          </div>
          <p className="text-3xl font-black text-[#baff4a]">${amount}</p>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2">
              <XCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Email получателя</label>
            <input
              type="email"
              required
              placeholder="alex@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-[#baff4a] focus:bg-white/10 rounded-xl text-sm outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Номер карты</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="4000 1234 5678 9010"
                value={cardNumber}
                onChange={handleCardNumberChange}
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 focus:border-[#baff4a] focus:bg-white/10 rounded-xl text-sm outline-none transition-all placeholder:text-slate-600 font-mono tracking-wider"
              />
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Срок действия</label>
              <input
                type="text"
                required
                placeholder="MM/YY"
                value={expiry}
                onChange={handleExpiryChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-[#baff4a] focus:bg-white/10 rounded-xl text-sm outline-none transition-all placeholder:text-slate-600 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">CVV / CVC</label>
              <input
                type="password"
                required
                placeholder="•••"
                value={cvv}
                onChange={handleCvvChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-[#baff4a] focus:bg-white/10 rounded-xl text-sm outline-none transition-all placeholder:text-slate-600 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Владелец карты</label>
            <input
              type="text"
              required
              placeholder="ALEX IVANOV"
              value={cardholder}
              onChange={(e) => setCardholder(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-[#baff4a] focus:bg-white/10 rounded-xl text-sm outline-none transition-all placeholder:text-slate-600 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 bg-[#CEF563] text-[#071006] font-black text-sm uppercase tracking-wider rounded-2xl shadow-[0_0_30px_rgba(206,245,99,0.25)] hover:scale-[1.01] hover:shadow-[0_0_34px_rgba(206,245,99,0.4)] disabled:opacity-50 disabled:scale-100 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#071006]/30 border-t-[#071006] rounded-full animate-spin" />
            ) : (
              <>
                Оплатить ${amount}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
          Оплата производится в защищенном режиме симулятора. Реальные средства списываться не будут.
        </p>
      </div>
    </div>
  );
}
