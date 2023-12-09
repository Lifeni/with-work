import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLinkActive, RouterModule, RouterOutlet } from '@angular/router';
import { routes } from '../../app.routes';
import { MediaService } from '../../services/media.service';

type AppRoute = {
  path: string;
  data: {
    name: string;
    icon: string;
  };
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLinkActive,
    RouterModule,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.less',
})
export class AppShellComponent {
  title = '一点微小的工作';
  routes = routes[0].children as AppRoute[];
  isActive = (path: string) => decodeURI(location.pathname) === `/${path}`;
  media: MediaService;

  constructor(mediaService: MediaService) {
    this.media = mediaService;
  }
}
