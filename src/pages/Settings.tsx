import { Outlet } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsLayout() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="h-6 w-6 text-primary-600" />
        <h1 className="text-xl font-semibold">Paramètres</h1>
      </div>
      <Outlet />
    </div>
  );
}
