import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <p className="text-6xl font-bold text-slate-300">404</p>
      <p className="mt-4 text-lg text-slate-600">Page introuvable</p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        Retour au dashboard
      </Link>
    </div>
  );
}
