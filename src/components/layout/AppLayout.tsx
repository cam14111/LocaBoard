import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header />

      {/* Main content: offset for sidebar on desktop, offset for bottom nav on mobile */}
      <main className="pb-(--spacing-bottom-nav) lg:pb-0 lg:pl-(--spacing-sidebar)">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
