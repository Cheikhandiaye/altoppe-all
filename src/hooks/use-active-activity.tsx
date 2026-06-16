import { createContext, useContext, useCallback, type ReactNode } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyActivities, setActiveActivity } from "@/lib/activities.functions";

export type Activity = {
  id: string;
  name: string;
  emoji: string | null;
  is_archived: boolean;
  created_at: string;
};

type ActiveActivityCtx = {
  activities: Activity[];
  activeId: string | null;
  setActive: (id: string | null) => Promise<void>;
  refetch: () => Promise<void>;
  isLoading: boolean;
};

const Ctx = createContext<ActiveActivityCtx | null>(null);

export const myActivitiesQuery = queryOptions({
  queryKey: ["my-activities"],
  queryFn: () => listMyActivities(),
  staleTime: 60_000,
});

export function ActiveActivityProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyActivities);
  const setActiveFn = useServerFn(setActiveActivity);

  const q = useQuery({
    ...myActivitiesQuery,
    queryFn: () => fetchList(),
  });

  const setActive = useCallback(
    async (id: string | null) => {
      await setActiveFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["my-activities"] });
      // invalider toutes les vues dépendantes
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      await qc.invalidateQueries({ queryKey: ["voice-history"] });
      await qc.invalidateQueries({ queryKey: ["transactions-list"] });
    },
    [qc, setActiveFn],
  );

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["my-activities"] });
  }, [qc]);

  const value: ActiveActivityCtx = {
    activities: (q.data?.activities ?? []) as Activity[],
    activeId: q.data?.activeId ?? null,
    setActive,
    refetch,
    isLoading: q.isLoading,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveActivity(): ActiveActivityCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback no-op pour les pages hors provider
    return {
      activities: [],
      activeId: null,
      setActive: async () => {},
      refetch: async () => {},
      isLoading: false,
    };
  }
  return ctx;
}
