import { Outlet } from '@tanstack/react-router';
import { CallsSubNav } from './calls-subnav';

export function CallsLayout() {
  return (
    <div className="space-y-2">
      <CallsSubNav />
      <Outlet />
    </div>
  );
}
