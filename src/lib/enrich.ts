import type { EnrichedSchichtplan } from '@/types/enriched';
import type { Mitarbeiter, Schichten, Schichtplan } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface SchichtplanMaps {
  mitarbeiterMap: Map<string, Mitarbeiter>;
  schichtenMap: Map<string, Schichten>;
}

export function enrichSchichtplan(
  schichtplan: Schichtplan[],
  maps: SchichtplanMaps
): EnrichedSchichtplan[] {
  return schichtplan.map(r => ({
    ...r,
    mitarbeiterName: resolveDisplay(r.fields.mitarbeiter, maps.mitarbeiterMap, 'vorname', 'nachname'),
    schichtName: resolveDisplay(r.fields.schicht, maps.schichtenMap, 'schicht_name'),
  }));
}
