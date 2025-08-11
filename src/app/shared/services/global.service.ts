import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GlobalService {
  readonly appNameSignal: WritableSignal<string> = signal<string>('');

  getAppName(): string {
    return this.appNameSignal();
  }

  setAppName(appName: string): void {
    this.appNameSignal.set(appName);
  }
}
