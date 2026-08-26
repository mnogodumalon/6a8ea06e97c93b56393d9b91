/**
 * Schicht Einplanen — 3-Schritt-Wizard.
 * Steps: 1) Mitarbeiter wählen → 2) Schicht wählen → 3) Datum & Bestätigung → Anlegen.
 * Reads: mitarbeiter, schichten. Writes: schichtplan (createSchichtplanEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconUserPlus, IconClock, IconBriefcase } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function SchichtEinplanenPage() {
  const { mitarbeiter, schichten, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedMitarbeiterId, setSelectedMitarbeiterId] = useState<string | null>(null);
  const [selectedSchichtId, setSelectedSchichtId] = useState<string | null>(null);
  const [datum, setDatum] = useState('');
  const [arbeitsbereich, setArbeitsbereich] = useState('');
  const [anmerkungen, setAnmerkungen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Mini-form state for creating a new Mitarbeiter
  const [showCreateMitarbeiter, setShowCreateMitarbeiter] = useState(false);
  const [newVorname, setNewVorname] = useState('');
  const [newNachname, setNewNachname] = useState('');
  const [newAbteilung, setNewAbteilung] = useState('');
  const [creatingMitarbeiter, setCreatingMitarbeiter] = useState(false);

  // Mini-form state for creating a new Schicht
  const [showCreateSchicht, setShowCreateSchicht] = useState(false);
  const [newSchichtName, setNewSchichtName] = useState('');
  const [newStartzeit, setNewStartzeit] = useState('');
  const [newEndzeit, setNewEndzeit] = useState('');
  const [creatingSchicht, setCreatingSchicht] = useState(false);

  const selectedMitarbeiter = mitarbeiter.find(m => m.record_id === selectedMitarbeiterId);
  const selectedSchicht = schichten.find(s => s.record_id === selectedSchichtId);

  const handleSelectMitarbeiter = (id: string) => {
    setSelectedMitarbeiterId(id);
    setStep(2);
  };

  const handleSelectSchicht = (id: string) => {
    setSelectedSchichtId(id);
    setStep(3);
  };

  const handleCreateMitarbeiter = async () => {
    if (!newVorname || !newNachname) return;
    setCreatingMitarbeiter(true);
    try {
      const created = await LivingAppsService.createMitarbeiterEntry({
        vorname: newVorname,
        nachname: newNachname,
        abteilung: newAbteilung || undefined,
      });
      await fetchAll();
      setShowCreateMitarbeiter(false);
      setNewVorname('');
      setNewNachname('');
      setNewAbteilung('');
      setSelectedMitarbeiterId(created.record_id);
      setStep(2);
    } finally {
      setCreatingMitarbeiter(false);
    }
  };

  const handleCreateSchicht = async () => {
    if (!newSchichtName || !newStartzeit || !newEndzeit) return;
    setCreatingSchicht(true);
    try {
      const created = await LivingAppsService.createSchichtenEntry({
        schicht_name: newSchichtName,
        startzeit: newStartzeit,
        endzeit: newEndzeit,
      });
      await fetchAll();
      setShowCreateSchicht(false);
      setNewSchichtName('');
      setNewStartzeit('');
      setNewEndzeit('');
      setSelectedSchichtId(created.record_id);
      setStep(3);
    } finally {
      setCreatingSchicht(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMitarbeiterId || !selectedSchichtId || !datum) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createSchichtplanEntry({
        datum: datum,
        mitarbeiter: createRecordUrl(APP_IDS.MITARBEITER, selectedMitarbeiterId),
        schicht: createRecordUrl(APP_IDS.SCHICHTEN, selectedSchichtId),
        arbeitsbereich: arbeitsbereich || undefined,
        anmerkungen: anmerkungen || undefined,
      });
      setSuccess(true);
    } catch (e) {
      setSubmitError(tx('Der Eintrag konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedMitarbeiterId(null);
    setSelectedSchichtId(null);
    setDatum('');
    setArbeitsbereich('');
    setAnmerkungen('');
    setSubmitError(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-100 p-4">
            <IconBriefcase size={40} className="text-emerald-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">{tx('Schicht erfolgreich eingeplant')}</h2>
          {selectedMitarbeiter && selectedSchicht && (
            <p className="text-muted-foreground text-sm">
              {selectedMitarbeiter.fields.nachname}, {selectedMitarbeiter.fields.vorname}
              {' — '}{selectedSchicht.fields.schicht_name}
              {datum && ` · ${format(new Date(datum + 'T12:00:00'), 'dd.MM.yyyy')}`}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleReset} variant="default">
            {tx('Weitere Schicht einplanen')}
          </Button>
          <a href="#/">
            <Button variant="outline" className="w-full sm:w-auto">
              {tx('Zurück zum Dashboard')}
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Schicht einplanen')}
      subtitle={tx('Mitarbeiter, Schicht und Datum festlegen')}
      steps={[
        { label: tx('Mitarbeiter') },
        { label: tx('Schicht') },
        { label: tx('Datum & Bestätigung') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Mitarbeiter wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={mitarbeiter.map(m => ({
            id: m.record_id,
            title: `${m.fields.nachname ?? ''}, ${m.fields.vorname ?? ''}`.trim().replace(/^,\s*/, ''),
            subtitle: [m.fields.abteilung, m.fields.beschaeftigungsart?.label].filter(Boolean).join(' · '),
            icon: <IconUserPlus size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectMitarbeiter}
          createLabel={tx('Neuen Mitarbeiter anlegen')}
          onCreateNew={() => setShowCreateMitarbeiter(true)}
          searchPlaceholder={tx('Mitarbeiter suchen …')}
          emptyText={tx('Kein Mitarbeiter gefunden')}
          createDialog={showCreateMitarbeiter && (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{tx('Neuen Mitarbeiter anlegen')}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Vorname')}</Label>
                  <Input
                    value={newVorname}
                    onChange={e => setNewVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Nachname')}</Label>
                  <Input
                    value={newNachname}
                    onChange={e => setNewNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{tx('Abteilung (optional)')}</Label>
                <Input
                  value={newAbteilung}
                  onChange={e => setNewAbteilung(e.target.value)}
                  placeholder={tx('Abteilung')}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={!newVorname || !newNachname || creatingMitarbeiter}
                  onClick={handleCreateMitarbeiter}
                  size="sm"
                >
                  {creatingMitarbeiter ? tx('Wird angelegt …') : tx('Anlegen')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateMitarbeiter(false)}
                >
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* Step 2: Schicht wählen */}
      {step === 2 && (
        selectedMitarbeiterId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-muted-foreground">
                {tx('Mitarbeiter:')}
              </span>
              <span className="text-xs font-medium text-foreground">
                {selectedMitarbeiter?.fields.nachname}, {selectedMitarbeiter?.fields.vorname}
              </span>
            </div>
            <EntitySelectStep
              items={schichten.map(s => ({
                id: s.record_id,
                title: s.fields.schicht_name ?? '',
                subtitle: s.fields.startzeit && s.fields.endzeit
                  ? `${s.fields.startzeit} – ${s.fields.endzeit}`
                  : s.fields.startzeit ?? '',
                icon: <IconClock size={20} className="text-primary" />,
                status: s.fields.schicht_typ
                  ? { key: s.fields.schicht_typ.key, label: s.fields.schicht_typ.label }
                  : undefined,
              }))}
              onSelect={handleSelectSchicht}
              createLabel={tx('Neue Schicht anlegen')}
              onCreateNew={() => setShowCreateSchicht(true)}
              searchPlaceholder={tx('Schicht suchen …')}
              emptyText={tx('Keine Schicht gefunden')}
              createDialog={showCreateSchicht && (
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">{tx('Neue Schicht anlegen')}</p>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{tx('Schichtname')}</Label>
                    <Input
                      value={newSchichtName}
                      onChange={e => setNewSchichtName(e.target.value)}
                      placeholder={tx('z. B. Frühschicht')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Startzeit')}</Label>
                      <Input
                        value={newStartzeit}
                        onChange={e => setNewStartzeit(e.target.value)}
                        placeholder={tx('z. B. 06:00')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Endzeit')}</Label>
                      <Input
                        value={newEndzeit}
                        onChange={e => setNewEndzeit(e.target.value)}
                        placeholder={tx('z. B. 14:00')}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={!newSchichtName || !newStartzeit || !newEndzeit || creatingSchicht}
                      onClick={handleCreateSchicht}
                      size="sm"
                    >
                      {creatingSchicht ? tx('Wird angelegt …') : tx('Anlegen')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateSchicht(false)}
                    >
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
            />
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* Step 3: Datum und Bestätigung */}
      {step === 3 && (
        selectedMitarbeiterId && selectedSchichtId ? (
          <div className="space-y-6">
            {/* Summary of previous selections */}
            <div className="rounded-2xl border bg-secondary/40 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{tx('Zusammenfassung')}</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <IconUserPlus size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedMitarbeiter?.fields.nachname}, {selectedMitarbeiter?.fields.vorname}
                    </p>
                    {(selectedMitarbeiter?.fields.abteilung || selectedMitarbeiter?.fields.beschaeftigungsart) && (
                      <p className="text-xs text-muted-foreground">
                        {[selectedMitarbeiter.fields.abteilung, selectedMitarbeiter.fields.beschaeftigungsart?.label].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <IconClock size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {selectedSchicht?.fields.schicht_name}
                      </p>
                      {selectedSchicht?.fields.schicht_typ && (
                        <StatusBadge
                          statusKey={selectedSchicht.fields.schicht_typ.key}
                          label={selectedSchicht.fields.schicht_typ.label}
                        />
                      )}
                    </div>
                    {selectedSchicht?.fields.startzeit && selectedSchicht?.fields.endzeit && (
                      <p className="text-xs text-muted-foreground">
                        {selectedSchicht.fields.startzeit} – {selectedSchicht.fields.endzeit}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Date and details form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  {tx('Datum')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={datum}
                  onChange={e => setDatum(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  {tx('Arbeitsbereich')} <span className="text-muted-foreground text-xs">{tx('(optional)')}</span>
                </Label>
                <Input
                  value={arbeitsbereich}
                  onChange={e => setArbeitsbereich(e.target.value)}
                  placeholder={tx('z. B. Empfang, Lager, Produktion')}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  {tx('Anmerkungen')} <span className="text-muted-foreground text-xs">{tx('(optional)')}</span>
                </Label>
                <Textarea
                  value={anmerkungen}
                  onChange={e => setAnmerkungen(e.target.value)}
                  placeholder={tx('Besondere Hinweise zur Schicht …')}
                  rows={3}
                />
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                {submitError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleSubmit}
                disabled={!datum || submitting}
                className="sm:flex-1"
              >
                {submitting ? tx('Wird angelegt …') : tx('Schicht einplanen')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
