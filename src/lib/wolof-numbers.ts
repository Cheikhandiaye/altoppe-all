// Convert integer numbers to Wolof words (approximate phonetic spelling for TTS)
const UNITS = [
  "tus",
  "benn",
  "ñaar",
  "ñett",
  "ñeent",
  "juróom",
  "juróom-benn",
  "juróom-ñaar",
  "juróom-ñett",
  "juróom-ñeent",
];

function below100(n: number): string {
  if (n < 10) return UNITS[n];
  const tens = Math.floor(n / 10);
  const u = n % 10;
  const tenWord = tens === 1 ? "fukk" : `${UNITS[tens]} fukk`;
  return u === 0 ? tenWord : `${tenWord} ak ${UNITS[u]}`;
}

function below1000(n: number): string {
  if (n < 100) return below100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hWord = h === 1 ? "téeméer" : `${UNITS[h]} téeméer`;
  return r === 0 ? hWord : `${hWord} ak ${below100(r)}`;
}

export function numberToWolof(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "tus";
  const parts: string[] = [];
  const milliard = Math.floor(n / 1_000_000_000);
  n %= 1_000_000_000;
  const million = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (milliard) parts.push(`${below1000(milliard)} milyaar`);
  if (million) parts.push(`${below1000(million)} milyoŋ`);
  if (thousand) parts.push(`${below1000(thousand)} junni`);
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

export function amountToWolofFCFA(value: number): string {
  return `${numberToWolof(value)} franc seefaa`;
}

// ---- Phonetic Wolof (for French-speaking TTS reader) ----
// Uses "dërëm" unit: 1 dërëm = 5 CFA.
const PHON_UNITS = [
  "tus",
  "benn",
  "gnaari",
  "gnetti",
  "gnénti",
  "djiourom",
  "djiourom benn",
  "djiourom gnaari",
  "djiourom gnetti",
  "djiourom gnénti",
];

function phonBelow100(n: number): string {
  if (n < 10) return PHON_UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  const tenWord = t === 1 ? "foukk" : `${PHON_UNITS[t]} foukk`;
  return u === 0 ? tenWord : `${tenWord} ak ${PHON_UNITS[u]}`;
}

function phonBelow1000(n: number): string {
  if (n < 100) return phonBelow100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hWord = h === 1 ? "téméri" : `${PHON_UNITS[h]} téméri`;
  return r === 0 ? hWord : `${hWord} ak ${phonBelow100(r)}`;
}

function phonNumber(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "tus";
  const parts: string[] = [];
  const million = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (million) parts.push(`${phonBelow1000(million)} milyoŋ`);
  if (thousand) parts.push(thousand === 1 ? "djounni" : `${phonBelow1000(thousand)} djounni`);
  if (n) parts.push(phonBelow1000(n));
  return parts.join(" ");
}

// Convert a CFA amount to phonetic Wolof "dërëm" words.
export function convertCfaToWolofPhonetic(montantCfa: number): string {
  const derem = Math.round(Math.abs(montantCfa) / 5);
  return phonNumber(derem);
}
