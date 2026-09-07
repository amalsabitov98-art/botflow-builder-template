import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
  value: string;
  title?: string;
  className?: string;
}

// Ссылку из админки обычно нужно куда-то отправить, а не прочитать: без
// кнопки её выделяли мышью из инпута и половину раза копировали не целиком.
export default function CopyButton({ value, title = 'Скопировать', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Буфер недоступен (нет https или отказ в правах) — тогда хотя бы
      // выделим текст, чтобы копирование осталось в один шаг.
      const input = document.createElement('input');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      setCopied(true);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      title={value ? title : 'Нечего копировать'}
      aria-label={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 ${className}`}
    >
      {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
    </button>
  );
}
