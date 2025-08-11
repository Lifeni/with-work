import { Component, inject } from '@angular/core';
import { GlobalService } from '../shared/services/global.service';

@Component({
  selector: 'app-compare',
  imports: [],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.scss',
})
export class CompareComponent {
  readonly globalService = inject(GlobalService);

  constructor() {
    this.globalService.setAppName('比较');
  }
}
