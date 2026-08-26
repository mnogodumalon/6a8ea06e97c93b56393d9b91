/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'mitarbeiter'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.mitarbeiter.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.mitarbeiter.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.mitarbeiter.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.mitarbeiter              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   mitarbeiter: vorname, nachname, email, telefon, abteilung, position, beschaeftigungsart, notizen  ·  ← schichtplan (list + contextual +)
 *   schichten: schicht_name, kuerzel, startzeit, endzeit, schicht_beschreibung, schicht_typ  ·  ← schichtplan (list + contextual +)
 *   schichtplan: datum, mitarbeiter, schicht, arbeitsbereich, anmerkungen  ·  → mitarbeiter · → schichten
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Mitarbeiter, Schichten, Schichtplan } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichSchichtplan } from '@/lib/enrich';
import type { EnrichedSchichtplan } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { MitarbeiterDialog, type MitarbeiterDialogDefaults } from '@/components/dialogs/MitarbeiterDialog';
import { MitarbeiterDetails } from '@/components/details/MitarbeiterDetails';
import { SchichtenDialog, type SchichtenDialogDefaults } from '@/components/dialogs/SchichtenDialog';
import { SchichtenDetails } from '@/components/details/SchichtenDetails';
import { SchichtplanDialog, type SchichtplanDialogDefaults } from '@/components/dialogs/SchichtplanDialog';
import { SchichtplanDetails } from '@/components/details/SchichtplanDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'mitarbeiter'; record: Mitarbeiter }
  | { type: 'schichten'; record: Schichten }
  | { type: 'schichtplan'; record: EnrichedSchichtplan };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  mitarbeiter: EntityCrudApi<Mitarbeiter, MitarbeiterDialogDefaults>;
  schichten: EntityCrudApi<Schichten, SchichtenDialogDefaults>;
  schichtplan: EntityCrudApi<Schichtplan, SchichtplanDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { mitarbeiter: Mitarbeiter[]; schichten: Schichten[]; schichtplan: EnrichedSchichtplan[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [mitarbeiterDialog, setMitarbeiterDialog] = useState<{ defaults?: MitarbeiterDialogDefaults; editing?: Mitarbeiter } | null>(null);
  const [schichtenDialog, setSchichtenDialog] = useState<{ defaults?: SchichtenDialogDefaults; editing?: Schichten } | null>(null);
  const [schichtplanDialog, setSchichtplanDialog] = useState<{ defaults?: SchichtplanDialogDefaults; editing?: Schichtplan } | null>(null);
  const enrichedSchichtplan = useMemo(() => enrichSchichtplan(data.schichtplan, { mitarbeiterMap: data.mitarbeiterMap, schichtenMap: data.schichtenMap }), [data.schichtplan, data.mitarbeiterMap, data.schichtenMap]);

  function detailMitarbeiter(record: Mitarbeiter, push = false) {
    const item: OverlayItem = { type: 'mitarbeiter', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitMitarbeiter(fields: Mitarbeiter['fields']) {
    const editing = mitarbeiterDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setMitarbeiter(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateMitarbeiterEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('mitarbeiter')} — ${t('crud_updated')}`, async () => {
        data.setMitarbeiter(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateMitarbeiterEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createMitarbeiterEntry(fields);
      undoToast(`${appLabel('mitarbeiter')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailSchichten(record: Schichten, push = false) {
    const item: OverlayItem = { type: 'schichten', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitSchichten(fields: Schichten['fields']) {
    const editing = schichtenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setSchichten(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateSchichtenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('schichten')} — ${t('crud_updated')}`, async () => {
        data.setSchichten(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateSchichtenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createSchichtenEntry(fields);
      undoToast(`${appLabel('schichten')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailSchichtplan(record: Schichtplan, push = false) {
    const rec = enrichedSchichtplan.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'schichtplan', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitSchichtplan(fields: Schichtplan['fields']) {
    const editing = schichtplanDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setSchichtplan(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateSchichtplanEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('schichtplan')} — ${t('crud_updated')}`, async () => {
        data.setSchichtplan(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateSchichtplanEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createSchichtplanEntry(fields);
      undoToast(`${appLabel('schichtplan')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <MitarbeiterDialog
        open={mitarbeiterDialog !== null}
        onClose={() => setMitarbeiterDialog(null)}
        onSubmit={submitMitarbeiter}
        defaultValues={mitarbeiterDialog?.defaults}
        recordId={mitarbeiterDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Mitarbeiter']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitarbeiter']}
      />
      <SchichtenDialog
        open={schichtenDialog !== null}
        onClose={() => setSchichtenDialog(null)}
        onSubmit={submitSchichten}
        defaultValues={schichtenDialog?.defaults}
        recordId={schichtenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Schichten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Schichten']}
      />
      <SchichtplanDialog
        open={schichtplanDialog !== null}
        onClose={() => setSchichtplanDialog(null)}
        onSubmit={submitSchichtplan}
        defaultValues={schichtplanDialog?.defaults}
        recordId={schichtplanDialog?.editing?.record_id}
        mitarbeiterList={data.mitarbeiter}
        schichtenList={data.schichten}
        enablePhotoScan={AI_PHOTO_SCAN['Schichtplan']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Schichtplan']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'mitarbeiter') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('mitarbeiter')} subtitle={undefined} />
                <MitarbeiterDetails
                  record={top.record}
                  schichtplanList={data.schichtplan}
                  onOpenSchichtplan={(r) => detailSchichtplan(r, true)}
                  onAddSchichtplan={() => setSchichtplanDialog({ defaults: { mitarbeiter: createRecordUrl(APP_IDS.MITARBEITER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'schichten') {
            return (
              <>
                <RecordHeader title={top.record.fields.schicht_name ?? appLabel('schichten')} subtitle={undefined} />
                <SchichtenDetails
                  record={top.record}
                  schichtplanList={data.schichtplan}
                  onOpenSchichtplan={(r) => detailSchichtplan(r, true)}
                  onAddSchichtplan={() => setSchichtplanDialog({ defaults: { schicht: createRecordUrl(APP_IDS.SCHICHTEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'schichtplan') {
            return (
              <>
                <RecordHeader title={top.record.fields.arbeitsbereich ?? appLabel('schichtplan')} subtitle={top.record.fields.datum ? formatDate(top.record.fields.datum) : undefined} />
                <SchichtplanDetails
                  record={top.record}
                  mitarbeiterList={data.mitarbeiter}
                  onOpenMitarbeiter={(r) => detailMitarbeiter(r, true)}
                  schichtenList={data.schichten}
                  onOpenSchichten={(r) => detailSchichten(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'mitarbeiter') setMitarbeiterDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'schichten') setSchichtenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'schichtplan') setSchichtplanDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    mitarbeiter: {
      openCreate: (defaults?: MitarbeiterDialogDefaults) => setMitarbeiterDialog({ defaults }),
      openEdit: (record: Mitarbeiter) => setMitarbeiterDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Mitarbeiter) => detailMitarbeiter(record, false),
    },
    schichten: {
      openCreate: (defaults?: SchichtenDialogDefaults) => setSchichtenDialog({ defaults }),
      openEdit: (record: Schichten) => setSchichtenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Schichten) => detailSchichten(record, false),
    },
    schichtplan: {
      openCreate: (defaults?: SchichtplanDialogDefaults) => setSchichtplanDialog({ defaults }),
      openEdit: (record: Schichtplan) => setSchichtplanDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Schichtplan) => detailSchichtplan(record, false),
    },
    enriched: { mitarbeiter: data.mitarbeiter, schichten: data.schichten, schichtplan: enrichedSchichtplan },
  };
}
