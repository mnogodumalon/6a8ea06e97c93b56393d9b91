import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    { row: ['vorname', 'nachname'] },
    'email',
    'telefon',
    'abteilung',
    'position',
    'beschaeftigungsart',
    'notizen',
  ],
  defaults: {
    'beschaeftigungsart': { kind: 'lookup', key: 'vollzeit', label: 'Vollzeit' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
