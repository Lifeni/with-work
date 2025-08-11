import { Component, inject } from '@angular/core';
import { GlobalService } from '../shared/services/global.service';

@Component({
  selector: 'app-find',
  imports: [],
  templateUrl: './find.component.html',
  styleUrl: './find.component.scss',
})
export class FindComponent {
  readonly globalService = inject(GlobalService);

  constructor() {
    this.globalService.setAppName('查找');
  }
}
