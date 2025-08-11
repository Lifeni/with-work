import { Component, inject, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbar } from '@angular/material/toolbar';
import { ThemeService } from '../../services/theme.service';
import { LayoutService } from '../../services/layout.service';
import { GlobalService } from '../../services/global.service';
import { Observable } from 'rxjs';
import { MediaQueryService } from '../../services/media-query.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toolbar',
  imports: [CommonModule, MatToolbar, MatIconModule, MatButtonModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent {
  readonly mediaQueryService = inject(MediaQueryService);
  readonly layoutService = inject(LayoutService);
  readonly globalService = inject(GlobalService);
  readonly themeService = inject(ThemeService);

  isMobile: Observable<boolean>;
  constructor() {
    this.isMobile = this.mediaQueryService.isMobile();
  }

  toggleSidenav(): void {
    this.layoutService.toggleSidenav();
  }

  getAppName(): string {
    return this.globalService.getAppName();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  getTheme(): string {
    return this.themeService.getTheme();
  }
}
