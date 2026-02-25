import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { LogementProvider } from '@/contexts/LogementContext';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2 } from 'lucide-react';

// Pages chargées en lazy pour code-splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Dossiers = lazy(() => import('@/pages/Dossiers'));
const DossierDetail = lazy(() => import('@/pages/DossierDetail'));
const EdlMobile = lazy(() => import('@/pages/EdlMobile'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const PaiementsGlobal = lazy(() => import('@/pages/PaiementsGlobal'));
const SettingsLayout = lazy(() => import('@/pages/Settings'));
const SettingsIndex = lazy(() => import('@/pages/settings/SettingsIndex'));
const Profile = lazy(() => import('@/pages/settings/Profile'));
const LogementsList = lazy(() => import('@/pages/settings/LogementsList'));
const LogementForm = lazy(() => import('@/pages/settings/LogementForm'));
const ChecklistTemplates = lazy(() => import('@/pages/settings/ChecklistTemplates'));
const AuditLogGlobal = lazy(() => import('@/pages/settings/AuditLogGlobal'));
const Utilisateurs = lazy(() => import('@/pages/settings/Utilisateurs'));
const Login = lazy(() => import('@/pages/Login'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex justify-center items-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-label="Chargement" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<LogementProvider><AppLayout /></LogementProvider>}>
                <Route index element={<Dashboard />} />
                <Route path="calendrier" element={<Calendar />} />
                <Route path="dossiers" element={<Dossiers />} />
                <Route path="dossiers/:id" element={<DossierDetail />} />
                <Route path="dossiers/:dossierId/edl/:edlId" element={<EdlMobile />} />
                <Route path="taches" element={<Tasks />} />
                <Route path="paiements" element={<PaiementsGlobal />} />
                <Route path="parametres" element={<SettingsLayout />}>
                  <Route index element={<SettingsIndex />} />
                  <Route path="logements" element={<LogementsList />} />
                  <Route path="logements/nouveau" element={<LogementForm />} />
                  <Route path="logements/:id" element={<LogementForm />} />
                  <Route path="logements/:id/checklists" element={<ChecklistTemplates />} />
                  <Route path="profil" element={<Profile />} />
                  <Route path="audit-log" element={<AuditLogGlobal />} />
                  <Route path="utilisateurs" element={<Utilisateurs />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
