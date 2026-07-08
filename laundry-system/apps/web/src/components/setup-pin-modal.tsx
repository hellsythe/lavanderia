'use client';

import { Alert, Button, Input, Label } from '@lavanderpro/ui';
import { Fingerprint, Lock, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNetworkStore } from '@lavanderpro/sync-engine';
import { isBiometricAvailable } from '~/lib/biometric';
import { useAuth } from '~/stores/auth-store';

interface SetupPinModalProps {
  /** Llamado cuando el user completa el setup. */
  onComplete: () => void;
  /** Llamado cuando el user skipea el setup. */
  onSkip: () => void;
}

/**
 * Modal que aparece DESPUÉS del primer login online exitoso.
 *
 * Ofrece configurar un PIN para uso offline. Si el user skipea, igual
 * puede usar la app online, pero NO podrá reabrir sesión offline.
 */
export function SetupPinModal({ onComplete, onSkip }: SetupPinModalProps) {
  const setupPin = useAuth((s) => s.setupPin);
  const networkState = useNetworkStore((s) => s.state);

  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [wantBiometric, setWantBiometric] = useState(true);

  useEffect(() => {
    void isBiometricAvailable().then((cap) => {
      setBiometricAvailable(cap.available);
      if (!cap.available) setWantBiometric(false);
    });
  }, []);

  const valid = pin.length >= 4 && pin.length <= 8 && /^\d+$/.test(pin) && pin === confirm;
  const offline = networkState === 'offline';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError('Verifica: PIN de 4-8 dígitos, y que coincida con la confirmación.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await setupPin(pin);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al configurar PIN');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fg/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-pin-title"
    >
      <div className="w-full max-w-md bg-surface border border-border rounded-md shadow-modal p-7 relative">
        <button
          type="button"
          onClick={onSkip}
          aria-label="Cerrar"
          className="absolute right-3 top-3 h-7 w-7 inline-flex items-center justify-center text-muted hover:bg-canvas hover:text-fg rounded-icon transition-all duration-ui active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-icon bg-accent-soft text-accent flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 id="setup-pin-title" className="text-title font-bold text-fg">
            Configura tu PIN
          </h2>
        </div>

        <p className="text-meta text-muted mb-5">
          Para usar LavanderPro sin internet, configura un PIN. Se encripta
          y guarda solo en este device. Puedes cambiarlo o quitarlo cuando quieras.
        </p>

        {offline && (
          <div className="mb-4">
            <Alert variant="warning">
              Estás sin conexión. El PIN se configurará para próximos accesos offline.
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pin" variant="caps">
              PIN (4-8 dígitos)
            </Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              autoComplete="off"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pin-confirm" variant="caps">
              Confirma el PIN
            </Label>
            <Input
              id="pin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoComplete="off"
              placeholder="••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
              invalid={confirm.length > 0 && pin !== confirm}
            />
          </div>

          {biometricAvailable && (
            <label className="flex items-center gap-2 text-meta text-fg cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={wantBiometric}
                onChange={(e) => setWantBiometric(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
              />
              <Fingerprint className="h-3.5 w-3.5 text-muted" />
              <span>Permitir desbloqueo con biometría (FaceID, TouchID, huella)</span>
            </label>
          )}

          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={!valid || submitting}
              className="flex-1"
            >
              <Lock className="h-3.5 w-3.5" />
              {submitting ? 'Configurando…' : 'Activar PIN'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={onSkip}
              disabled={submitting}
            >
              Más tarde
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}