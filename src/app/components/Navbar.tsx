import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  GraduationCap, User, LogOut, ChevronDown, BookOpen,
  Menu, X, ClipboardList, ExternalLink,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

const MAIN_SITE = import.meta.env.VITE_MAIN_SITE_URL || "https://aziral.com";

// Pages with their own full-screen top bars
const HIDDEN_ROUTES = ["/learn", "/build", "/instructor/tests"];

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setDropdownOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Don't render on full-screen pages that have their own nav
  if (HIDDEN_ROUTES.some(r => location.pathname.includes(r))) return null;

  const navLinks = [
    { label: "Каталог",         href: "/",          icon: BookOpen,       desc: "Курсы и обучение" },
    { label: "Создание тестов", href: "/study",     icon: ClipboardList,  desc: "Все доступные тесты" },
    { label: "Инструкторам",    href: "/instructor", icon: GraduationCap,  desc: "Создавайте курсы и тесты" },
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
    <header className="fixed top-0 left-0 right-0 z-50 h-[64px] sm:h-[72px] bg-[#F5F3EE]/95 backdrop-blur-md border-b border-[#E8E5DF]">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 lg:px-8 gap-2">

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
            className="px-3.5 py-2 rounded-xl text-sm text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#EDEAE4] transition-colors inline-flex items-center gap-1"
          >
            aziral.com <ExternalLink className="w-3 h-3" />
          </a>
        </nav>

        {/* Right: language + auth + mobile menu button */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Language switcher (desktop only — на mobile вынесен в sheet) */}
          <div className="hidden md:block">
            <LanguageSwitcher variant="icon" />
          </div>

          {/* Auth */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-[#EDEAE4] transition-colors"
                aria-label="Меню профиля"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                  {user.avatar
                    ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-[#0047FF] flex items-center justify-center text-white text-xs font-bold">{user.name?.[0]?.toUpperCase()}</div>
                  }
                </div>
                <span className="hidden md:block text-[#0A0A0A] text-sm max-w-[120px] truncate">{user.name}</span>
                <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-[#6B6B6B] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-[#E8E5DF] rounded-2xl shadow-lg shadow-black/10 overflow-hidden py-1">
                  <div className="px-3 py-2.5 border-b border-[#F0EEE9] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
                      {user.avatar
                        ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-[#0047FF] flex items-center justify-center text-white text-sm font-bold">{user.name?.[0]?.toUpperCase()}</div>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#0A0A0A] text-sm font-medium truncate">{user.name}</p>
                      {user.username
                        ? <p className="text-[#0047FF] text-xs truncate">@{user.username}</p>
                        : <p className="text-[#8A8A8A] text-xs truncate">{user.email}</p>
                      }
                    </div>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#3A3A3A] hover:bg-[#F5F3EE] transition-colors"
                  >
                    <User className="w-4 h-4 text-[#6B6B6B]" /> Мой профиль
                  </Link>
                  <Link
                    to="/instructor"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#3A3A3A] hover:bg-[#F5F3EE] transition-colors"
                  >
                    <GraduationCap className="w-4 h-4 text-[#6B6B6B]" />
                    {user.role === "instructor" || user.role === "admin" ? "Кабинет инструктора" : "Мои тесты"}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-[#F0EEE9] mt-1"
                  >
                    <LogOut className="w-4 h-4" /> Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="px-3 sm:px-4 py-2 bg-[#0047FF] text-white rounded-xl text-sm font-medium hover:bg-[#0038CC] transition-colors shadow-sm shadow-[#0047FF]/20"
            >
              Войти
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden p-2 rounded-xl hover:bg-[#EDEAE4] transition-colors text-[#3A3A3A]"
            aria-label="Меню"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu sheet */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 top-[64px] bg-black/30 backdrop-blur-sm z-40 animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sheet */}
          <div
            ref={mobileMenuRef}
            className="md:hidden absolute top-[64px] left-0 right-0 bg-white border-b border-[#E8E5DF] shadow-xl shadow-black/10 z-40 animate-in slide-in-from-top-2"
          >
            <nav className="p-3 space-y-1 max-h-[calc(100vh-64px)] overflow-y-auto">
              {navLinks.map(link => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      active
                        ? "bg-[#0047FF]/10 text-[#0047FF]"
                        : "text-[#3A3A3A] hover:bg-[#F5F3EE]"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      active ? "bg-[#0047FF]/15 text-[#0047FF]" : "bg-[#F5F3EE] text-[#6B6B6B]"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${active ? "text-[#0047FF]" : "text-[#0A0A0A]"}`}>
                        {link.label}
                      </p>
                      <p className="text-xs text-[#8A8A8A] truncate">{link.desc}</p>
                    </div>
                    {active && (
                      <span className="text-[10px] font-bold text-[#0047FF] uppercase tracking-wide">сейчас</span>
                    )}
                  </Link>
                );
              })}

              <a
                href={MAIN_SITE}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl text-[#3A3A3A] hover:bg-[#F5F3EE] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#F5F3EE] text-[#6B6B6B] flex items-center justify-center shrink-0">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[#0A0A0A]">aziral.com</p>
                  <p className="text-xs text-[#8A8A8A] truncate">Главный сайт</p>
                </div>
              </a>

              {/* Language switcher — отдельный блок снизу */}
              <div className="pt-2 mt-2 border-t border-[#F0EEE9]">
                <LanguageSwitcher variant="full" />
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
