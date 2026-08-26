import type { Schichtplan } from './app';

export type EnrichedSchichtplan = Schichtplan & {
  mitarbeiterName: string;
  schichtName: string;
};
