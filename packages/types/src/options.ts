// Mirrors future protobuf message OptionsService; hand-written for now.
//
// Options are user-scoped settings that persist server-side per account so
// they roam between devices. The dev panel's failure-injection toggles are
// *not* part of options — they live in /packages/mocks runtime state.

export interface KeyBinding {
  readonly action: string;
  readonly label: string;
  readonly primary: string;
  readonly secondary?: string;
  readonly group: 'movement' | 'combat' | 'ui' | 'social' | 'system';
  readonly rebindable: boolean;
}

export interface Keybindings {
  readonly version: number;
  readonly bindings: readonly KeyBinding[];
}

export interface AudioOptions {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly ambienceVolume: number;
  readonly voiceVolume: number;
  readonly muteWhenUnfocused: boolean;
  readonly outputDeviceId: string;
  readonly inputDeviceId: string;
  readonly subtitlesEnabled: boolean;
  readonly subtitleSize: 'sm' | 'md' | 'lg' | 'xl';
}

export type ResolutionMode = '1280x720' | '1920x1080' | '2560x1440' | '3840x2160' | 'native';

export interface VideoOptions {
  readonly resolution: ResolutionMode;
  readonly displayMode: 'fullscreen' | 'borderless' | 'windowed';
  readonly vsync: boolean;
  readonly frameRateCap: number;
  readonly fieldOfView: number;
  readonly renderScale: number;
  readonly textureQuality: 'low' | 'medium' | 'high' | 'ultra';
  readonly shadowQuality: 'off' | 'low' | 'medium' | 'high';
  readonly antialiasing: 'off' | 'fxaa' | 'taa' | 'msaa';
  readonly bloom: boolean;
  readonly motionBlur: boolean;
}

export interface AccessibilityOptions {
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly colorBlindMode: 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  readonly fontScale: 0.9 | 1.0 | 1.25 | 1.5;
  readonly screenReader: boolean;
  readonly captionsForCombat: boolean;
  readonly screenShake: boolean;
  readonly flashingEffects: boolean;
  readonly holdToToggle: boolean;
}

export interface GameplayOptions {
  readonly autoLootEnabled: boolean;
  readonly tooltipDelayMs: number;
  readonly preferredCombatStyle: 'realtime' | 'paused' | 'auto';
  readonly showTutorialHints: boolean;
  readonly damageNumbers: boolean;
  readonly cameraFollow: 'free' | 'lock' | 'smart';
  readonly mouseLook: boolean;
  readonly pickupConfirmation: boolean;
  readonly profanityFilter: boolean;
}
