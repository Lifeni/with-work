import { Component, inject } from '@angular/core';
import { GlobalService } from '../shared/services/global.service';

@Component({
  selector: 'app-replace',
  imports: [],
  templateUrl: './replace.component.html',
  styleUrl: './replace.component.scss',
})
export class ReplaceComponent {
  readonly globalService = inject(GlobalService);

  constructor() {
    this.globalService.setAppName('替换');
  }
}
