import { Component } from '@angular/core';
import { MediaService } from '../../services/media.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-column-layout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './column-layout.component.html',
  styleUrl: './column-layout.component.less',
})
export class ColumnLayoutComponent {
  media: MediaService;

  constructor(mediaService: MediaService) {
    this.media = mediaService;
  }
}
