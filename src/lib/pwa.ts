export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    // iOS Safari
    if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  } catch {
    return false;
  }
  return false;
}
