import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

/**
 * Frontière d'erreur globale.
 * Évite l'écran blanc si un composant lève une erreur au rendu.
 * Cas fréquent en PWA sur GitHub Pages : après un déploiement, un client
 * en cache demande un ancien chunk lazy qui n'existe plus → on propose un
 * rechargement qui récupère la nouvelle version.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    const isChunkError = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(
      message,
    );
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Journalisation console (pas de service externe pour rester sur Supabase Free)
    console.error('Erreur non gérée capturée par ErrorBoundary:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-bold text-slate-900">
            {this.state.isChunkError ? 'Nouvelle version disponible' : 'Une erreur est survenue'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {this.state.isChunkError
              ? "L'application a été mise à jour. Rechargez la page pour continuer."
              : "Un problème inattendu s'est produit. Rechargez la page ; si le problème persiste, contactez votre administrateur."}
          </p>
          <button
            onClick={this.handleReload}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" />
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
