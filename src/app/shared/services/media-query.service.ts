import { Injectable } from '@angular/core';
import {
  BreakpointObserver,
  Breakpoints,
  BreakpointState,
} from '@angular/cdk/layout';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MediaQueryService {
  constructor(private breakpointObserver: BreakpointObserver) {}

  private observe(breakpoint: string | string[]): Observable<boolean> {
    return this.breakpointObserver
      .observe(breakpoint)
      .pipe(map((state: BreakpointState) => state.matches));
  }

  isXSmall(): Observable<boolean> {
    return this.observe(Breakpoints.XSmall);
  }

  isSmall(): Observable<boolean> {
    return this.observe(Breakpoints.Small);
  }

  isMedium(): Observable<boolean> {
    return this.observe(Breakpoints.Medium);
  }

  isLarge(): Observable<boolean> {
    return this.observe(Breakpoints.Large);
  }

  isXLarge(): Observable<boolean> {
    return this.observe(Breakpoints.XLarge);
  }

  isMobile(): Observable<boolean> {
    return this.observe([Breakpoints.XSmall, Breakpoints.Small]);
  }
}
