import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { hasPinSet, setPin, verifyPin } from "@/lib/pin.functions";
import { getMyProfile } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ActiveActivityProvider } from "@/hooks/use-active-activity";
import { POSProvider } from "@/hooks/use-pos";
import { BottomBar } from "@/components/BottomBar";

const PIN_KEY = "jc:pin-unlocked";

function markUnlocked() {
  try {
    sessionStorage.setItem(PIN_KEY, "1");
  } catch {
    /* ignore */
  }
}

function isUnlocked() {
  try {
    return sessionStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
}

function clearUnlocked() {
  try {
    localStorage.removeItem(PIN_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(PIN_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem("jc:settings-unlocked");
  } catch {
    /* ignore */
  }
}

export const Route = createFileRoute("/_authenticated/_unlocked")({
  component: PinGate,
});

function PinGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkHasPin = useServerFn(hasPinSet);
  const callSetPin = useServerFn(setPin);
  const callVerifyPin = useServerFn(verifyPin);

  const [phase, setPhase] = useState<"loading" | "setup" | "enter" | "ok">("loading");
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onOnboarding = pathname.startsWith("/onboarding");
  const onSettings = pathname.startsWith("/settings");

  // Nettoyer le verrou des réglages dès qu'on quitte la section Réglages
  useEffect(() => {
    if (!onSettings) {
      try {
        sessionStorage.removeItem("jc:settings-unlocked");
      } catch {
        /* ignore */
      }
    }
  }, [onSettings]);

  useEffect(() => {
    // 1. Laisser passer sans blocage pendant le parcours d'onboarding
    if (onOnboarding) {
      setPhase("ok");
      return;
    }

    // 2. Double sécurité : Demande systématique pour accéder aux Réglages
    if (onSettings) {
      try {
        if (sessionStorage.getItem("jc:settings-unlocked") === "1") {
          setPhase("ok");
          return;
        }
      } catch {
        /* ignore */
      }
      checkHasPin()
        .then((res) => setPhase(res.hasPin ? "enter" : "setup"))
        .catch(() => setPhase("setup"));
      return;
    }

    // 3. Navigation normale globale (Demande à chaque réouverture de l'app)
    if (typeof window !== "undefined" && isUnlocked()) {
      setPhase("ok");
      return;
    }

    checkHasPin()
      .then((res) => setPhase(res.hasPin ? "enter" : "setup"))
      .catch(() => setPhase("setup"));
  }, [checkHasPin, onOnboarding, onSettings, pathname]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirm) {
      toast.error("Les codes PIN ne correspondent pas");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Le PIN doit comporter 4 chiffres");
      return;
    }
    setSubmitting(true);
    try {
      await callSetPin({ data: { pin } });
      markUnlocked();
      if (onSettings) {
        try {
          sessionStorage.setItem("jc:settings-unlocked", "1");
        } catch {}
      }
      toast.success("Code PIN enregistré");
      setPhase("ok");
      setPinValue("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return;
    setSubmitting(true);
    try {
      const res = await callVerifyPin({ data: { pin } });
      if (res.ok) {
        markUnlocked();
        if (onSettings) {
          try {
            sessionStorage.setItem("jc:settings-unlocked", "1");
          } catch {}
        }
        setPhase("ok");
        setPinValue("");
      } else {
        toast.error("Code PIN incorrect");
        setPinValue("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "ok")
    return (
      <ActiveActivityProvider>
        <POSProvider>
          <OnboardingGate />
        </POSProvider>
      </ActiveActivityProvider>
    );

  return (
    <div className="min-h-screen bg-brand-green flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-4">
          {phase === "setup" ? "Créer votre code" : "Sécurité"}
        </p>
        <h2 className="font-display text-3xl font-bold text-white mb-2">
          {phase === "setup" ? "Choisissez un code à 4 chiffres" : "Code secret"}
        </h2>
        <p className="text-sm text-white/60 mb-8">
          {phase === "setup" ? "Ce code protègera vos données financières." : "Votre code local pour ouvrir AL-TOPPE."}
        </p>

        {phase === "loading" && <p className="text-white/60">Chargement...</p>}

        {phase === "setup" && (
          <form onSubmit={handleSetup} className="space-y-4">
            <PinInput value={pin} onChange={setPinValue} autoFocus />
            <PinInput value={confirm} onChange={setConfirm} placeholder="Confirmer" />
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-brand-terracotta hover:bg-brand-terracotta/90"
            >
              {submitting ? "..." : "Enregistrer"}
            </Button>
          </form>
        )}

        {phase === "enter" && (
          <form onSubmit={handleEnter} className="space-y-4">
            <PinInput value={pin} onChange={setPinValue} autoFocus autoSubmit onComplete={() => {}} />
            <Button
              type="submit"
              disabled={submitting || pin.length !== 4}
              className="w-full h-12 bg-brand-terracotta hover:bg-brand-terracotta/90"
            >
              {submitting ? "..." : "Déverrouiller"}
            </Button>
            <button
              type="button"
              onClick={async () => {
                await import("@/integrations/supabase/client").then(({ supabase }) => supabase.auth.signOut());
                clearUnlocked();
                navigate({ to: "/login" });
              }}
              className="text-xs text-white/50 hover:text-white/80 mt-2"
            >
              Se déconnecter
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PinInput({
  value,
  onChange,
  autoFocus,
  placeholder,
  autoSubmit: _autoSubmit,
  onComplete: _onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  autoSubmit?: boolean;
  onComplete?: () => void;
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      pattern="\d{4}"
      maxLength={4}
      autoFocus={autoFocus}
      placeholder={placeholder ?? "••••"}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      className="w-full text-center text-4xl font-display font-bold tracking-[0.8em] bg-white/10 text-white placeholder:text-white/30 rounded-2xl h-16 outline-none border-2 border-transparent focus:border-brand-gold"
    />
  );
}

function OnboardingGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchProfile = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const onOnboarding = pathname.startsWith("/onboarding");
  const profile = data?.profile;
  const needsOnboarding = !!profile && profile.role_in_pos === "OWNER" && !profile.onboarding_completed_at;

  useEffect(() => {
    if (!profile) return;
    if (needsOnboarding && !onOnboarding) {
      navigate({ to: "/onboarding/profile", replace: true });
    }
  }, [needsOnboarding, onOnboarding, profile, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-sand">
        <p className="text-brand-green/60 text-sm">Chargement…</p>
      </div>
    );
  }

  if (needsOnboarding && !onOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-sand">
        <p className="text-brand-green/60 text-sm">Redirection…</p>
      </div>
    );
  }

  return (
    <>
      <Outlet />
      {!onOnboarding && <BottomBar />}
    </>
  );
}
