'use client';

import { forwardRef, type ReactNode } from 'react';
import { Button } from './button';
import { Modal } from './modal';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /**
   * Tono del botón de confirmación.
   * - `danger` (default) — para acciones destructivas (delete).
   * - `primary` — para confirmaciones neutrales (publish, approve).
   */
  confirmTone?: 'danger' | 'primary';
  /** Label del botón de confirmación. Default: "Confirmar". */
  confirmLabel?: string;
  /** Label del botón de cancelar. Default: "Cancelar". */
  cancelLabel?: string;
  /** Si está en estado pending (deshabilita botones, muestra spinner en confirm). */
  pending?: boolean;
  /** Texto del botón de confirmación mientras pending. Default: "Procesando…". */
  pendingLabel?: string;
  /** Callback al confirmar. */
  onConfirm: () => void;
}

/**
 * ConfirmDialog — design-system LavanderPro.
 *
 * Modal de confirmación reutilizable. Usar SIEMPRE para:
 *   - Confirmar delete (tone: 'danger', confirmLabel: 'Eliminar').
 *   - Confirmar publish/approve (tone: 'primary').
 *   - Confirmar acciones irreversibles en general.
 *
 * El `description` debe incluir las consecuencias reales de la acción
 * (ej. "Los servicios asociados quedarán sin categoría.").
 */
export const ConfirmDialog = forwardRef<HTMLDivElement, ConfirmDialogProps>(
  (
    {
      open,
      onOpenChange,
      title,
      description,
      confirmTone = 'danger',
      confirmLabel = 'Confirmar',
      cancelLabel = 'Cancelar',
      pending = false,
      pendingLabel = 'Procesando…',
      onConfirm,
    },
    ref,
  ) => {
    return (
      <Modal open={open} onOpenChange={onOpenChange}>
        <Modal.Content ref={ref}>
          <Modal.Header>
            <Modal.Title>{title}</Modal.Title>
            {description && <Modal.Description>{description}</Modal.Description>}
          </Modal.Header>
          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={confirmTone === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    );
  },
);
ConfirmDialog.displayName = 'ConfirmDialog';