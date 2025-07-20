import { CommonModule, Location } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { type Observable } from 'rxjs';
import { routes } from './app.routes';
import { InfoComponent } from './shared/layouts/info/info.component';
import { MediaQueryService } from './shared/services/media-query.service';

@Component({
  selector: 'app-root',
  providers: [MediaQueryService, Location],
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  isMobile: Observable<boolean>;
  location: Location;

  readonly navLinks = routes
    .filter((route) => route.data?.['side'])
    .map((route) => ({
      path: `/${route.path}`,
      encode: encodeURI(`/${route.path}`),
      name: route.data?.['name'],
      icon: route.data?.['icon'],
    }));

  readonly dialog = inject(MatDialog);
  constructor(mediaQueryService: MediaQueryService, location: Location) {
    this.isMobile = mediaQueryService.isMobile();
    this.location = location;
  }

  openInfoDialog() {
    const dialogRef = this.dialog.open(InfoComponent);
    dialogRef.afterClosed().subscribe(() => {});
  }
}
