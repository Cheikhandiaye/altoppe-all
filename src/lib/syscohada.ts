// SYSCOHADA simplified categories (SMT — Système Minimal de Trésorerie)
// Mapped to plain language for Senegalese small traders.

export type SyscohadaCategory = {
  code: string;
  label: string;
  labelWo?: string;
  type: "IN" | "OUT";
  nature: "EXPLOITATION" | "HORS_EXPLOITATION" | "PERSONNEL";
};

export const SYSCOHADA_CATEGORIES: SyscohadaCategory[] = [
  // Recettes (IN)
  { code: "70_VENTES", label: "Ventes de marchandises", labelWo: "Njaay", type: "IN", nature: "EXPLOITATION" },
  { code: "706_SERVICES", label: "Prestations de service", labelWo: "Liggéey", type: "IN", nature: "EXPLOITATION" },
  { code: "77_AUTRES_RECETTES", label: "Autres recettes", type: "IN", nature: "HORS_EXPLOITATION" },
  { code: "16_EMPRUNT", label: "Emprunt reçu", labelWo: "Boor", type: "IN", nature: "HORS_EXPLOITATION" },
  { code: "10_APPORT", label: "Apport personnel", type: "IN", nature: "HORS_EXPLOITATION" },

  // Dépenses (OUT) — Exploitation
  { code: "601_ACHATS_MARCH", label: "Achat de marchandises", labelWo: "Jënd marchandises", type: "OUT", nature: "EXPLOITATION" },
  { code: "602_MATIERES", label: "Matières premières", type: "OUT", nature: "EXPLOITATION" },
  { code: "604_EMBALLAGES", label: "Emballages", type: "OUT", nature: "EXPLOITATION" },
  { code: "61_TRANSPORT", label: "Transport / Livraison", labelWo: "Yoon", type: "OUT", nature: "EXPLOITATION" },
  { code: "622_LOYER", label: "Loyer boutique", labelWo: "Lokeer", type: "OUT", nature: "EXPLOITATION" },
  { code: "624_ENTRETIEN", label: "Entretien / Réparations", type: "OUT", nature: "EXPLOITATION" },
  { code: "627_BANQUE", label: "Frais Wave / Orange Money / Banque", type: "OUT", nature: "EXPLOITATION" },
  { code: "628_TELEPHONE", label: "Téléphone / Internet", type: "OUT", nature: "EXPLOITATION" },
  { code: "63_IMPOTS", label: "Impôts et taxes", type: "OUT", nature: "EXPLOITATION" },
  { code: "64_SALAIRES", label: "Salaires employés", labelWo: "Pay", type: "OUT", nature: "EXPLOITATION" },
  { code: "65_AUTRES_CHARGES", label: "Autres charges", type: "OUT", nature: "EXPLOITATION" },
  { code: "605_EAU_ELEC", label: "Eau / Électricité", labelWo: "Ndox / Léeram", type: "OUT", nature: "EXPLOITATION" },

  // Dépenses (OUT) — Hors exploitation
  { code: "16_REMBOURS", label: "Remboursement emprunt", type: "OUT", nature: "HORS_EXPLOITATION" },
  { code: "21_INVEST", label: "Investissement (matériel)", type: "OUT", nature: "HORS_EXPLOITATION" },

  // Personnel (toujours marqué is_personal=true)
  { code: "108_PRELEVEMENT", label: "Prélèvement personnel", labelWo: "Sama bopp", type: "OUT", nature: "PERSONNEL" },
];

export function categoriesByType(type: "IN" | "OUT") {
  return SYSCOHADA_CATEGORIES.filter((c) => c.type === type);
}

export function findCategory(code: string) {
  return SYSCOHADA_CATEGORIES.find((c) => c.code === code);
}
