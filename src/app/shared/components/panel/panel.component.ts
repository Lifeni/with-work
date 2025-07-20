import { Component, input } from '@angular/core';

@Component({
  selector: 'app-panel',
  imports: [],
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.scss',
})
export class PanelComponent {
  name = input('');
}
