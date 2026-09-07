import React from 'react';

export default function PageLoader({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: dark ? '#0f0f23' : '#ffffff' }}
    >
      <div className={`w-10 h-10 border-4 ${dark ? 'border-slate-700 border-t-indigo-500' : 'border-slate-200 border-t-indigo-500'} rounded-full animate-spin`} />
    </div>
  );
}
