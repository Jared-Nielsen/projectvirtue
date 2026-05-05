let counter = 0;

/** Stable id generator for label/control association in stories + components. */
export function useId(prefix = 'br'): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}
