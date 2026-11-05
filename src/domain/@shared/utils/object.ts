export function deepFreeze<T>(obj: T): T {
  try {
    const propNames: string[] = Object.getOwnPropertyNames(obj);

    for (const name of propNames) {
      const value: T[keyof T] = obj[name as keyof T];

      if (value && typeof value == 'object') {
        deepFreeze(value);
      }
    }

    return Object.freeze(obj);
  } catch (e) {
    return obj;
  }
}
