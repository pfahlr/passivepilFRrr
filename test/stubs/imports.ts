const store = new Map<string, any>()

export const storage = {
  _store: store,
  defineItem<T>(key: string, { fallback }: { fallback: T }) {
    if (!store.has(key)) store.set(key, fallback)
    return {
      async getValue() {
        return store.has(key) ? store.get(key) : fallback
      },
      async setValue(v: T) {
        store.set(key, v)
      },
    }
  },
}
