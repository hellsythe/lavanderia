'use client';

import { Alert, Button, Input, Label } from '@lavanderpro/ui';
import { Fingerprint, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isBiometricAvailable } from '~/lib/biometric';
import { useAuth } from '~/stores/auth-store';

interface LoginPinFormProps {
  /** Cuando se unlockea correctamente → ir a /. */
  onSuccess: () => void;
  /** Cuando el user quiere volver al login online. */
  onSwitchToOnline: () => void;
}

/**
 * Form de login con PIN (offline-first).
 * Se muestra cuando el user tiene PIN configurado.
 * El banner de "sin conexión" se muestra globalmente vía OfflineBanner,
 * así que este form no necesita duplicarlo.
 */
export function LoginPinForm({ onSuccess, onSwitchToOnline }: LoginPinFormProps) {
  const unlockWithPin = useAuth((s) => s.unlockWithPin);
  const unlockWithBiometric = useAuth((s) => s.unlockWithBiometric);
  const failedAttempts = useAuth((s) => s.failedPinAttempts);

  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    void isBiometricAvailable().then((cap) => {
      setBiometricAvailable(cap.available);
    });
  }, []);

  const remaining = Math.max(0, 5 - failedAttempts);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setError('PIN debe tener al menos 4 dígitos.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await unlockWithPin(pin);
      if (r.ok) {
        onSuccess();
      } else {
        setError(`PIN incorrecto. Te quedan ${Math.max(0, 5 - failedAttempts - 1)} intentos.`);
        setPin('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al verificar PIN');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBiometric = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await unlockWithBiometric();
      if (r.ok) onSuccess();
      else setError('Biometría no disponible o falló. Usa tu PIN.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error biométrico');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pin" variant="caps">
          PIN
        </Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          autoComplete="off"
          autoFocus
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          disabled={submitting || remaining === 0}
        />
        {remaining <= 2 && remaining > 0 && (
          <span className="text-meta text-danger font-semibold">
            ⚠️ Te quedan {remaining} intento{remaining === 1 ? '' : 's'} antes de que la sesión se borre.
          </span>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="lg"
          disabled={submitting || remaining === 0 || pin.length < 4}
          className="flex-1"
        >
          <Lock className="h-3.5 w-3.5" />
          {submitting ? 'Verificando…' : 'Acceder'}
        </Button>
        {biometricAvailable && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleBiometric}
            disabled={submitting}
            aria-label="Usar biometría"
          >
            <Fingerprint className="h-4 w-4" />
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={onSwitchToOnline}
        className="text-meta text-accent font-bold hover:underline self-center mt-2"
      >
        ¿No recuerdas tu PIN? Conectar a internet
      </button>
    </form>
  );
}