// Audio reading preferences (text language + amount language)
export type AudioLang = "fr" | "wo";

export type AudioPrefs = {
  textLang: AudioLang;
  amountLang: AudioLang;
};

const KEY = "altoppe.audioPrefs";

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  textLang: "wo",
  amountLang: "wo",
};

export function getAudioPrefs(): AudioPrefs {
  if (typeof window === "undefined") return DEFAULT_AUDIO_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_AUDIO_PREFS;
    const parsed = JSON.parse(raw);
    return {
      textLang: parsed.textLang === "fr" ? "fr" : "wo",
      amountLang: parsed.amountLang === "fr" ? "fr" : "wo",
    };
  } catch {
    return DEFAULT_AUDIO_PREFS;
  }
}

export function setAudioPrefs(prefs: AudioPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(prefs));
}

// French amount to words (integer FCFA)
const FR_UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const FR_TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function frBelow100(n: number): string {
  if (n < 20) return FR_UNITS[n];
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return FR_TENS[t];
    if (u === 1 && t !== 8) return `${FR_TENS[t]} et un`;
    return `${FR_TENS[t]}-${FR_UNITS[u]}`;
  }
  if (n < 80) {
    const u = n - 60;
    if (u === 11) return "soixante et onze";
    return `soixante-${FR_UNITS[u]}`;
  }
  const u = n - 80;
  if (u === 0) return "quatre-vingts";
  return `quatre-vingt-${FR_UNITS[u]}`;
}

function frBelow1000(n: number): string {
  if (n < 100) return frBelow100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hWord = h === 1 ? "cent" : `${FR_UNITS[h]} cent${r === 0 ? "s" : ""}`;
  return r === 0 ? hWord : `${hWord} ${frBelow100(r)}`;
}

export function numberToFrench(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const milliard = Math.floor(n / 1_000_000_000);
  n %= 1_000_000_000;
  const million = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (milliard) parts.push(`${frBelow1000(milliard)} milliard${milliard > 1 ? "s" : ""}`);
  if (million) parts.push(`${frBelow1000(million)} million${million > 1 ? "s" : ""}`);
  if (thousand) parts.push(thousand === 1 ? "mille" : `${frBelow1000(thousand)} mille`);
  if (n) parts.push(frBelow1000(n));
  return parts.join(" ");
}

export function amountToFrenchFCFA(value: number): string {
  return `${numberToFrench(value)} francs CFA`;
}
