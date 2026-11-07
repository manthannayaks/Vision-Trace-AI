import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { ScanSearch, LayoutDashboard, Search, Clock } from 'lucide-react';

const navItems = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { to: '/search',  label: 'New Search', icon: Search },
  { to: '/history', label: 'History',    icon: Clock },
];

export default function MainLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center group-hover:bg-brand-500 transition-colors">
                <ScanSearch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white leading-tight">VisionTrack AI</h1>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">Person Retrieval System</p>
              </div>
            </NavLink>

            {/* Nav Links */}
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-600/15 text-brand-400'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-600">
            VisionTrack AI · Appearance-based visual matching only · Results require human verification
          </p>
        </div>
      </footer>
    </div>
  );
}

