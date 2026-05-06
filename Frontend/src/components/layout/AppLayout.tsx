import { Outlet } from 'react-router-dom';

import SiteHeader from './SiteHeader';

function AppLayout() {
  return (
    <div className="site-shell-with-nav min-h-screen bg-[#f5f5f5] text-black">
      <SiteHeader />
      <main className="site-shell-main site-main-shell mx-auto max-w-7xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
