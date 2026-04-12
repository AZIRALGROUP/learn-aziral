import { useEffect } from "react";

const MAIN_SITE = import.meta.env.VITE_MAIN_SITE_URL || 'https://aziral.com';

/** On learn.aziral.com there's no local register — redirect to aziral.com/register */
export function RegisterPage() {
  useEffect(() => {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `${MAIN_SITE}/register?redirect=${returnTo}`;
  }, []);
  return null;
}
