import { Injectable, signal, computed, WritableSignal } from '@angular/core';

type ThemeSignalType = 'auto' | 'light' | 'dark';
type ThemeType = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly currentThemeSignal: WritableSignal<ThemeSignalType> =
    signal<ThemeSignalType>('auto');

  constructor() {
    this.initializeTheme();
  }

  getThemeSignal(): ThemeSignalType {
    return this.currentThemeSignal();
  }

  getTheme(): ThemeType {
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    const current = this.currentThemeSignal();
    return current === 'auto' ? system : current;
  }

  readonly currentTheme = this.currentThemeSignal.asReadonly();

  setTheme(theme: ThemeType): void {
    this.currentThemeSignal.set(theme);
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${theme}-theme`);
    localStorage.setItem('app-theme', theme);
  }

  toggleTheme(): void {
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    const current = this.currentThemeSignal();
    const currentTheme = current === 'auto' ? system : current;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  private initializeTheme(): void {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) {
      this.currentThemeSignal.set(savedTheme as ThemeSignalType);
      document.documentElement.classList.add(`${savedTheme}-theme`);
    }
  }
}
