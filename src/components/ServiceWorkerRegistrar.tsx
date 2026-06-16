import { useEffect } from "react";

/**
 * Enregistre /sw.js UNIQUEMENT en production sur un host non-preview.
 * Désinscrit tout SW résiduel en dev / preview Lovable / iframe / ?sw=off
 * pour éviter de servir du HTML obsolète depuis le cache.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const host = window.location.hostname;
    const isPreviewHost =
      host.startsWith("id-preview--") ||
      host.startsWith("preview--") ||
      host === "lovableproject.com" ||
      host.endsWith(".lovableproject.com") ||
      host === "lovableproject-dev.com" ||
      host.endsWith(".lovableproject-dev.com") ||
      host === "beta.lovable.dev" ||
      host.endsWith(".beta.lovable.dev");
    const isIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";
    const isDev = !import.meta.env.PROD;

    const shouldUnregister = isDev || isPreviewHost || isIframe || killSwitch;

    if (shouldUnregister) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        regs.forEach((r) => {
          const scriptURL = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          if (scriptURL.endsWith("/sw.js")) r.unregister().catch(() => undefined);
        });
      }).catch(() => undefined);
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW enregistré:", reg.scope))
        .catch((err) => console.log("SW erreur:", err));
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  return null;
}
