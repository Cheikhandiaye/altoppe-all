import { useEffect } from "react";

type Props = {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  itemType?: string;
  itemName?: string;
  title?: string;
};

export function DeleteConfirmModal({ isOpen, onConfirm, onCancel, itemType, itemName, title }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-8 animate-in fade-in duration-150"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-150"
      >
        <h2 className="text-lg font-bold text-center text-[#1A1A1A] mb-3">
          {title ?? "Êtes-vous sûr ?"}
        </h2>
        <p className="text-sm text-center text-[#6B6B6B] mb-6 leading-relaxed">
          Cette action est irréversible.{" "}
          {itemName ? <strong className="text-[#1A1A1A]">{itemName}</strong> : itemType ?? "Cet élément"}{" "}
          sera définitivement supprimé.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border-[1.5px] border-[#1B4332] text-[#1B4332] font-semibold text-sm hover:bg-[#1B4332]/5 transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-[#C0392B] text-white font-semibold text-sm hover:bg-[#a8321f] transition"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
