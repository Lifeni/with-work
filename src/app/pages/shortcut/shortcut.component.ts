import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CardComponent } from '../../components/card/card.component';
import { ColumnLayoutComponent } from '../../components/column-layout/column-layout.component';
import { MediaService } from '../../services/media.service';

@Component({
  selector: 'app-shortcut',
  standalone: true,
  templateUrl: './shortcut.component.html',
  styleUrl: './shortcut.component.less',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatGridListModule,
    MatListModule,
    CardComponent,
    ColumnLayoutComponent,
  ],
})
export class ShortcutComponent {
  media: MediaService;
  snack: MatSnackBar;
  marks = [
    { name: '直角引号', mark: ['「', '」'] },
    { name: '单书名号', mark: ['〈', '〉'] },
    { name: '六角括号', mark: ['〔', '〕'] },
  ];

  constructor(mediaService: MediaService, snackBar: MatSnackBar) {
    this.media = mediaService;
    this.snack = snackBar;
  }

  message = (text: string) => {
    this.snack.open(text, '关闭', { duration: 2000 });
  };

  copy = async (text: string) => {
    if ('clipboard' in navigator) {
      await navigator.clipboard.writeText(text);
      this.message('✅ 已复制');
    }
  };
}
