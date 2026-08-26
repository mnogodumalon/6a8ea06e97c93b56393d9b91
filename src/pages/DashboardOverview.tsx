import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { gruss, useClock, namen, undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';
import { extractRecordId, createRecordUrl, LivingAppsService } from '@/services/livingAppsService';
import { APP_IDS, lookupOption } from '@/types/app';
import {
  IconCalendarPlus,
  IconUsers,
  IconAlertCircle,
  IconClock,
  IconUserPlus,
} from '@tabler/icons-react';

const EVENT_PREFIX = 'schichtplan';
function schichtplanIdOf(id: string): string {
  return id.split(':')[1] ?? '';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    mitarbeiter,
    schichten,
    schichtplan,
    setSchichtplan,
    mitarbeiterMap,
    schichtenMap,
    loading,
    error,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data);
  const enrichedSchichtplan = crud.enriched.schichtplan;

  const clock = useClock();
  const [filterMitarbeiterId, setFilterMitarbeiterId] = useState<string | null>(null);

  // --- Derived state (all hooks above early returns) ---

  const todayKey = useMemo(() => format(clock, 'yyyy-MM-dd'), [clock]);
  const weekStart = useMemo(() => startOfWeek(clock, { weekStartsOn: 1 }), [clock]);
  const weekEnd = useMemo(() => endOfWeek(clock, { weekStartsOn: 1 }), [clock]);

  // All Schichtplan entries for today
  const heuteEintraege = useMemo(
    () => schichtplan.filter(e => e.fields.datum?.startsWith(todayKey)),
    [schichtplan, todayKey],
  );

  // Mitarbeiter IDs that have a shift today
  const mitarbeiterHeuteIds = useMemo(
    () => new Set(heuteEintraege.map(e => extractRecordId(e.fields.mitarbeiter)).filter(Boolean) as string[]),
    [heuteEintraege],
  );

  // Mitarbeiter with no shift today
  const ohneSchichtHeute = useMemo(
    () => mitarbeiter.filter(m => !mitarbeiterHeuteIds.has(m.record_id)),
    [mitarbeiter, mitarbeiterHeuteIds],
  );

  // Schichtplan entries this week
  const dieseWocheEintraege = useMemo(
    () => schichtplan.filter(e => {
      if (!e.fields.datum) return false;
      const d = parseISO(e.fields.datum);
      return d >= weekStart && d <= weekEnd;
    }),
    [schichtplan, weekStart, weekEnd],
  );

  // Unique mitarbeiter scheduled this week
  const mitarbeiterDieseWocheIds = useMemo(
    () => new Set(dieseWocheEintraege.map(e => extractRecordId(e.fields.mitarbeiter)).filter(Boolean) as string[]),
    [dieseWocheEintraege],
  );

  // Mitarbeiter without any shift this week
  const ohneSchichtDieseWoche = useMemo(
    () => mitarbeiter.filter(m => !mitarbeiterDieseWocheIds.has(m.record_id)),
    [mitarbeiter, mitarbeiterDieseWocheIds],
  );

  // ResourceTimeline groups = Mitarbeiter rows (filter by selected if any)
  const groups = useMemo<ResourceGroup[]>(
    () => mitarbeiter
      .filter(m => !filterMitarbeiterId || m.record_id === filterMitarbeiterId)
      .map(m => ({
        key: m.record_id,
        label: [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || m.record_id,
      })),
    [mitarbeiter, filterMitarbeiterId],
  );

  // ResourceTimeline events = Schichtplan entries
  const events = useMemo<ResourceEvent[]>(
    () =>
      schichtplan
        .filter(e => !!e.fields.datum && !!e.fields.mitarbeiter)
        .map(e => {
          const mitarbeiterId = extractRecordId(e.fields.mitarbeiter) ?? '';
          const schichtId = extractRecordId(e.fields.schicht) ?? '';
          const schicht = schichtenMap.get(schichtId);
          const schichtName = schicht?.fields.schicht_name ?? tx('Schicht');
          const schichtTyp = schicht?.fields.schicht_typ?.key ?? 'tagschicht';

          const tone =
            schichtTyp === 'fruehschicht' ? 'primary'
            : schichtTyp === 'spaetschicht' ? 'warning'
            : schichtTyp === 'nachtschicht' ? 'destructive'
            : 'default';

          return {
            id: `${EVENT_PREFIX}:${e.record_id}`,
            start: e.fields.datum!,
            allDay: true,
            title: schichtName,
            subtitle: e.fields.arbeitsbereich,
            tone,
            group: mitarbeiterId,
          };
        }),
    [schichtplan, schichtenMap],
  );

  // Optimistic reschedule handler
  const handleEventDrop = useCallback(
    async (id: string, newStart: string, _newEnd?: string, newGroup?: string) => {
      const rid = schichtplanIdOf(id);
      if (!rid) return;
      const before = schichtplan.find(e => e.record_id === rid);
      if (!before) return;

      const mitarbeiterPatch = newGroup
        ? { mitarbeiter: createRecordUrl(APP_IDS.MITARBEITER, newGroup) }
        : {};

      setSchichtplan(prev =>
        prev.map(e =>
          e.record_id === rid
            ? { ...e, fields: { ...e.fields, datum: newStart, ...mitarbeiterPatch } }
            : e,
        ),
      );

      const mitarbeiterName = newGroup
        ? (() => {
            const m = mitarbeiterMap.get(newGroup);
            return [m?.fields.vorname, m?.fields.nachname].filter(Boolean).join(' ') || tx('Mitarbeiter');
          })()
        : before && (() => {
            const mid = extractRecordId(before.fields.mitarbeiter);
            const m = mid ? mitarbeiterMap.get(mid) : undefined;
            return [m?.fields.vorname, m?.fields.nachname].filter(Boolean).join(' ') || tx('Mitarbeiter');
          })();

      undoToast(
        tx`${mitarbeiterName} — verschoben auf ${formatDate(newStart)}`,
        async () => {
          setSchichtplan(prev =>
            prev.map(e =>
              e.record_id === rid
                ? { ...e, fields: { ...e.fields, datum: before.fields.datum, mitarbeiter: before.fields.mitarbeiter } }
                : e,
            ),
          );
          try {
            await LivingAppsService.updateSchichtplanEntry(rid, {
              datum: before.fields.datum,
              mitarbeiter: before.fields.mitarbeiter,
            });
          } catch {
            await fetchAll();
          }
        },
      );

      try {
        await LivingAppsService.updateSchichtplanEntry(rid, {
          datum: newStart,
          ...mitarbeiterPatch,
        });
      } catch {
        await fetchAll();
      }
    },
    [schichtplan, setSchichtplan, mitarbeiterMap, fetchAll],
  );

  // Today's shifts for the WorkList
  const heuteWorkItems = useMemo(
    () =>
      heuteEintraege
        .map(e => {
          const mid = extractRecordId(e.fields.mitarbeiter);
          const m = mid ? mitarbeiterMap.get(mid) : undefined;
          const sid = extractRecordId(e.fields.schicht);
          const s = sid ? schichtenMap.get(sid) : undefined;
          const name = [m?.fields.vorname, m?.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
          const schichtLabel = s?.fields.schicht_name ?? tx('Schicht');
          const zeitraum =
            s?.fields.startzeit && s?.fields.endzeit
              ? `${s.fields.startzeit}–${s.fields.endzeit}`
              : tx('Ganztags');
          return {
            id: e.record_id,
            title: name,
            secondLine: (
              <span className="text-muted-foreground text-sm">
                {schichtLabel}
                {e.fields.arbeitsbereich ? ` · ${e.fields.arbeitsbereich}` : ''} · {zeitraum}
              </span>
            ),
          };
        })
        .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')),
    [heuteEintraege, mitarbeiterMap, schichtenMap],
  );

  // Week without shift WorkList
  const ohneSchichtWorkItems = useMemo(
    () =>
      ohneSchichtDieseWoche.slice(0, 5).map(m => {
        const name = [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || tx('Mitarbeiter');
        return {
          id: m.record_id,
          title: name,
          secondLine: (
            <span className="text-muted-foreground text-sm">
              {m.fields.position ?? m.fields.abteilung ?? tx('Keine Schicht diese Woche')}
            </span>
          ),
          action: {
            label: tx('Einplanen'),
            onClick: () => {
              crud.schichtplan.openCreate({
                mitarbeiter: m.record_id,
                datum: todayKey,
              });
            },
          },
        };
      }),
    [ohneSchichtDieseWoche, todayKey, crud],
  );

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // --- Plain derivations below ---

  const schichtenHeute = heuteEintraege.length;
  const mitarbeiterGesamt = mitarbeiter.length;
  const ohneSchichtAnzahl = ohneSchichtHeute.length;
  const nextNachrichtenNamen = ohneSchichtAnzahl > 0
    ? namen(ohneSchichtHeute.slice(0, 3).map(m => m.fields.vorname ?? m.fields.nachname ?? ''))
    : '';

  // Context line
  const contextLine = schichtenHeute > 0
    ? schichtenHeute === 1
      ? tx`Heute 1 Schicht belegt — ${namen(heuteEintraege.slice(0, 3).map(e => {
          const mid = extractRecordId(e.fields.mitarbeiter);
          const m = mid ? mitarbeiterMap.get(mid) : undefined;
          return m?.fields.vorname ?? '';
        }))} im Dienst.`
      : tx`Heute ${schichtenHeute} Schichten — ${namen(heuteEintraege.slice(0, 3).map(e => {
          const mid = extractRecordId(e.fields.mitarbeiter);
          const m = mid ? mitarbeiterMap.get(mid) : undefined;
          return m?.fields.vorname ?? '';
        }))} im Dienst.`
    : mitarbeiterGesamt === 0
    ? tx('Noch keine Mitarbeiter angelegt.')
    : tx('Heute noch keine Schichten geplant.');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.schichtplan.openCreate({ datum: todayKey })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <IconCalendarPlus size={16} className="shrink-0" />
          {tx('Schicht planen')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          ohneSchichtAnzahl > 0
            ? (
              <HeroBanner
                icon={<IconAlertCircle size={18} />}
                action={{
                  label: tx('Jetzt einplanen'),
                  onClick: () => {
                    const first = ohneSchichtHeute[0];
                    if (first) {
                      crud.schichtplan.openCreate({
                        mitarbeiter: first.record_id,
                        datum: todayKey,
                      });
                    }
                  },
                }}
              >
                {tx`${nextNachrichtenNamen} — heute noch nicht eingeplant.`}
              </HeroBanner>
            )
            : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Heute im Dienst')}
              value={schichtenHeute}
              icon={<IconClock size={16} />}
              tone={schichtenHeute > 0 ? 'success' : 'default'}
              onClick={() => setFilterMitarbeiterId(null)}
            />
            <StatStripItem
              title={tx('Mitarbeiter gesamt')}
              value={mitarbeiterGesamt}
              icon={<IconUsers size={16} />}
              tone="default"
            />
            <StatStripItem
              title={tx('Ohne Schicht heute')}
              value={ohneSchichtAnzahl}
              icon={<IconUserPlus size={16} />}
              tone={ohneSchichtAnzahl > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Schichten diese Woche')}
              value={dieseWocheEintraege.length}
              icon={<IconCalendarPlus size={16} />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          mitarbeiterGesamt === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center gap-4">
              <IconUsers size={48} className="text-muted-foreground" stroke={1.5} />
              <div>
                <p className="font-semibold text-foreground">{tx('Noch keine Mitarbeiter')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tx('Lege zuerst Mitarbeiter an, dann kannst du Schichten planen.')}
                </p>
              </div>
              <button
                onClick={() => crud.mitarbeiter.openCreate({})}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                <IconUserPlus size={16} className="shrink-0" />
                {tx('Ersten Mitarbeiter anlegen')}
              </button>
            </div>
          ) : (
            <ResourceTimeline
              events={events}
              groups={groups}
              axis="day"
              defaultRange="week"
              weekDays={5}
              defaultDate={clock}
              locale={dateFnsLocale()}
              onEventClick={ev => {
                const rid = schichtplanIdOf(ev.id);
                const record = schichtplan.find(e => e.record_id === rid);
                if (record) crud.schichtplan.openDetail(record);
              }}
              onEmptyClick={(date, group) => {
                crud.schichtplan.openCreate({
                  datum: format(date, 'yyyy-MM-dd'),
                  mitarbeiter: group ?? undefined,
                });
              }}
              onRangeCreate={(start, _end, group) => {
                crud.schichtplan.openCreate({
                  datum: format(start, 'yyyy-MM-dd'),
                  mitarbeiter: group ?? undefined,
                });
              }}
              onEventDrop={handleEventDrop}
            />
          )
        }
        aside={
          <>
            <WorkList
              title={tx('Heute im Dienst')}
              items={heuteWorkItems}
              onItemClick={id => {
                const record = schichtplan.find(e => e.record_id === id);
                if (record) crud.schichtplan.openDetail(record);
              }}
              empty={{
                text: tx('Heute noch niemand eingeplant.'),
                action: {
                  label: tx('Schicht planen'),
                  onClick: () => crud.schichtplan.openCreate({ datum: todayKey }),
                },
              }}
            />
            <WorkList
              title={tx('Diese Woche ohne Schicht')}
              items={ohneSchichtWorkItems}
              onItemClick={id => {
                const record = mitarbeiter.find(m => m.record_id === id);
                if (record) crud.mitarbeiter.openDetail(record);
              }}
              empty={{ text: tx('Alle Mitarbeiter haben diese Woche Schichten.') }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
