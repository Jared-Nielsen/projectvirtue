// Mirrors future protobuf message LoadingScreenManifest; hand-written for now.

export type LoadingVariant = 'marine' | 'dungeon' | 'paladin-castle' | 'default';

export interface LoadingScreen {
  readonly variant: LoadingVariant;
  readonly imageUrl: string;
  readonly thumbUrl: string;
  readonly tint: string;
  readonly tagline: string;
  /** Lore quotes shuffled into the loading screen. */
  readonly quotes: readonly { readonly text: string; readonly attribution: string }[];
  readonly weight: number;
}

export interface LoadingScreenManifest {
  readonly version: number;
  readonly variants: readonly LoadingScreen[];
  readonly default: LoadingVariant;
}
