import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { GraduationCap, User, LogOut, ChevronDown, BookOpen } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const MAIN_SITE = import.meta.env.VITE_MAIN_SITE_URL || "https://aziral.com";

// Pages with their own full-screen top bars
const HIDDEN_ROUTES = ["/learn", "/build"];

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Don't render on full-screen pages that have their own nav
  if (HIDDEN_ROUTES.some(r => location.pathname.includes(r))) return null;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setDropdownOpen(false); }, [location.pathname]);

  const navLinks = [
    { label: "Каталог", href: "/" },
    { label: "Инструкторам", href: "/instructor" },
  ];

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const handleLogin = () => {
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `${MAIN_SITE}/login?redirect=${returnTo}`;
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#F5F3EE]/95 backdrop-blur-md border-b border-[#E8E5DF]">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 lg:px-8">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-[#0047FF] rounded-xl flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#0A0A0A] font-semibold text-[15px] tracking-tight">
            AZIRAL <span className="text-[#0047FF]">Learn</span>
          </span>
        </Link>

        {/* Nav links (desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              to={link.href}
              className={`px-3.5 py-2 rounded-xl text-sm transition-colors ${
                isActive(link.href)
                  ? "bg-[#0047FF]/10 text-[#0047FF] font-medium"
                  : "text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#EDEAE4]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href={MAIN_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-sm text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#EDEAE4] transition-colors"
          >
            aziral.com ↗
          </a>
        </nav>

        {/* Right: auth */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#EDEAE4] transition-colors"
              >
                <div className="w-7 h-7 bg-[#0047FF] rounded-lg flex items-center justify-center text-white text-xs font-bold">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span className="hidden sm:block text-[#0A0A0A] text-sm max-w-[120px] truncate">{user.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#6B6B6B] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl shadow-lg shadow-black/10 overflow-hidden py-1">
                  <div className="px-3 py-2 border-b border-[#E8E5DF]">
                    <p className="text-[#0A0A0A] text-sm font-medium truncate">{user.name}</p>
                    <p className="text-[#8A8A8A] text-xs truncate">{user.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#3A3A3A] hover:bg-[#EDEAE4] transition-colors"
                  >
                    <User className="w-4 h-4 text-[#6B6B6B]" /> Мой профиль
                  </Link>
                  {(user.role === "instructor" || user.role === "admin") && (
                    <Link
                      to="/instructor"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#3A3A3A] hover:bg-[#EDEAE4] transition-colors"
                    >
                      <GraduationCap className="w-4 h-4 text-[#6B6B6B]" /> Кабинет инструктора
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-[#0047FF] text-white rounded-xl text-sm font-medium hover:bg-[#0038CC] transition-colors"
            >
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
