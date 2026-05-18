import { Outlet } from 'react-router-dom';

import SiteHeader from './SiteHeader';

function AppLayout() {
  return (
    <div className="site-shell-with-nav min-h-screen bg-[#FAFAFA] text-black">
      <SiteHeader />
      <main className="site-shell-main site-main-shell mx-auto max-w-[1160px] px-5 py-10 md:px-7">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
