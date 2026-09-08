'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import { AuthHeader } from '@/components/AuthHeader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SessionErrorBanner } from '@/components/SessionErrorBanner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/home');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="auth-container">
        <ThemeToggle />
        <div className="auth-card">
          <div className="loading-container" role="status">
            <div className="loading-spinner" aria-hidden="true"></div>
            <p>Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/home');
    }
  };

  return (
    <div className="auth-container">
      <ThemeToggle />
      <div className="auth-card animate-fade-in">
        <AuthHeader
          showBackHome
          title="Connexion"
          subtitle="Accédez à votre liste de courses"
        />
        
        {error && <ErrorBanner message={error} />}

        <Suspense fallback={null}>
          <SessionErrorBanner />
        </Suspense>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary auth-submit"
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                Connexion...
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <p className="auth-footer">
          Pas encore de compte ?{' '}
          <Link href="/signup">S&apos;inscrire</Link>
        </p>
      </div>
    </div>
  );
}
