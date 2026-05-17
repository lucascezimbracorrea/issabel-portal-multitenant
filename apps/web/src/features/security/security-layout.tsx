import { Outlet } from '@tanstack/react-router';
import { SecuritySubNav } from './security-subnav';

export function SecurityLayout() {
  return (
    <div className="space-y-2">
      <SecuritySubNav />
      <Outlet />
    </div>
  );
}
