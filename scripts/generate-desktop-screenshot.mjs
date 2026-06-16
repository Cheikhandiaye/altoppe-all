import sharp from "sharp";
const W=1280,H=800;
const svg=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F4F1DE"/>
  <rect width="220" height="${H}" fill="#1B4332"/>
  <text x="110" y="50" font-family="Arial,sans-serif" font-weight="900" font-size="20" letter-spacing="3" fill="#C9A84C" text-anchor="middle">AL-TOPPE</text>
  ${["Tableau de bord","Entrepreneurs","Coaching","Statistiques","Paramètres"].map((l,i)=>`<text x="32" y="${110+i*44}" font-family="Arial,sans-serif" font-size="14" font-weight="500" fill="${i===0?"#C9A84C":"#ffffffaa"}">${l}</text>`).join("")}
  <rect x="260" y="40" width="980" height="80" rx="14" fill="#ffffff"/>
  <text x="280" y="78" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#1B4332">Bonjour, Coach Mariama</text>
  <text x="280" y="102" font-family="Arial,sans-serif" font-size="13" fill="#888">12 entrepreneurs actifs · 247 transactions cette semaine</text>
  <rect x="260" y="140" width="313" height="160" rx="14" fill="#ffffff"/>
  <text x="280" y="170" font-family="Arial,sans-serif" font-size="11" letter-spacing="1" fill="#888">CHIFFRE D'AFFAIRES</text>
  <text x="280" y="218" font-family="Arial,sans-serif" font-size="36" font-weight="800" fill="#1B4332">7.748.025 F</text>
  <text x="280" y="248" font-family="Arial,sans-serif" font-size="13" fill="#2D6A4F">+27% vs mois passé</text>
  <rect x="593" y="140" width="313" height="160" rx="14" fill="#ffffff"/>
  <text x="613" y="170" font-family="Arial,sans-serif" font-size="11" letter-spacing="1" fill="#888">DÉPENSES</text>
  <text x="613" y="218" font-family="Arial,sans-serif" font-size="36" font-weight="800" fill="#C0392B">5.654.380 F</text>
  <rect x="926" y="140" width="314" height="160" rx="14" fill="#1B4332"/>
  <text x="946" y="170" font-family="Arial,sans-serif" font-size="11" letter-spacing="1" fill="#C9A84C">GAIN DISPONIBLE</text>
  <text x="946" y="218" font-family="Arial,sans-serif" font-size="36" font-weight="800" fill="#fff">2.093.645 F</text>
  <rect x="260" y="320" width="980" height="440" rx="14" fill="#ffffff"/>
  <text x="280" y="354" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#1B4332">Activité récente des entrepreneurs</text>
  ${[0,1,2,3,4,5].map(i=>`<rect x="280" y="${380+i*58}" width="940" height="46" rx="10" fill="${i%2?"#F8F6EE":"#fff"}" stroke="#eee"/>
  <circle cx="306" cy="${403+i*58}" r="14" fill="#2D6A4F"/>
  <text x="334" y="${408+i*58}" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="#1A1A1A">Entrepreneur ${i+1} — Vente boutique</text>
  <text x="1200" y="${408+i*58}" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#2D6A4F" text-anchor="end">+${(Math.random()*50000|0)+1000} F</text>`).join("")}
</svg>`;
await sharp(Buffer.from(svg)).png().toFile("public/screenshots/desktop.png");
console.log("ok");
