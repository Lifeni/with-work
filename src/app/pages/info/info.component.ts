import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogContent } from '@angular/material/dialog';
import { version } from '../../../../package.json';

@Component({
  selector: 'app-info',
  imports: [MatDialogContent, MatButtonModule],
  templateUrl: './info.component.html',
  styleUrl: './info.component.scss',
})
export class InfoComponent {
  version = version;
}
