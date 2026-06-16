import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green/60">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-brand-sand rounded-lg px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full bg-brand-sand rounded-lg px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

export function SelectOrOther({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const isPreset = !value || options.includes(value);
  const [mode, setMode] = useState<"preset" | "other">(isPreset ? "preset" : "other");
  return (
    <Field label={label}>
      <select
        value={mode === "other" ? "Autre" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "Autre") {
            setMode("other");
            onChange("");
          } else {
            setMode("preset");
            onChange(v);
          }
        }}
        className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {mode === "other" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Préciser…"
          className="mt-2 w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
        />
      )}
    </Field>
  );
}

export function PhotoUploader({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Photo importée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label="Photo / logo">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-brand-sand overflow-hidden flex items-center justify-center border border-brand-green/10 shrink-0">
          {value ? (
            <img src={value} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-brand-green/40">Aucune</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => galleryRef.current?.click()}
            className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded bg-brand-green text-white disabled:opacity-50">
            {busy ? "…" : "Galerie"}
          </button>
          <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()}
            className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded bg-brand-terracotta text-white disabled:opacity-50">
            Caméra
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")}
              className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded bg-brand-sand text-brand-green/70">
              Retirer
            </button>
          )}
        </div>
      </div>
      <input ref={galleryRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </Field>
  );
}
