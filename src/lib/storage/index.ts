import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({
  id: 'sama-app-storage',
});

export function getString(key: string): string | undefined {
  return storage.getString(key);
}

export function setString(key: string, value: string): void {
  storage.set(key, value);
}

export function getBoolean(key: string): boolean | undefined {
  return storage.getBoolean(key);
}

export function setBoolean(key: string, value: boolean): void {
  storage.set(key, value);
}

export function getNumber(key: string): number | undefined {
  return storage.getNumber(key);
}

export function setNumber(key: string, value: number): void {
  storage.set(key, value);
}

export function deleteKey(key: string): void {
  storage.remove(key);
}

export function clearAll(): void {
  storage.clearAll();
}
