import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { Mic, BarChart3, ListChecks, MessageCircle } from "lucide-react";
import { completeOnboarding } from "@/lib/onboarding.functions";

const searchSchema = z.object({ step: z.coerce.number().int().min(1).max(4).default(1) });

export const Route = createFileRoute("/_authenticated/_unlocked/onboarding/tour")({
  validateSearch: (s) => searchSchema.parse(s),
  component: OnboardingTourPage,
});

type Slide = {
  Icon: typeof Mic;
  title: string;
  caption: string;
  bg: string;
  accent: string;
};

const SLIDES: Slide[] = [
  {
    Icon: Mic,
    title: "Parlez, on note tout",
    caption: "Appuyez sur le micro et dictez vos ventes ou dépenses.",
    bg: "from-brand-green to-brand-green-soft",
    accent: "bg-brand-gold",
  },
  {
    Icon: BarChart3,
    title: "Vos chiffres en un clin d'œil",
    caption: "Revenus, dépenses, bénéfices — tout est clair.",
    bg: "from-brand-terracotta to-orange-500",
    accent: "bg-white",
  },
  {
    Icon: ListChecks,
    title: "Tout est rangé pour vous",
    caption: "Catégories automatiques façon SYSCOHADA.",
    bg: "from-brand-gold to-amber-500",
    accent: "bg-brand-green",
  },
  {
    Icon: MessageCircle,
    title: "Un coach à vos côtés",
    caption: "Conseils personnalisés pour faire grandir votre activité.",
    bg: "from-brand-green-soft to-emerald-600",
    accent: "bg-brand-gold",
  },
];

function OnboardingTourPage() {
  const navigate = useNavigate();
  const { step } = Route.useSearch();
  const callComplete = useServerFn(completeOnboarding);
  const [finishing, setFinishing] = useState(false);

  const idx = Math.min(Math.max(step, 1), 4) - 1;
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  const finish = async () => {
    setFinishing(true);
    try {
      await callComplete({});
      navigate({ to: "/app" });
    } catch {
      navigate({ to: "/app" });
    }
  };

  const next = () => {
    if (isLast) {
      finish();
    } else {
      navigate({ to: "/onboarding/tour", search: { step: idx + 2 } });
    }
  };

  const { Icon } = slide;

  return (
    <div className={`min-h-screen flex flex-col bg-gradient-to-br ${slide.bg}`}>
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-10">
          <div className={`absolute inset-0 ${slide.accent} rounded-full blur-3xl opacity-30 scale-150`} />
          <div className="relative w-48 h-48 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <div className={`w-32 h-32 rounded-full ${slide.accent} flex items-center justify-center shadow-2xl`}>
              <Icon className="w-16 h-16 text-brand-green" strokeWidth={2.2} />
            </div>
          </div>
          {/* deco dots */}
          <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white/40" />
          <span className="absolute bottom-4 -left-4 w-3 h-3 rounded-full bg-white/30" />
          <span className="absolute top-10 -left-8 w-2 h-2 rounded-full bg-white/50" />
        </div>

        <h2 className="font-display text-3xl font-bold text-white max-w-xs leading-tight">
          {slide.title}
        </h2>
        <p className="text-white/80 text-base mt-3 max-w-xs">{slide.caption}</p>

        <div className="flex gap-2 mt-10">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === idx ? "w-8 bg-white" : "w-2 bg-white/40"
              }`}
            />
          ))}
        </div>
      </main>

      <footer className="px-5 pb-8 pt-4 flex gap-3 bg-gradient-to-t from-black/20 to-transparent">
        <button
          onClick={finish}
          disabled={finishing}
          className="flex-1 h-12 rounded-xl bg-white/15 text-white font-bold uppercase tracking-wider text-xs backdrop-blur-sm border border-white/20 disabled:opacity-50"
        >
          Sortir
        </button>
        <button
          onClick={next}
          disabled={finishing}
          className="flex-[2] h-12 rounded-xl bg-white text-brand-green font-bold uppercase tracking-wider text-xs shadow-lg disabled:opacity-50"
        >
          {finishing ? "…" : isLast ? "Commencer" : "Suivant"}
        </button>
      </footer>
    </div>
  );
}
