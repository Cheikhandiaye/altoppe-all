// Génère icônes + screenshots PWA pour AL-TOPPE
// Run: node scripts/generate-pwa-assets.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PUB = resolve(ROOT, "public");

async function writePng(filePath, buffer) {
  await mkdir(dirname(filePath), { recursive: true });
  await sharp(buffer).png().toFile(filePath);
  console.log("✓", filePath.replace(ROOT + "/", ""));
}

// SVG du logo "A TOPPE" — fond plein vert, cercle, lettre A, sous-texte TOPPE
function logoSvg({ size, withSubtext = true, bg = "#1B4332", circle = "#2D6A4F" }) {
  const aFont = Math.round(size * 0.4);
  const subFont = Math.round(size * 0.1);
  const r = Math.round(size * 0.35);
  const cy = withSubtext ? size * 0.46 : size * 0.5;
  const aY = withSubtext ? cy + aFont * 0.35 : cy + aFont * 0.35;
  const subY = size * 0.86;
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <circle cx="${size / 2}" cy="${cy}" r="${r}" fill="${circle}"/>
  <text x="${size / 2}" y="${aY}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${aFont}" fill="#ffffff" text-anchor="middle">A</text>
  ${withSubtext ? `<text x="${size / 2}" y="${subY}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${subFont}" fill="#ffffff" text-anchor="middle" letter-spacing="${subFont * 0.1}">TOPPE</text>` : ""}
</svg>`);
}

// Maskable : contenu dans 60% central
function maskableSvg(size) {
  const inner = Math.round(size * 0.6);
  const off = Math.round((size - inner) / 2);
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1B4332"/>
  <g transform="translate(${off}, ${off})">
    <rect width="${inner}" height="${inner}" fill="#1B4332"/>
    <circle cx="${inner / 2}" cy="${inner * 0.46}" r="${inner * 0.35}" fill="#2D6A4F"/>
    <text x="${inner / 2}" y="${inner * 0.46 + inner * 0.4 * 0.35}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${inner * 0.4}" fill="#ffffff" text-anchor="middle">A</text>
    <text x="${inner / 2}" y="${inner * 0.86}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${inner * 0.1}" fill="#ffffff" text-anchor="middle" letter-spacing="${inner * 0.01}">TOPPE</text>
  </g>
</svg>`);
}

async function genIcons() {
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512, 1024];
  for (const s of sizes) {
    await writePng(resolve(PUB, `icon-${s}.png`), logoSvg({ size: s }));
  }
  for (const s of [192, 512]) {
    await writePng(resolve(PUB, `icon-${s}-maskable.png`), maskableSvg(s));
  }
  // splash 2732x2732
  const splash = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#1B4332"/>
  <circle cx="1366" cy="1266" r="200" fill="#2D6A4F"/>
  <text x="1366" y="1330" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="220" fill="#ffffff" text-anchor="middle">A</text>
  <text x="1366" y="1620" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="80" fill="#ffffff" text-anchor="middle" letter-spacing="8">AL-TOPPE</text>
</svg>`);
  await writePng(resolve(PUB, "splash.png"), splash);
}

// SCREENSHOTS 390x844 — simulation simple
const W = 390, H = 844;

function dashboardSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F4F1DE"/>
  <rect width="${W}" height="60" fill="#1B4332"/>
  <text x="${W / 2}" y="38" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">AL-TOPPE</text>

  <rect x="20" y="90" width="${W - 40}" height="110" rx="16" fill="#ffffff"/>
  <text x="40" y="125" font-family="Arial, sans-serif" font-size="14" fill="#888888">Solde disponible</text>
  <text x="40" y="170" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#1B4332">125 000 FCFA</text>

  <rect x="20" y="220" width="${W - 40}" height="90" rx="16" fill="#ffffff"/>
  <text x="40" y="250" font-family="Arial, sans-serif" font-size="14" fill="#888888">Recettes du jour</text>
  <text x="40" y="288" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#1B4332">47 500 FCFA</text>

  <rect x="20" y="330" width="${W - 40}" height="90" rx="16" fill="#ffffff"/>
  <text x="40" y="360" font-family="Arial, sans-serif" font-size="14" fill="#888888">Dépenses du jour</text>
  <text x="40" y="398" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#C0392B">12 000 FCFA</text>

  <circle cx="${W / 2}" cy="700" r="45" fill="#1B4332"/>
  <rect x="${W / 2 - 6}" y="680" width="12" height="22" rx="6" fill="#ffffff"/>
  <path d="M ${W / 2 - 14} 700 Q ${W / 2} 720 ${W / 2 + 14} 700" stroke="#ffffff" stroke-width="3" fill="none"/>
  <line x1="${W / 2}" y1="720" x2="${W / 2}" y2="735" stroke="#ffffff" stroke-width="3"/>
  <text x="${W / 2}" y="780" font-family="Arial, sans-serif" font-size="13" fill="#888888" text-anchor="middle">Maintenir pour dicter</text>
</svg>`);
}

function voiceSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect width="${W}" height="60" fill="#1B4332"/>
  <text x="${W / 2}" y="38" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">Saisie vocale</text>

  <circle cx="${W / 2}" cy="280" r="60" fill="#1B4332"/>
  <circle cx="${W / 2}" cy="280" r="80" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.5"/>
  <circle cx="${W / 2}" cy="280" r="100" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.3"/>
  <rect x="${W / 2 - 8}" y="255" width="16" height="30" rx="8" fill="#ffffff"/>
  <path d="M ${W / 2 - 18} 285 Q ${W / 2} 310 ${W / 2 + 18} 285" stroke="#ffffff" stroke-width="3" fill="none"/>
  <line x1="${W / 2}" y1="310" x2="${W / 2}" y2="325" stroke="#ffffff" stroke-width="3"/>

  <text x="${W / 2}" y="420" font-family="Arial, sans-serif" font-size="16" fill="#888888" text-anchor="middle">En cours d'enregistrement...</text>

  <rect x="20" y="470" width="${W - 40}" height="100" rx="12" fill="#F4F1DE" stroke="#1B4332" stroke-width="1"/>
  <text x="35" y="505" font-family="Arial, sans-serif" font-size="15" fill="#222222">J'ai vendu du thiébou dieune</text>
  <text x="35" y="528" font-family="Arial, sans-serif" font-size="15" fill="#222222">pour 3500 francs</text>
  <text x="35" y="558" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#1B4332">Montant : 3 500 FCFA — Recette</text>
</svg>`);
}

function transactionsSvg() {
  const rows = [
    { label: "Vente boutique", amt: "+15 000 FCFA", date: "aujourd'hui", color: "#1B4332" },
    { label: "Achat stock", amt: "-8 500 FCFA", date: "hier", color: "#C0392B" },
    { label: "Vente thiébou", amt: "+3 500 FCFA", date: "hier", color: "#1B4332" },
    { label: "Transport", amt: "-2 000 FCFA", date: "12/06", color: "#C0392B" },
  ];
  const items = rows
    .map((r, i) => {
      const y = 100 + i * 80;
      const bg = i % 2 === 0 ? "#ffffff" : "#F4F1DE";
      return `<rect x="0" y="${y}" width="${W}" height="80" fill="${bg}"/>
      <text x="20" y="${y + 32}" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#222222">${r.label}</text>
      <text x="20" y="${y + 55}" font-family="Arial, sans-serif" font-size="12" fill="#888888">${r.date}</text>
      <text x="${W - 20}" y="${y + 45}" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${r.color}" text-anchor="end">${r.amt}</text>`;
    })
    .join("\n");

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F4F1DE"/>
  <rect width="${W}" height="60" fill="#1B4332"/>
  <text x="${W / 2}" y="38" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">Mes transactions</text>
  ${items}
  <rect x="0" y="${H - 70}" width="${W}" height="70" fill="#ffffff" stroke="#dddddd" stroke-width="1"/>
  ${["Accueil", "Transactions", "Vocal", "Réglages"]
    .map(
      (l, i) =>
        `<text x="${(W / 4) * i + W / 8}" y="${H - 28}" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="#1B4332" text-anchor="middle">${l}</text>`,
    )
    .join("")}
</svg>`);
}

async function genScreenshots() {
  await writePng(resolve(PUB, "screenshots/dashboard.png"), dashboardSvg());
  await writePng(resolve(PUB, "screenshots/voice.png"), voiceSvg());
  await writePng(resolve(PUB, "screenshots/transactions.png"), transactionsSvg());
}

await genIcons();
await genScreenshots();
console.log("\n✅ Tous les assets PWA générés.");
