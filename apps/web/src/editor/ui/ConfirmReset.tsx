// Thin wrapper around @br/ui Confirm with editor-specific copy.

import { Confirm } from '@br/ui';
import type { Component } from 'solid-js';

export interface ConfirmResetProps {
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export const ConfirmReset: Component<ConfirmResetProps> = (props) => {
  return (
    <Confirm
      open={props.open}
      title="Reset map?"
      message="This clears every painted cell and the autosave for this session. The current map cannot be restored after this."
      confirmLabel="Reset map"
      cancelLabel="Keep working"
      destructive
      onConfirm={props.onConfirm}
      onCancel={props.onCancel}
    />
  );
};
