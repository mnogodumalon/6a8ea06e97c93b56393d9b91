import type { Schichten, Schichtplan } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface SchichtenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Schichten;
  /** 1:N „Schichtplan" (schicht): VOLLE Liste — der Block filtert auf diesen Record. */
  schichtplanList: Schichtplan[];
  /** Zeilen-Klick → overlay.push auf das Schichtplan-Detail (nie der Edit-Dialog). */
  onOpenSchichtplan: (record: Schichtplan) => void;
  /** Kontextuelles „+": öffnet den Schichtplan-Dialog mit diesem Record vorgesetzt. */
  onAddSchichtplan: () => void;
}

export function SchichtenDetails({
  record,
  schichtplanList,
  onOpenSchichtplan,
  onAddSchichtplan,
}: SchichtenDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('schichten', 'schicht_name')} value={record.fields.schicht_name} format="text" />
        <RecordField label={fieldLabel('schichten', 'kuerzel')} value={record.fields.kuerzel} format="text" />
        <RecordField label={fieldLabel('schichten', 'startzeit')} value={record.fields.startzeit} format="text" />
        <RecordField label={fieldLabel('schichten', 'endzeit')} value={record.fields.endzeit} format="text" />
        <RecordField label={fieldLabel('schichten', 'schicht_beschreibung')} value={record.fields.schicht_beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('schichten', 'schicht_typ')} value={record.fields.schicht_typ} format="pill" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('schichtplan')}
        items={schichtplanList.filter(r => extractRecordId(r.fields.schicht) === record.record_id)}
        map={r => ({ name: r.fields.arbeitsbereich ?? appLabel('schichtplan'), meta: r.fields.datum })}
        onOpen={onOpenSchichtplan}
        onAdd={onAddSchichtplan}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.SCHICHTEN} recordId={record.record_id} />
    </>
  );
}
