/** Expected failures travel as values. Throwing is reserved for programmer error. */
export type Result<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/** Normalize an unknown catch binding into a message, never widening to `any`. */
export const messageFrom = (error: unknown, context: string): string =>
  error instanceof Error ? error.message : `Unknown ${context}: ${String(error)}`;
