import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/settings.functions";
import { Languages, Check, Volume2 } from "lucide-react";
import {
  getAudioPrefs,
  setAudioPrefs,
  type AudioLang,
  type AudioPrefs,
} from "@/lib/audio-prefs";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/language")({
  component: LanguagePage,
});

const LANGUAGES = [
  { code: "fr" as const, label: "Français", native: "Français" },
  { code: "wo" as const, label: "Wolof", native: "Wolof" },
];

function LanguagePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const [lang, setLang] = useState<"fr" | "wo">("fr");
  const [busy, setBusy] = useState(false);
  const [audio, setAudio] = useState<AudioPrefs>({ textLang: "wo", amountLang: "wo" });

  useEffect(() => {
    if (data?.profile?.language) setLang(data.profile.language as "fr" | "wo");
  }, [data]);

  useEffect(() => {
    setAudio(getAudioPrefs());
  }, []);

  const save = async (code: "fr" | "wo") => {
    setLang(code);
    setBusy(true);
    try {
      await update({ data: { language: code } });
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(code === "fr" ? "Langue : Français" : "Làkk : Wolof");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    } finally {
      setBusy(false);
    }
  };

  const updateAudio = (patch: Partial<AudioPrefs>) => {
    const next = { ...audio, ...patch };
    setAudio(next);
    setAudioPrefs(next);
    toast.success("Préférence audio enregistrée");
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="bg-card rounded-2xl p-4 border border-brand-green/10 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
          <Languages className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-brand-green text-sm">Langue de l'application</p>
          <p className="text-xs text-brand-green/50">Choisissez votre langue préférée</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-brand-green/60">Chargement…</p>
      ) : (
        <div className="space-y-2">
          {LANGUAGES.map((l) => {
            const active = lang === l.code;
            return (
              <button
                key={l.code}
                onClick={() => save(l.code)}
                disabled={busy}
                className={`w-full flex items-center justify-between bg-card rounded-2xl p-4 border transition text-left ${
                  active
                    ? "border-brand-terracotta bg-brand-terracotta/5"
                    : "border-brand-green/10 hover:border-brand-terracotta/40"
                } disabled:opacity-60`}
              >
                <div>
                  <p className="font-semibold text-brand-green text-sm">{l.label}</p>
                  <p className="text-xs text-brand-green/50">{l.native}</p>
                </div>
                {active && (
                  <div className="w-7 h-7 rounded-full bg-brand-terracotta text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Audio reading preferences */}
      <div className="bg-card rounded-2xl p-4 border border-brand-green/10 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-gold/15 text-brand-green flex items-center justify-center">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-brand-green text-sm">Option de lecture audio</p>
            <p className="text-xs text-brand-green/50">Langue du texte et des montants</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-sm text-brand-green font-medium">Texte</p>
          <AudioToggle
            value={audio.textLang}
            onChange={(v) => updateAudio({ textLang: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-brand-green font-medium">Montant</p>
          <AudioToggle
            value={audio.amountLang}
            onChange={(v) => updateAudio({ amountLang: v })}
          />
        </div>
      </div>
    </div>
  );
}

function AudioToggle({
  value,
  onChange,
}: {
  value: AudioLang;
  onChange: (v: AudioLang) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-brand-green/5 p-1">
      {(["fr", "wo"] as AudioLang[]).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              active
                ? "bg-brand-terracotta text-white shadow-soft"
                : "text-brand-green/60 hover:text-brand-green"
            }`}
          >
            {opt === "fr" ? "Français" : "Wolof"}
          </button>
        );
      })}
    </div>
  );
}
