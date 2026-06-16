import { createFileRoute } from "@tanstack/react-router";
import { CategoryTracker } from "./tontine";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/prets")({
  component: () => <CategoryTracker category="Prêt" title="Prêts" subtitle="Prêts & remboursements" />,
});
