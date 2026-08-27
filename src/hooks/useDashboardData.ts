import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Mitarbeiter, Schichten, Schichtplan } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { t } from '@/i18n';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
export function useDashboardData() {
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [schichten, setSchichten] = useState<Schichten[]>([]);
  const [schichtplan, setSchichtplan] = useState<Schichtplan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [mitarbeiterData, schichtenData, schichtplanData] = await Promise.all([
        LivingAppsService.getMitarbeiter(),
        LivingAppsService.getSchichten(),
        LivingAppsService.getSchichtplan(),
      ]);
      setMitarbeiter(mitarbeiterData);
      setSchichten(schichtenData);
      setSchichtplan(schichtplanData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t('data_load_failed')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [mitarbeiterData, schichtenData, schichtplanData] = await Promise.all([
          LivingAppsService.getMitarbeiter(),
          LivingAppsService.getSchichten(),
          LivingAppsService.getSchichtplan(),
        ]);
        setMitarbeiter(mitarbeiterData);
        setSchichten(schichtenData);
        setSchichtplan(schichtplanData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    // assistant:data-changed comes from the assistant (<la-klar-assistant>)
    // after every mutation. The element additionally fires the legacy
    // dashboard-refresh event for OLD deployed bundles — do NOT subscribe to
    // both here, or every mutation fetches twice.
    window.addEventListener('assistant:data-changed', handleRefresh);
    return () => window.removeEventListener('assistant:data-changed', handleRefresh);
  }, []);

  const mitarbeiterMap = useMemo(() => {
    const m = new Map<string, Mitarbeiter>();
    mitarbeiter.forEach(r => m.set(r.record_id, r));
    return m;
  }, [mitarbeiter]);

  const schichtenMap = useMemo(() => {
    const m = new Map<string, Schichten>();
    schichten.forEach(r => m.set(r.record_id, r));
    return m;
  }, [schichten]);

  return { mitarbeiter, setMitarbeiter, schichten, setSchichten, schichtplan, setSchichtplan, loading, error, fetchAll, mitarbeiterMap, schichtenMap };
}

/** The hook's return — the `data` prop of DashboardOverview in the Ready-Wrapper form. */
export type DashboardData = ReturnType<typeof useDashboardData>;