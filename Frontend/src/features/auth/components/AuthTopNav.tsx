import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../../constants/routes';

function AuthTopNav() {
  return (
    <header className="flex items-center justify-between border-b border-black/8 pb-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center bg-black text-white">
          <Shield className="h-7 w-7" />
        </div>
        <span className="text-2xl font-black tracking-[-0.03em] text-black">SSAFER.io</span>
      </div>

      <nav className="flex items-center gap-10 text-[1.05rem] font-semibold text-black">
        <Link to={ROUTES.root}>MAIN</Link>
        <span>Guest</span>
      </nav>
    </header>
  );
}

export default AuthTopNav;
