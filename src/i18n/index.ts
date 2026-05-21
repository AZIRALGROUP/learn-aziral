import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { ru } from "./ru";
import { en } from "./en";
import { kz } from "./kz";

/* ──────────────────────────────────────────────────────────────
   CIS detection — RU для СНГ, EN для остальных
   Проверяем код языка И код региона из navigator.languages
   ────────────────────────────────────────────────────────────── */
const CIS_LANGUAGE_CODES = new Set([
  "ru", // Русский
  "be", // Беларусский
  "kk", // Казахский (Apple/Google используют kk, не kz)
  "ky", // Кыргызский
  "hy", // Армянский
  "az", // Азербайджанский
  "tg", // Таджикский
  "tk", // Туркменский
  "uz", // Узбекский
  "uk", // Украинский
  "ka", // Грузинский
  "mo", // Молдавский
  "ro", // Румынский (для Молдовы)
]);

const CIS_COUNTRY_CODES = new Set([
  "RU", // Россия
  "BY", // Беларусь
  "KZ", // Казахстан
  "KG", // Кыргызстан
  "AM", // Армения
  "AZ", // Азербайджан
  "MD", // Молдова
  "TJ", // Таджикистан
  "TM", // Туркменистан
  "UZ", // Узбекистан
  "UA", // Украина
  "GE", // Грузия
]);

function detectCisOrEnglish(): string {
  if (typeof navigator === "undefined") return "en";
  // navigator.languages — массив всех языков пользователя в порядке предпочтения
  // (browser locale + system locale + fallbacks)
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];

  for (const tag of langs) {
    if (!tag) continue;
    const [rawLang, rawRegion] = tag.split("-");
    const lang   = rawLang?.toLowerCase();
    const region = rawRegion?.toUpperCase();
    // Если язык — один из СНГ → RU
    if (lang && CIS_LANGUAGE_CODES.has(lang)) return "ru";
    // Или регион — одна из стран СНГ → RU
    if (region && CIS_COUNTRY_CODES.has(region)) return "ru";
  }
  return "en";
}

/* ──────────────────────────────────────────────────────────────
   Custom detector — регистрируется через addDetector()
   ────────────────────────────────────────────────────────────── */
const langDetector = new LanguageDetector();
langDetector.addDetector({
  name: "cisOrEnglish",
  lookup: detectCisOrEnglish,
  // cacheUserLanguage — пусть никуда не пишет, для этого есть localStorage в order
  cacheUserLanguage: () => {},
});

i18n
  .use(langDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      kz: { translation: kz },
    },
    // Если detector вернул что-то невалидное — fallback на en
    fallbackLng: "en",
    supportedLngs: ["ru", "en", "kz"],
    nonExplicitSupportedLngs: false,
    defaultNS: "translation",
    interpolation: { escapeValue: false },
    detection: {
      // Порядок: сначала смотрим явный выбор пользователя, потом наш умный detector
      order: ["localStorage", "cisOrEnglish"],
      caches: ["localStorage"],
      lookupLocalStorage: "azr-lang",
    },
  });

export default i18n;
