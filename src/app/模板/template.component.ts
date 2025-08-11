import { Component, inject } from '@angular/core';
import { GlobalService } from '../shared/services/global.service';

@Component({
  selector: 'app-template',
  imports: [],
  templateUrl: './template.component.html',
  styleUrl: './template.component.scss',
})
export class TemplateComponent {
  readonly globalService = inject(GlobalService);

  constructor() {
    this.globalService.setAppName('模板');
  }
}
