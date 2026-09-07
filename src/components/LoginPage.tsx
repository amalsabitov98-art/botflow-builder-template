import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Eye, EyeOff, LogIn, Loader2, LockKeyhole } from 'lucide-react';

const LOGIN_ATTEMPTS_KEY = 'botflow-admin-login-attempts';
const LOGIN_LOCK_KEY = 'botflow-admin-login-lock-until';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(() => {
    const lockUntil = Number(sessionStorage.getItem(LOGIN_LOCK_KEY) || 0);
    return Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
  });

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      const lockUntil = Number(sessionStorage.getItem(LOGIN_LOCK_KEY) || 0);
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockSeconds(remaining);
      if (remaining === 0) {
        sessionStorage.removeItem(LOGIN_LOCK_KEY);
        sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds > 0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (lockSeconds > 0) {
      setError(`Слишком много попыток. Повторите через ${lockSeconds} сек.`);
      return;
    }
    setLoading(true);

    if (!email || !password) {
      setError('Заполните все поля');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      setLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      const attempts = Number(sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) || 0) + 1;
      sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, String(attempts));
      if (attempts >= 5) {
        const lockUntil = Date.now() + 60_000;
        sessionStorage.setItem(LOGIN_LOCK_KEY, String(lockUntil));
        setLockSeconds(60);
      }
      setError(translateError(error));
    } else {
      sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);
      sessionStorage.removeItem(LOGIN_LOCK_KEY);
    }

    setLoading(false);
  };

  const translateError = (error: string): string => {
    if (error.includes('Invalid login credentials')) return 'Неверный email или пароль';
    if (error.includes('Email not confirmed')) return 'Подтвердите email (проверьте почту)';
    if (error.includes('Admin access is restricted')) return 'Доступ разрешён только владельцу админки';
    if (error.includes('Регистрация закрыта')) return 'Регистрация закрыта';
    if (error.includes('rate limit')) return 'Слишком много попыток, подождите';
    if (error.includes('Password should be')) return 'Пароль должен быть не менее 6 символов';
    return error;
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f7f5] px-4 py-8 text-[#191919]"
    >
      <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#f4e4dd]/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-52 -left-40 h-96 w-96 rounded-full bg-white blur-3xl" />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4e4dd]">
            <Bot className="h-7 w-7 text-[#cf7656]" strokeWidth={1.8} />
          </div>
          <h1 className="mb-1 text-[24px] font-semibold tracking-[-0.025em] text-[#191919]">
            BotFlow Builder
          </h1>
          <p className="text-[14px] font-normal text-[#7d7d7d]">
            Конструктор воронок для Telegram
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[22px] border border-[#e5e3df] bg-white px-5 py-6 sm:px-8 sm:py-7 shadow-[0_12px_42px_rgba(41,33,27,0.07)]">
          <h2 className="mb-2 text-[22px] font-semibold tracking-[-0.025em] text-[#191919]">
            Войти в аккаунт
          </h2>
          <p className="mb-6 flex items-center gap-2 text-[13px] font-normal text-[#7d7d7d]">
            <LockKeyhole className="h-4 w-4 text-[#cf7656]" strokeWidth={1.8} />
            Доступ открыт только владельцу проекта
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="mb-2 block text-[13px] font-medium text-[#404040]">
                Электронная почта
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-14 w-full rounded-xl border border-[#dbd9d5] bg-white px-4 text-[15px] font-normal text-[#191919] outline-none transition placeholder:text-[#aaa7a3] focus:border-[#cf7656] focus:ring-4 focus:ring-[#f4e4dd]"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-[13px] font-medium text-[#404040]">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 w-full rounded-xl border border-[#dbd9d5] bg-white px-4 pr-12 text-[15px] font-normal text-[#191919] outline-none transition placeholder:text-[#aaa7a3] focus:border-[#cf7656] focus:ring-4 focus:ring-[#f4e4dd]"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#8a8a8a] transition-colors hover:bg-[#f5f4f2] hover:text-[#404040]"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-[#f5c2bd] bg-[#fff4f2] px-4 py-3 text-[13px] font-normal text-[#b42318]">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || lockSeconds > 0}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {lockSeconds > 0 ? `Повторить через ${lockSeconds} сек.` : 'Войти'}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] font-normal text-[#9b9996]">
          Защищённый вход в панель управления
        </p>
      </div>
    </div>
  );
}
