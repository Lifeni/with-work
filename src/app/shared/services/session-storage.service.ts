import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionStorageService {
  set<T>(key: string, value: T): void {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  get<T>(key: string): T | null {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  }

  has(key: string): boolean {
    return sessionStorage.getItem(key) !== null;
  }

  remove(key: string): void {
    sessionStorage.removeItem(key);
  }

  clear(): void {
    sessionStorage.clear();
  }
}