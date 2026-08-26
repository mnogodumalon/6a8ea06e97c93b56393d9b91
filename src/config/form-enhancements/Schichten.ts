import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'schicht_name',
    'kuerzel',
    'startzeit',
    'endzeit',
    'schicht_typ',
    'schicht_beschreibung',
  ],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
