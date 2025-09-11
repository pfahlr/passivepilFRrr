export const storage: {
  defineItem<T>(key: string, opts: { fallback: T }): {
    getValue(): Promise<T>;
    setValue(value: T): Promise<void>;
  };
};
