import { createContext, useContext, useCallback, type ReactNode } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyPOS, setActivePOSFn } from "@/lib/pos.functions";

export type POS = {
  id: string;
  code: string;
  name: string;
  is_archived: boolean;
  created_at: string;
};

type Ctx = {
  pos: POS[];
  isSeller: boolean;
  sellerPosId: string | null;
  /** For owner: server-persisted default POS. For seller: their forced POS. */
  activePosId: string | null;
  setActivePos: (id: string) => Promise<void>;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export const myPOSQuery = queryOptions({
  queryKey: ["my-pos"],
  queryFn: () => listMyPOS(),
  staleTime: 60_000,
});

export function POSProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyPOS);
  const setActiveFn = useServerFn(setActivePOSFn);
  const q = useQuery({ ...myPOSQuery, queryFn: () => fetchList() });

  const list = (q.data?.pos ?? []) as POS[];
  const isSeller = q.data?.isSeller ?? false;
  const sellerPosId = q.data?.sellerPosId ?? null;
  const activePosId = (q.data?.activePosId as string | null | undefined) ?? null;

  const setActivePos = useCallback(
    async (id: string) => {
      if (isSeller) return;
      await setActiveFn({ data: { posId: id } });
      await qc.invalidateQueries({ queryKey: ["my-pos"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["transactions-list"] });
    },
    [isSeller, setActiveFn, qc],
  );

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["my-pos"] });
  }, [qc]);

  return (
    <C.Provider value={{ pos: list, isSeller, sellerPosId, activePosId, setActivePos, isLoading: q.isLoading, refetch }}>
      {children}
    </C.Provider>
  );
}

export function usePOS(): Ctx {
  const ctx = useContext(C);
  if (!ctx) {
    return {
      pos: [],
      isSeller: false,
      sellerPosId: null,
      activePosId: null,
      setActivePos: async () => {},
      isLoading: false,
      refetch: async () => {},
    };
  }
  return ctx;
}
