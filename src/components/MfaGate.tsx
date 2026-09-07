import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { EXPLICIT_DEV_AUTH_BYPASS, useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '../lib/supabase';

type GateMode = 'loading' | 'enroll' | 'challenge' | 'ready' | 'error';

export default function MfaGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const started = useRef(false);
  const [mode, setMode] = useState<GateMode>(EXPLICIT_DEV_AUTH_BYPASS ? 'ready' : 'loading');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const prepareMfa = async () => {
    setError('');
    setMode('loading');

    const { data: assurance, error: assuranceError } = await supabaseClient.auth.mfa
      .getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance?.currentLevel === 'aal2') {
      setMode('ready');
      return;
    }

    const { data: factors, error: factorsError } = await supabaseClient.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    const verified = factors.totp.find((factor) => factor.status === 'verified');
    if (verified) {
      setFactorId(verified.id);
      setMode('challenge');
      return;
    }

    for (const unverified of factors.totp.filter((factor) => factor.status !== 'verified')) {
      await supabaseClient.auth.mfa.unenroll({ factorId: unverified.id });
    }

    const { data: enrollment, error: enrollmentError } = await supabaseClient.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'BotFlow Admin',
    });
    if (enrollmentError) throw enrollmentError;

    setFactorId(enrollment.id);
    setQrCode(enrollment.totp.qr_code);
    setSecret(enrollment.totp.secret);
    setMode('enroll');
  };

  useEffect(() => {
    if (started.current || EXPLICIT_DEV_AUTH_BYPASS) return;
    started.current = true;
    prepareMfa().catch((cause: any) => {
      setError(cause?.message || 'Не удалось проверить двухфакторную защиту');
      setMode('error');
    });
  }, []);

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Введите 6 цифр из приложения-аутентификатора');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { data: challenge, error: challengeError } = await supabaseClient.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabaseClient.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;

      await supabaseClient.auth.refreshSession();
      const { data: assurance, error: assuranceError } = await supabaseClient.auth.mfa
        .getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== 'aal2') {
        throw assuranceError || new Error('Сессия не получила уровень защиты aal2');
      }

      setCode('');
      setQrCode('');
      setSecret('');
      setMode('ready');
    } catch (cause: any) {
      setError(cause?.message || 'Неверный или просроченный код');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'ready') return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7f5] px-4 py-8 text-[#191919]">
      <div className="w-full max-w-[440px] rounded-[22px] border border-[#e5e3df] bg-white p-6 shadow-[0_12px_42px_rgba(41,33,27,0.07)] sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4e4dd]">
          <ShieldCheck className="h-6 w-6 text-[#cf7656]" strokeWidth={1.8} />
        </div>

        <h1 className="text-[22px] font-semibold tracking-[-0.025em]">
          Двухфакторная защита
        </h1>

        {mode === 'loading' && (
          <div className="mt-6 flex items-center gap-3 text-[14px] text-[#6f6f6f]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Проверяем защищённость сессии…
          </div>
        )}

        {mode === 'enroll' && (
          <>
            <p className="mt-2 text-[14px] leading-6 text-[#6f6f6f]">
              Отсканируйте QR-код в Google Authenticator, 1Password или другом TOTP-приложении.
            </p>
            <div className="my-5 flex justify-center rounded-2xl border border-[#e5e3df] bg-white p-4">
              <img className="h-52 w-52" src={qrCode} alt="QR-код для подключения TOTP" />
            </div>
            <details className="mb-5 rounded-xl bg-[#f8f7f5] px-4 py-3 text-[12px] text-[#6f6f6f]">
              <summary className="cursor-pointer font-medium text-[#404040]">Ввести ключ вручную</summary>
              <code className="mt-2 block break-all select-all">{secret}</code>
            </details>
          </>
        )}

        {mode === 'challenge' && (
          <p className="mt-2 text-[14px] leading-6 text-[#6f6f6f]">
            Введите одноразовый код из приложения-аутентификатора, чтобы открыть CRM.
          </p>
        )}

        {(mode === 'enroll' || mode === 'challenge') && (
          <form onSubmit={verifyCode} className="mt-5">
            <label className="mb-2 block text-[13px] font-medium text-[#404040]">
              Одноразовый код
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#aaa7a3]" />
              <input
                autoComplete="one-time-code"
                autoFocus
                className="h-14 w-full rounded-xl border border-[#dbd9d5] pl-12 pr-4 text-center text-[20px] tracking-[0.35em] outline-none focus:border-[#cf7656] focus:ring-4 focus:ring-[#f4e4dd]"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                value={code}
              />
            </div>
            {error && (
              <div className="mt-3 rounded-xl border border-[#f5c2bd] bg-[#fff4f2] px-4 py-3 text-[13px] text-[#b42318]">
                {error}
              </div>
            )}
            <button
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] text-[15px] font-medium text-white disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              Подтвердить и открыть CRM
            </button>
          </form>
        )}

        {mode === 'error' && (
          <>
            <div className="mt-5 rounded-xl border border-[#f5c2bd] bg-[#fff4f2] px-4 py-3 text-[13px] leading-5 text-[#b42318]">
              {error}. Для локальной разработки укажите отдельные `VITE_DEV_SUPABASE_URL` и `VITE_DEV_SUPABASE_ANON_KEY`.
            </div>
            <button
              className="mt-4 h-12 w-full rounded-xl border border-[#dbd9d5] text-[14px] font-medium"
              onClick={() => prepareMfa().catch((cause: any) => {
                setError(cause?.message || 'Не удалось проверить MFA');
                setMode('error');
              })}
              type="button"
            >
              Повторить
            </button>
          </>
        )}

        <button
          className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-[13px] text-[#7d7d7d]"
          onClick={() => void signOut()}
          type="button"
        >
          <LogOut className="h-4 w-4" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
