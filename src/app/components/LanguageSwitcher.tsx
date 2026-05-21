import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";

const LANGS = [
  { code: "ru", label: "RU", name: "Русский",  flag: "🇷🇺" },
  { code: "en", label: "EN", name: "English",  flag: "🇬🇧" },
  { code: "kz", label: "ҚЗ", name: "Қазақша",  flag: "🇰🇿" },
];

type Variant = "icon" | "full";

/**
 * LanguageSwitcher
 *   variant="icon"  → компактная иконка-кнопка для navbar (desktop)
 *   variant="full"  → 3 plain row-кнопки рядом (для mobile menu)
 */
export function LanguageSwitcher({ variant = "icon" }: { variant?: Variant }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  // Close dropdown on outside click
  useEffect(() => {
    if (variant !== "icon") return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [variant]);

  const change = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  // ──────── Full variant — для mobile menu (3 кнопки в ряд) ────────
  if (variant === "full") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F5F3EE] border border-[#E8E5DF]">
        <div className="flex items-center gap-2 text-xs text-[#6B6B6B] font-medium shrink-0 pl-1">
          <Globe className="w-3.5 h-3.5" />
          Язык
        </div>
        <div className="flex-1 flex items-center gap-1.5 justify-end">
          {LANGS.map(lang => {
            const active = lang.code === i18n.language;
            return (
              <button
                key={lang.code}
                onClick={() => change(lang.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? "bg-[#0047FF] text-white shadow-sm shadow-[#0047FF]/20"
                    : "bg-white border border-[#E8E5DF] text-[#3A3A3A] hover:border-[#0047FF]/40"
                }`}
                title={lang.name}
              >
                <span className="mr-1">{lang.flag}</span>
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ──────── Icon variant — для navbar (desktop, dropdown) ────────
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-[#EDEAE4] text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors"
        aria-label="Выбрать язык"
      >
        <Globe className="w-4 h-4" />
        <span className="text-xs font-semibold tracking-wide">{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-[#E8E5DF] rounded-2xl shadow-lg shadow-black/10 overflow-hidden py-1 z-50">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8A8A8A] border-b border-[#F0EEE9]">
            Язык интерфейса
          </div>
          {LANGS.map(lang => {
            const active = lang.code === i18n.language;
            return (
              <button
                key={lang.code}
                onClick={() => change(lang.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-[#0047FF]/5 text-[#0047FF] font-medium"
                    : "text-[#3A3A3A] hover:bg-[#F5F3EE]"
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="flex-1 text-left">{lang.name}</span>
                {active && <Check className="w-3.5 h-3.5 text-[#0047FF]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
