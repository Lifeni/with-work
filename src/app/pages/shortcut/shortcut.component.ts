import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { SectionComponent } from '../../components/section/section.component';
import { MediaService } from '../../services/media.service';

@Component({
  selector: 'app-shortcut',
  standalone: true,
  templateUrl: './shortcut.component.html',
  styleUrl: './shortcut.component.less',
  imports: [CommonModule, MatCardModule, MatGridListModule, SectionComponent],
})
export class ShortcutComponent {
  media: MediaService;

  constructor(mediaService: MediaService) {
    this.media = mediaService;
  }
}
