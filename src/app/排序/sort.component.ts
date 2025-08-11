import { Component, inject } from '@angular/core';
import { GlobalService } from '../shared/services/global.service';

@Component({
  selector: 'app-sort',
  imports: [],
  templateUrl: './sort.component.html',
  styleUrl: './sort.component.scss',
})
export class SortComponent {
  readonly globalService = inject(GlobalService);

  constructor() {
    this.globalService.setAppName('排序');
  }
}
