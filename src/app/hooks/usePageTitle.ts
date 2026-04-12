import { useEffect } from "react";

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

const BASE_URL = "https://aziral.com";
const DEFAULT_TITLE = "AZIRAL — IT-разработка в Астане | Сайты, Приложения, DevOps";
const DEFAULT_DESC = "Профессиональная IT-команда из Казахстана. Разрабатываем сайты, мобильные приложения, настраиваем серверы и DevOps-инфраструктуру. Более 7 лет опыта.";

interface SEOOptions {
  description?: string;
  path?: string;
}

export function usePageTitle(title: string, options: SEOOptions = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | AZIRAL` : DEFAULT_TITLE;
    const desc = options.description || DEFAULT_DESC;
    const canonical = `${BASE_URL}${options.path || ""}`;

    document.title = fullTitle;
    setMeta("description", desc);
    setCanonical(canonical);
    setOg("og:title", fullTitle);
    setOg("og:description", desc);
    setOg("og:url", canonical);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESC);
      setCanonical(`${BASE_URL}/`);
      setOg("og:title", DEFAULT_TITLE);
      setOg("og:description", DEFAULT_DESC);
      setOg("og:url", `${BASE_URL}/`);
    };
  }, [title, options.description, options.path]);
}
