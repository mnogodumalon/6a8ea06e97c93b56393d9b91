/**
 * Schicht tauschen — 4-Schritt-Wizard.
 * Steps: 1) Schichteintrag wählen (zukünftige Einträge) → 2) Mitarbeiter ersetzen →
 *        3) Schicht ersetzen → 4) Bestätigen & speichern.
 * Reads: schichtplan, mitarbeiter, schichten. Writes: schichtplan (updateSchichtplanEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { IconArrowRight, IconCheck, IconUser, IconCalendar, IconClock } from '@tabler/icons-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichSchichtplan } from '@/lib/enrich';
import type { EnrichedSchichtplan } from '@/types/enriched';
import type { Mitarbeiter, Schichten } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

const MITARBEITER_APP_ID = '6a8ea04e7c2210550919382e';
const SCHICHTEN_APP_ID = '6a8ea052f67a0c6efea828fa';

export default function SchichtTauschenPage() {
  const data = useDashboardData();
  const { schichtplan, mitarbeiter, schichten, mitarbeiterMap, schichtenMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<EnrichedSchichtplan | null>(null);
  const [selectedMitarbeiterId, setSelectedMitarbeiterId] = useState<string | null>(null);
  const [selectedSchichtId, setSelectedSchichtId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const enrichedSchichtplan = enrichSchichtplan(schichtplan, { mitarbeiterMap, schichtenMap });

  const futureEntries = enrichedSchichtplan.filter(
    e => e.fields.datum != null && e.fields.datum >= today
  );

  const selectedMitarbeiter: Mitarbeiter | undefined = selectedMitarbeiterId
    ? mitarbeiter.find(m => m.record_id === selectedMitarbeiterId)
    : undefined;

  const selectedSchicht: Schichten | undefined = selectedSchichtId
    ? schichten.find(s => s.record_id === selectedSchichtId)
    : undefined;

  const handleSelectEntry = (id: string) => {
    const entry = enrichedSchichtplan.find(e => e.record_id === id);
    if (!entry) return;
    setSelectedEntry(entry);

    // Pre-select current mitarbeiter
    const mitId = extractRecordId(entry.fields.mitarbeiter);
    setSelectedMitarbeiterId(mitId ?? null);

    // Pre-select current schicht
    const schId = extractRecordId(entry.fields.schicht);
    setSelectedSchichtId(schId ?? null);

    setStep(2);
  };

  const handleSelectMitarbeiter = (id: string) => {
    setSelectedMitarbeiterId(id);
    setStep(3);
  };

  const handleSelectSchicht = (id: string) => {
    setSelectedSchichtId(id);
    setStep(4);
  };

  const handleSubmit = async () => {
    if (!selectedEntry || !selectedMitarbeiterId || !selectedSchichtId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateSchichtplanEntry(selectedEntry.record_id, {
        mitarbeiter: createRecordUrl(MITARBEITER_APP_ID, selectedMitarbeiterId),
        schicht: createRecordUrl(SCHICHTEN_APP_ID, selectedSchichtId),
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Speichern. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedEntry(null);
    setSelectedMitarbeiterId(null);
    setSelectedSchichtId(null);
    setSubmitError(null);
    setDone(false);
    setStep(1);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-100 p-4">
              <IconCheck size={40} className="text-emerald-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold">{tx('Schicht erfolgreich getauscht')}</h2>
          {selectedEntry && (
            <p className="text-sm text-muted-foreground">
              {tx('Der Schichteintrag vom')} <b>{formatDate(selectedEntry.fields.datum)}</b> {tx('wurde aktualisiert.')}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleReset} variant="outline">
              {tx('Weiteren Tausch durchführen')}
            </Button>
            <a href="#/" className="text-sm text-muted-foreground hover:underline">
              {tx('Zurück zum Dashboard')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Schicht tauschen')}
      subtitle={tx('Mitarbeiter oder Schicht eines Eintrags ersetzen')}
      steps={[
        { label: tx('Eintrag') },
        { label: tx('Mitarbeiter') },
        { label: tx('Schicht') },
        { label: tx('Bestätigen') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Schichteintrag wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={futureEntries.map(e => ({
            id: e.record_id,
            title: `${e.mitarbeiterName || tx('Unbekannt')} — ${e.schichtName || tx('Unbekannte Schicht')}`,
            subtitle: e.fields.datum ? formatDate(e.fields.datum) : '—',
            icon: <IconCalendar size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectEntry}
          searchPlaceholder={tx('Eintrag suchen …')}
          emptyText={tx('Keine zukünftigen Schichteinträge gefunden')}
          emptyIcon={<IconCalendar size={40} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Mitarbeiter ersetzen */}
      {step === 2 && (
        selectedEntry ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-secondary/40 p-3 text-sm text-muted-foreground">
              {tx('Eintrag')}: <b>{selectedEntry.mitarbeiterName || tx('Unbekannt')}</b> — <b>{selectedEntry.schichtName || tx('Unbekannte Schicht')}</b>
              {selectedEntry.fields.datum && (
                <span className="ml-2">· {formatDate(selectedEntry.fields.datum)}</span>
              )}
            </div>
            <EntitySelectStep
              items={mitarbeiter.map(m => ({
                id: m.record_id,
                title: `${m.fields.nachname ?? ''} ${m.fields.vorname ?? ''}`.trim() || tx('Unbekannt'),
                subtitle: m.fields.abteilung ?? undefined,
                icon: <IconUser size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectMitarbeiter}
              searchPlaceholder={tx('Mitarbeiter suchen …')}
              emptyText={tx('Keine Mitarbeiter gefunden')}
              emptyIcon={<IconUser size={40} className="text-muted-foreground" />}
            />
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Zurück')}
              </Button>
              {selectedMitarbeiterId && (
                <Button onClick={() => setStep(3)}>
                  {tx('Weiter')} <IconArrowRight size={16} className="ml-1 shrink-0" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* Step 3: Schicht ersetzen */}
      {step === 3 && (
        selectedEntry ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-secondary/40 p-3 text-sm text-muted-foreground">
              {tx('Eintrag')}: <b>{selectedEntry.mitarbeiterName || tx('Unbekannt')}</b> — <b>{selectedEntry.schichtName || tx('Unbekannte Schicht')}</b>
              {selectedEntry.fields.datum && (
                <span className="ml-2">· {formatDate(selectedEntry.fields.datum)}</span>
              )}
            </div>
            <EntitySelectStep
              items={schichten.map(s => ({
                id: s.record_id,
                title: s.fields.schicht_name ?? tx('Unbekannte Schicht'),
                subtitle: s.fields.startzeit && s.fields.endzeit
                  ? `${s.fields.startzeit}–${s.fields.endzeit}`
                  : s.fields.startzeit ?? undefined,
                icon: <IconClock size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectSchicht}
              searchPlaceholder={tx('Schicht suchen …')}
              emptyText={tx('Keine Schichten gefunden')}
              emptyIcon={<IconClock size={40} className="text-muted-foreground" />}
            />
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                {tx('Zurück')}
              </Button>
              {selectedSchichtId && (
                <Button onClick={() => setStep(4)}>
                  {tx('Weiter')} <IconArrowRight size={16} className="ml-1 shrink-0" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* Step 4: Bestätigung */}
      {step === 4 && (
        selectedEntry && selectedMitarbeiterId && selectedSchichtId ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-4">
              <h3 className="font-semibold text-base">{tx('Zusammenfassung')}</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <IconCalendar size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Datum')}</p>
                    <p className="font-medium">
                      {selectedEntry.fields.datum ? formatDate(selectedEntry.fields.datum) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <IconUser size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Neuer Mitarbeiter')}</p>
                    <p className="font-medium">
                      {selectedMitarbeiter
                        ? `${selectedMitarbeiter.fields.nachname ?? ''} ${selectedMitarbeiter.fields.vorname ?? ''}`.trim()
                        : tx('Unbekannt')}
                    </p>
                    {selectedMitarbeiter?.fields.abteilung && (
                      <p className="text-xs text-muted-foreground">{selectedMitarbeiter.fields.abteilung}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <IconClock size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Neue Schicht')}</p>
                    <p className="font-medium">{selectedSchicht?.fields.schicht_name ?? tx('Unbekannte Schicht')}</p>
                    {selectedSchicht?.fields.startzeit && selectedSchicht?.fields.endzeit && (
                      <p className="text-xs text-muted-foreground">
                        {selectedSchicht.fields.startzeit}–{selectedSchicht.fields.endzeit}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
                {submitError}
              </p>
            )}

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(3)} disabled={submitting}>
                {tx('Zurück')}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? tx('Wird gespeichert …') : tx('Tausch bestätigen')}
                {!submitting && <IconCheck size={16} className="ml-1 shrink-0" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Bitte alle vorherigen Schritte abschließen.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
