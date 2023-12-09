import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'component-section',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './section.component.html',
  styleUrl: './section.component.less',
})
export class SectionComponent {
  @Input() name: string = '';
}
