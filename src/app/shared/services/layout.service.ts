import { Injectable, signal, WritableSignal } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly sidenavSignal: WritableSignal<MatSidenav | null> =
    signal<MatSidenav | null>(null);

  setSidenav(sidenav: MatSidenav): void {
    this.sidenavSignal.set(sidenav);
  }

  toggleSidenav(): void {
    const sidenav = this.sidenavSignal();
    if (sidenav) {
      sidenav.toggle();
    }
  }
}
