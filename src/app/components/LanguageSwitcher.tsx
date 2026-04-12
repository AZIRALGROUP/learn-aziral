import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Globe, ChevronDown } from "lucide-react";

const LANGS = [
  { code: "ru", label: "RU", name: "Русский", flag: "🇷🇺" },
  { code: "en", label: "EN", name: "English", flag: "🇬🇧" },
  { code: "kz", label: "ҚЗ", name: "Қазақша", flag: "🇰🇿" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  const change = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all text-sm"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{current.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-2 w-36 bg-[#0d1117]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20"
            >
              {LANGS.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => change(lang.code)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-white/5 ${
                    lang.code === i18n.language ? "text-blue-400 bg-blue-500/5" : "text-gray-300"
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
