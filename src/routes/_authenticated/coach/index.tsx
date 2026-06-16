import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/coach/")({
  component: CoachIndex,
});

function CoachIndex() {
  return (
    <div className="bg-card rounded-2xl border border-brand-green/10 p-10 text-center">
      <Users className="w-10 h-10 mx-auto text-brand-green/30 mb-4" />
      <h2 className="font-display text-xl font-bold text-brand-green">
        Sélectionnez un entrepreneur
      </h2>
      <p className="text-sm text-brand-green/60 mt-2">
        Cliquez sur un nom dans la liste pour consulter ses transactions et corriger ses
        catégorisations.
      </p>
    </div>
  );
}
