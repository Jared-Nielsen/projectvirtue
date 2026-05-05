import { type JSX, Show, createEffect, onCleanup, splitProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useEscape } from '../../hooks/useEscape';
import { useId } from '../../hooks/useId';
import { Button } from '../Button/Button';
import { FocusTrap } from '../FocusTrap/FocusTrap';
import { Icon } from '../Icon/Icon';
import styles from './Modal.module.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Hide the close button in the header. */
  hideClose?: boolean;
  /** Modal footer content (typically action buttons). */
  footer?: JSX.Element;
  children?: JSX.Element;
  /** Click on the overlay closes the modal — defaults to true. */
  dismissOnOverlay?: boolean;
}

/** Centred modal dialog with focus trap, scroll lock, and Escape-to-close. */
export function Modal(props: ModalProps): JSX.Element {
  const [own] = splitProps(props, [
    'open',
    'onClose',
    'title',
    'hideClose',
    'footer',
    'children',
    'dismissOnOverlay',
  ]);
  const titleId = useId('modal-title');

  useEscape(
    () => own.onClose(),
    () => own.open,
  );

  // Body scroll lock
  createEffect(() => {
    if (typeof document === 'undefined') return;
    if (own.open) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => {
        document.body.style.overflow = previous;
      });
    }
  });

  return (
    <Show when={own.open}>
      <Portal>
        <div
          class={styles.overlay}
          onClick={(e) => {
            if ((own.dismissOnOverlay ?? true) && e.target === e.currentTarget) own.onClose();
          }}
        >
          <FocusTrap>
            <div
              class={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={own.title ? titleId : undefined}
            >
              <Show when={own.title || !own.hideClose}>
                <div class={styles.header}>
                  <Show when={own.title}>
                    <span class={styles.title} id={titleId}>
                      {own.title}
                    </span>
                  </Show>
                  <Show when={!own.hideClose}>
                    <button
                      type="button"
                      class={styles.close}
                      aria-label="Close"
                      onClick={own.onClose}
                    >
                      <Icon name="x" />
                    </button>
                  </Show>
                </div>
              </Show>
              <div class={styles.body}>{own.children}</div>
              <Show when={own.footer}>
                <div class={styles.footer}>{own.footer}</div>
              </Show>
            </div>
          </FocusTrap>
        </div>
      </Portal>
    </Show>
  );
}

export const Dialog = Modal;

export interface ConfirmProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Convenience confirm/deny dialog. */
export function Confirm(props: ConfirmProps): JSX.Element {
  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title={props.title ?? 'Confirm'}
      footer={
        <>
          <Button variant="ghost" onClick={props.onCancel}>
            {props.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={props.destructive ? 'destructive' : 'primary'} onClick={props.onConfirm}>
            {props.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{props.message}</p>
    </Modal>
  );
}
