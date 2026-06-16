/**
 * wolofTTS.ts
 * Lecture vocale du bilan financier — Français & Wolof phonétique natif
 *
 * UNITÉ MONÉTAIRE WOLOF : dërëm (1 dërëm = 5 FCFA)
 * Exemple : 2 000 FCFA = 400 dërëm
 */

const UNITES = [
  "",
  "benn",
  "ñaar",
  "ñett",
  "ñeent",
  "juróom",
  "juróom benn",
  "juróom ñaar",
  "juróom ñett",
  "juróom ñeent",
];

const DIZAINES_PURES: Record<number, string> = {
  10: "fukk",
  20: "ñaar fukk",
  30: "fanweer",
  40: "nién fukk",
  50: "juróom fukk",
  60: "juróom fukk ak ñaar",
  70: "juróom fukk ak ñaar ak fukk",
  80: "ñeent fukk",
  90: "ñeent fukk ak fukk",
};

// Ordre critique : formes longues d'abord
const TRANSLIT_TTS: Array<[RegExp, string]> = [
  [/juróom fukk ak ñaar ak fukk/g, "djourome fouk ak gniar ak fouk"],
  [/juróom fukk ak ñaar/g, "djourome fouk ak gniar"],
  [/ñeent fukk ak fukk/g, "gniénte fouk ak fouk"],
  [/nién fukk/g, "niéne fouk"],
  [/fanweer/g, "fanwère"],
  [/juróom fukk/g, "djourome fouk"],
  [/ñeent fukk/g, "gniénte fouk"],
  [/ñaar fukk/g, "gniar fouk"],
  [/fukk/g, "fouk"],
  [/juróom benn/g, "djourome bène"],
  [/juróom ñaar/g, "djourome gniar"],
  [/juróom ñett/g, "djourome gnète"],
  [/juróom ñeent/g, "djourome gniénte"],
  [/juróom/g, "djourome"],
  [/benn/g, "bène"],
  [/ñaar/g, "gniar"],
  [/ñett/g, "gnète"],
  [/ñeent/g, "gniénte"],
  [/téeméer/g, "téméère"],
  [/junni/g, "djourni"],
  [/ñ/g, "gni"],
  [/ë/g, "eu"],
  [/à/g, "a"],
  [/ó/g, "o"],
];

const translitérer = (texte: string): string =>
  TRANSLIT_TTS.reduce((t, [p, r]) => t.replace(p, r), texte);

const wolofSousCent = (num: number): string => {
  if (num < 10) return UNITES[num];
  const d = Math.floor(num / 10) * 10;
  const u = num % 10;
  return u === 0 ? DIZAINES_PURES[d] : `${DIZAINES_PURES[d]} ak ${UNITES[u]}`;
};

export const getWolofNumberText = (num: number): string => {
  if (num === 0) return "dara";
  if (num < 0) return getWolofNumberText(-num);
  if (num < 100) return wolofSousCent(num);
  if (num < 1_000) {
    const c = Math.floor(num / 100);
    const r = num % 100;
    const cent = c === 1 ? "téeméer" : `${UNITES[c]} téeméer`;
    return r === 0 ? cent : `${cent} ak ${wolofSousCent(r)}`;
  }
  if (num < 1_000_000) {
    const m = Math.floor(num / 1_000);
    const r = num % 1_000;
    const mill = m === 1 ? "junni" : `${getWolofNumberText(m)} junni`;
    return r === 0 ? mill : `${mill} ${getWolofNumberText(r)}`;
  }
  const mil = Math.floor(num / 1_000_000);
  const r = num % 1_000_000;
  const milTxt = mil === 1 ? "million" : `${getWolofNumberText(mil)} million`;
  return r === 0 ? milTxt : `${milTxt} ${getWolofNumberText(r)}`;
};

export const convertCfaToWolofPhonetic = (montantCfa: number): string => {
  const derem = Math.floor(Math.abs(montantCfa) / 5);
  return `${translitérer(getWolofNumberText(derem))} dérrème`;
};

type IndicatorType = "recette" | "depense" | "benefice" | "perte";
type Langue = "fr" | "wo";

const LABELS_WO: Record<IndicatorType, string> = {
  recette: translitérer("Xaalis bi nga fayéku,"),
  depense: translitérer("Xaalis bi nga guénné,"),
  benefice: translitérer("Sa liguey diour ndiarign lou tolleu ci,"),
  perte: translitérer("Xaalis bi nga niakkeu tolleu na ci,"),
};

const LABELS_FR: Record<IndicatorType, string> = {
  recette: "Tout ce que vous avez encaissé s'élève à",
  depense: "Tout ce que vous avez dépensé s'élève à",
  benefice: "Votre bénéfice actuel s'élève à",
  perte: "Vos pertes actuelles s'élèvent à",
};

const parler = (texte: string): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = "fr-FR";
  u.rate = 0.85;
  u.pitch = 1.0;
  u.volume = 1.0;
  window.speechSynthesis.speak(u);
};

export const lireBilanVocal = (
  type: IndicatorType,
  montantCfa: number,
  langue: Langue,
): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const texte =
    langue === "fr"
      ? `${LABELS_FR[type]} ${montantCfa.toLocaleString("fr-FR")} francs CFA.`
      : `${LABELS_WO[type]} ${convertCfaToWolofPhonetic(montantCfa)} la.`;
  parler(texte);
};

export const stopBilanVocal = (): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
};

export const isBilanVocalPlaying = (): boolean => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  return window.speechSynthesis.speaking;
};

export const lireBilanCompletVocal = (
  totalEntrees: number,
  totalSorties: number,
  resultat: number,
  langueLecture: Langue,
  onEnd?: () => void,
): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  let p1: string, p2: string, p3: string;

  if (langueLecture === "fr") {
    p1 = `${LABELS_FR.recette} ${totalEntrees.toLocaleString("fr-FR")} francs CFA.`;
    p2 = `${LABELS_FR.depense} ${totalSorties.toLocaleString("fr-FR")} francs CFA.`;
    p3 =
      resultat >= 0
        ? `${LABELS_FR.benefice} ${resultat.toLocaleString("fr-FR")} francs CFA.`
        : `${LABELS_FR.perte} ${Math.abs(resultat).toLocaleString("fr-FR")} francs CFA.`;
  } else {
    p1 = `${LABELS_WO.recette} ${convertCfaToWolofPhonetic(totalEntrees)} la.`;
    p2 = `${LABELS_WO.depense} ${convertCfaToWolofPhonetic(totalSorties)} la.`;
    p3 =
      resultat >= 0
        ? `${LABELS_WO.benefice} ${convertCfaToWolofPhonetic(resultat)} la.`
        : `${LABELS_WO.perte} ${convertCfaToWolofPhonetic(Math.abs(resultat))} la.`;
  }

  const u = new SpeechSynthesisUtterance(`${p1} ${p2} ${p3}`);
  u.lang = "fr-FR";
  u.rate = 0.85;
  u.pitch = 1.0;
  u.volume = 1.0;
  if (onEnd) {
    u.onend = () => onEnd();
    u.onerror = () => onEnd();
  }
  window.speechSynthesis.speak(u);
};

export const toggleBilanCompletVocal = (
  totalEntrees: number,
  totalSorties: number,
  resultat: number,
  langueLecture: Langue,
  onEnd?: () => void,
): boolean => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    return false;
  }
  lireBilanCompletVocal(totalEntrees, totalSorties, resultat, langueLecture, onEnd);
  return true;
};

