import React, { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

const FlowBuilder = lazy(() => import('./FlowBuilder'));
const LoginPage = lazy(() => import('./LoginPage'));
const MfaGate = lazy(() => import('./MfaGate'));

function AdminLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f23' }}>
      <div className="w-10 h-10 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}

function AdminGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return <AdminLoader />;
  }

  return (
    <Suspense fallback={<AdminLoader />}>
      {user ? (
        <MfaGate>
          <FlowBuilder />
        </MfaGate>
      ) : <LoginPage />}
    </Suspense>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminGate />
    </AuthProvider>
  );
}
