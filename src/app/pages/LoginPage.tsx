import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const MAIN_SITE = import.meta.env.VITE_MAIN_SITE_URL || 'https://aziral.com';

/** On learn.aziral.com there's no local login — redirect to aziral.com/login with return URL */
export function LoginPage() {
  const location = useLocation();
  useEffect(() => {
    const returnTo = encodeURIComponent(`${window.location.origin}${location.state?.from || '/'}`);
    window.location.href = `${MAIN_SITE}/login?redirect=${returnTo}`;
  }, [location]);
  return null;
}
