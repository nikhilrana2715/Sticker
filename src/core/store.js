/**
 * localStorage wrapper. Keys are prefixed with "mrsps:".
 * Every access is wrapped in try/catch: storage can be blocked
 * (private mode, cleared site data), and the app must still work.
 */
const PREFIX = 'mrsps:';

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable: ignore */
    }
  }
};
