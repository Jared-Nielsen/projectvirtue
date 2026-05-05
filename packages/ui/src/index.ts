// @br/ui — Project Virtue shared design system.
//
// Apps consume tokens via two paths:
//   import { tokens } from '@br/ui';     // typed JS access
//   import '@br/ui/tokens.css';          // CSS custom properties on :root
//
// All components are framework-agnostic Solid primitives that read CSS vars,
// so they re-theme automatically when the consumer toggles `data-theme`.

// Tokens & theming
export * from './tokens';
export { default as tokens } from './tokens';
export * from './theme';

// Hooks
export { useReducedMotion } from './hooks/useReducedMotion';
export { useEscape } from './hooks/useEscape';
export { useId } from './hooks/useId';

// Portal re-export from solid-js/web for convenience
export { Portal } from 'solid-js/web';

// Icon registry
export { iconRegistry } from './icons/registry';
export type { IconName, IconDefinition } from './icons/registry';

// Components
export { Icon } from './components/Icon/Icon';
export type { IconProps } from './components/Icon/Icon';

export { Button } from './components/Button/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './components/Button/Button';

export { IconButton } from './components/IconButton/IconButton';
export type { IconButtonProps } from './components/IconButton/IconButton';

export { Input } from './components/Input/Input';
export type { InputProps, InputType } from './components/Input/Input';

export { Select } from './components/Select/Select';
export type { SelectOption, SelectProps } from './components/Select/Select';

export { Combobox } from './components/Combobox/Combobox';
export type { ComboboxOption, ComboboxProps } from './components/Combobox/Combobox';

export { Toggle } from './components/Toggle/Toggle';
export type { ToggleProps } from './components/Toggle/Toggle';

export { Checkbox } from './components/Checkbox/Checkbox';
export type { CheckboxProps } from './components/Checkbox/Checkbox';

export { Radio, RadioGroup } from './components/Radio/Radio';
export type {
  RadioProps,
  RadioGroupOption,
  RadioGroupProps,
} from './components/Radio/Radio';

export { Slider } from './components/Slider/Slider';
export type { SliderProps } from './components/Slider/Slider';

export { Tab, TabList, TabPanel, Tabs } from './components/Tabs/Tabs';
export type { TabsProps, TabListProps, TabProps, TabPanelProps } from './components/Tabs/Tabs';

export { Tooltip } from './components/Tooltip/Tooltip';
export type { TooltipProps } from './components/Tooltip/Tooltip';

export { Popover } from './components/Popover/Popover';
export type { PopoverProps } from './components/Popover/Popover';

export { ToastViewport, toast } from './components/Toast/Toast';
export type { ToastEntry, ToastOptions, ToastVariant } from './components/Toast/store';

export { Loading, Skeleton, Spinner } from './components/Loading/Loading';
export type {
  LoadingProps,
  SkeletonProps,
  SpinnerProps,
} from './components/Loading/Loading';

export { Modal, Dialog, Confirm } from './components/Modal/Modal';
export type { ModalProps, ConfirmProps } from './components/Modal/Modal';

export { Drawer } from './components/Drawer/Drawer';
export type { DrawerProps } from './components/Drawer/Drawer';

export { Card, Panel } from './components/Card/Card';
export type { CardProps } from './components/Card/Card';

export { WindowFrame } from './components/WindowFrame/WindowFrame';
export type { WindowFrameProps } from './components/WindowFrame/WindowFrame';

export { HealthBar, ManaBar, MinimapPlaceholder, StatGauge } from './components/HUD/HUD';
export type {
  BarProps,
  MinimapPlaceholderProps,
  StatGaugeProps,
} from './components/HUD/HUD';

export { FocusTrap } from './components/FocusTrap/FocusTrap';
export type { FocusTrapProps } from './components/FocusTrap/FocusTrap';

// Layout helpers
export { Cluster, Grid, Stack } from './layout/Layout';
export type { ClusterProps, GridProps, StackProps } from './layout/Layout';
