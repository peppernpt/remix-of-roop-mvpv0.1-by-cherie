import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Node >= 23 ships an experimental built-in `localStorage` global that
// shadows jsdom's working implementation inside vitest workers — and without
// a valid --localstorage-file it is a broken stub (no clear/getItem).
// Replace both storages with a spec-shaped in-memory implementation so the
// bag / user-scope isolation tests exercise real Storage semantics.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(String(key), String(value));
  }
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  const current = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
  if (typeof current?.clear !== "function" || typeof current?.key !== "function") {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, name, { value: storage, writable: true, configurable: true });
    Object.defineProperty(window, name, { value: storage, writable: true, configurable: true });
  }
}
