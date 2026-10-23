import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

function setOg(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
  el.content = content;
}

function setCanonical(url: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) { el = document.createElement("link"); el.rel = "canonical"; document.head.appendChild(el); }
  el.href = url;
}

const BASE_URL = "https://learn.aziral.com";
const DEFAULT_TITLE = "AZIRAL Learn — Онлайн-курсы";
const DEFAULT_DESC = "Онлайн-курсы, практика и тесты по разработке от команды AZIRAL. Учитесь у практикующих разработчиков.";

export function isPrivateLearningPath(path: string) {
  return /^\/(?:instructor|profile|practice|login|register)(?:\/|$)/.test(path)
    || /^\/courses\/[^/]+\/learn(?:\/|$)/.test(path);
}

interface SEOOptions {
  description?: string;
  path?: string;
}

export function usePageTitle(title: string, options: SEOOptions = {}) {
  const { pathname } = useLocation();
  useEffect(() => {
    const fullTitle = title ? (title.includes("AZIRAL") ? title : `${title} | AZIRAL Learn`) : DEFAULT_TITLE;
    const desc = options.description || DEFAULT_DESC;
    const canonical = `${BASE_URL}${options.path || pathname}`;

    document.title = fullTitle;
    setMeta("description", desc);
    setMeta("robots", isPrivateLearningPath(pathname) ? "noindex, nofollow" : "index, follow");
    setCanonical(canonical);
    setOg("og:title", fullTitle);
    setOg("og:description", desc);
    setOg("og:url", canonical);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESC);
      setMeta("robots", "index, follow");
      setCanonical(`${BASE_URL}/`);
      setOg("og:title", DEFAULT_TITLE);
      setOg("og:description", DEFAULT_DESC);
      setOg("og:url", `${BASE_URL}/`);
    };
  }, [title, options.description, options.path, pathname]);
}
