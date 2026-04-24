/**
 * Tiny single-init memoiser. Returns a getter that calls `factory` the
 * first time and reuses the result on every subsequent call.
 *
 * Module-level singletons use this instead of the `let cached; if (!cached) ...`
 * boilerplate.
 */
export function lazy<T>(factory: () => T): () => T {
  let cached: T | undefined;
  let initialised = false;
  return () => {
    if (!initialised) {
      cached = factory();
      initialised = true;
    }
    return cached as T;
  };
}
