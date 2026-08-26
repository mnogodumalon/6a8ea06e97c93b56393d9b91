import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Mitarbeiter {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    abteilung?: string;
    position?: string;
    beschaeftigungsart?: LookupValue;
    notizen?: string;
  };
}

export interface Schichten {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    schicht_name?: string;
    kuerzel?: string;
    startzeit?: string;
    endzeit?: string;
    schicht_beschreibung?: string;
    schicht_typ?: LookupValue;
  };
}

export interface Schichtplan {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    mitarbeiter?: RecordUrl; // applookup -> URL zu 'Mitarbeiter' Record
    schicht?: RecordUrl; // applookup -> URL zu 'Schichten' Record
    arbeitsbereich?: string;
    anmerkungen?: string;
  };
}

export const APP_IDS = {
  MITARBEITER: '6a8ea04e7c2210550919382e',
  SCHICHTEN: '6a8ea052f67a0c6efea828fa',
  SCHICHTPLAN: '6a8ea0537b01c9a80d7bc84c',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'mitarbeiter': {
    beschaeftigungsart: [{ key: "vollzeit", get label() { return lookupLabel('mitarbeiter', 'beschaeftigungsart', "vollzeit") ?? "Vollzeit"; } }, { key: "teilzeit", get label() { return lookupLabel('mitarbeiter', 'beschaeftigungsart', "teilzeit") ?? "Teilzeit"; } }, { key: "minijob", get label() { return lookupLabel('mitarbeiter', 'beschaeftigungsart', "minijob") ?? "Minijob"; } }, { key: "aushilfe", get label() { return lookupLabel('mitarbeiter', 'beschaeftigungsart', "aushilfe") ?? "Aushilfe"; } }],
  },
  'schichten': {
    schicht_typ: [{ key: "fruehschicht", get label() { return lookupLabel('schichten', 'schicht_typ', "fruehschicht") ?? "Frühschicht"; } }, { key: "spaetschicht", get label() { return lookupLabel('schichten', 'schicht_typ', "spaetschicht") ?? "Spätschicht"; } }, { key: "nachtschicht", get label() { return lookupLabel('schichten', 'schicht_typ', "nachtschicht") ?? "Nachtschicht"; } }, { key: "tagschicht", get label() { return lookupLabel('schichten', 'schicht_typ', "tagschicht") ?? "Tagschicht"; } }, { key: "sonderschicht", get label() { return lookupLabel('schichten', 'schicht_typ', "sonderschicht") ?? "Sonderschicht"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'mitarbeiter': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'abteilung': 'string/text',
    'position': 'string/text',
    'beschaeftigungsart': 'lookup/select',
    'notizen': 'string/textarea',
  },
  'schichten': {
    'schicht_name': 'string/text',
    'kuerzel': 'string/text',
    'startzeit': 'string/text',
    'endzeit': 'string/text',
    'schicht_beschreibung': 'string/textarea',
    'schicht_typ': 'lookup/select',
  },
  'schichtplan': {
    'datum': 'date/date',
    'mitarbeiter': 'applookup/select',
    'schicht': 'applookup/select',
    'arbeitsbereich': 'string/text',
    'anmerkungen': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateMitarbeiter = StripLookup<Mitarbeiter['fields']>;
export type CreateSchichten = StripLookup<Schichten['fields']>;
export type CreateSchichtplan = StripLookup<Schichtplan['fields']>;