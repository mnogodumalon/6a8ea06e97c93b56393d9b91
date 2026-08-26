import type { Schichtplan, Mitarbeiter, Schichten } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface SchichtplanDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Schichtplan;
  /** N:1-Ziel „Mitarbeiter": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitarbeiterList: Mitarbeiter[];
  /** Klick auf die Mitarbeiter-Relation → overlay.push auf dessen Detail. */
  onOpenMitarbeiter?: (record: Mitarbeiter) => void;
  /** N:1-Ziel „Schichten": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  schichtenList: Schichten[];
  /** Klick auf die Schichten-Relation → overlay.push auf dessen Detail. */
  onOpenSchichten?: (record: Schichten) => void;
}

export function SchichtplanDetails({
  record,
  mitarbeiterList,
  onOpenMitarbeiter,
  schichtenList,
  onOpenSchichten,
}: SchichtplanDetailsProps) {
  const mitarbeiterTarget = mitarbeiterList.find(r => r.record_id === extractRecordId(record.fields.mitarbeiter));
  const schichtTarget = schichtenList.find(r => r.record_id === extractRecordId(record.fields.schicht));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('schichtplan', 'datum')} value={record.fields.datum} format="date" />
        <RecordField label={fieldLabel('schichtplan', 'arbeitsbereich')} value={record.fields.arbeitsbereich} format="text" />
        <RecordField label={fieldLabel('schichtplan', 'anmerkungen')} value={record.fields.anmerkungen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('schichtplan', 'mitarbeiter')}
          name={mitarbeiterTarget?.fields.vorname ?? '—'}
          meta={[mitarbeiterTarget?.fields.email, mitarbeiterTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={mitarbeiterTarget && onOpenMitarbeiter ? () => onOpenMitarbeiter!(mitarbeiterTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('schichtplan', 'schicht')}
          name={schichtTarget?.fields.schicht_name ?? '—'}
          meta={[schichtTarget?.fields.kuerzel, schichtTarget?.fields.startzeit].filter(Boolean).join(' · ') || undefined}
          onClick={schichtTarget && onOpenSchichten ? () => onOpenSchichten!(schichtTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.SCHICHTPLAN} recordId={record.record_id} />
    </>
  );
}
