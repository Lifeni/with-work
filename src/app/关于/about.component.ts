import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogContent } from '@angular/material/dialog';
import { version } from '../../../package.json';
import { GlobalService } from '../shared/services/global.service';

@Component({
  selector: 'app-about',
  imports: [MatDialogContent, MatButtonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  readonly version = version;
  readonly globalService = inject(GlobalService);

  constructor() {
    this.globalService.setAppName('关于');
  }
}
