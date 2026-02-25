import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Redirect si déjà connecté
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Email ou mot de passe incorrect');
        return;
      }

      navigate('/', { replace: true });
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-primary-600" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Calendrier Location</h1>
          <p className="mt-1 text-sm text-slate-500">Connectez-vous pour accéder à l'application</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Formulaire de connexion">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              placeholder="vous@exemple.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {searchParams.get('expired') === 'true' && !error && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700" role="status">
              Votre session a expiré. Veuillez vous reconnecter.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
