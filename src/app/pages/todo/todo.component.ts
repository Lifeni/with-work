import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { Observable } from 'rxjs';
import { PanelComponent } from '../../components/panel/panel.component';
import { MediaQueryService } from '../../services/media-query.service';
import { LocalStorageService } from '../../services/local-storage.service';

const NOTE_TIPS = `这里有四个可以实时保存的笔记本，
你可以在这里输入和粘贴任意文字，
所有数据将保存在当前浏览器本地，
清理浏览器缓存可能导致数据丢失，
所以请不要在这里存放重要的数据，
随时备份重要数据也是一个好习惯，

从删除这段文字开始，随便写一些什么吧！
:-)
`;

@Component({
  selector: 'app-todo',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    PanelComponent,
    MatGridListModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
  ],
  templateUrl: './todo.component.html',
  styleUrl: './todo.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class TodoComponent {
  isMobile: Observable<boolean>;
  noteCount = 4;
  noteContent = ['', '', '', ''];
  saveTimeout: number = 0;

  constructor(
    mediaQueryService: MediaQueryService,
    private localStorageService: LocalStorageService
  ) {
    this.isMobile = mediaQueryService.isMobile();
  }

  ngOnInit() {
    this.loadNote();
  }

  loadNote() {
    if (!this.localStorageService.has(`note-1`))
      this.localStorageService.set(`note-1`, NOTE_TIPS);

    for (let i = 0; i < this.noteCount; i++)
      this.noteContent[i] = this.localStorageService.get(`note-${i + 1}`) || '';
  }

  saveNote(id: number) {
    if (id - 1 < 0) return;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.localStorageService.set(`note-${id}`, this.noteContent[id - 1]);
    }, 500);
  }
}
