import { CommonModule, Location } from '@angular/common';
import { Component, inject, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { routes } from './app.routes';
import { ToolbarComponent } from './shared/components/toolbar/toolbar.component';
import { MediaQueryService } from './shared/services/media-query.service';
import { LayoutService } from './shared/services/layout.service';

@Component({
  selector: 'app-root',
  providers: [],
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    ToolbarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  readonly mediaQueryService = inject(MediaQueryService);
  readonly layoutService = inject(LayoutService);
  readonly location = inject(Location);
  readonly navLinks = routes
    .filter((route) => route.data?.['side'])
    .map((route) => ({
      path: `/${route.path}`,
      encode: encodeURI(`/${route.path}`),
      name: route.data?.['name'],
      icon: route.data?.['icon'],
    }));

  @ViewChild('navbar') navbar!: MatSidenav;
  isMobile: Observable<boolean>;
  constructor() {
    this.isMobile = this.mediaQueryService.isMobile();
  }

  ngAfterViewInit(): void {
    this.layoutService.setSidenav(this.navbar);
  }
}
