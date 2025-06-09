import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: { name: '主页', icon: 'dashboard', side: true },
    loadComponent: () =>
      import('./pages/todo/todo.component').then((m) => m.TodoComponent),
  },
  {
    path: '文字',
    data: { name: '文字', icon: 'translate', side: true },
    loadComponent: () =>
      import('./pages/text/text.component').then((m) => m.TextComponent),
  },
  {
    path: '符号',
    data: { name: '符号', icon: 'emoji_symbols', side: true },
    loadComponent: () =>
      import('./pages/char/char.component').then((m) => m.CharComponent),
  },
  {
    path: '模板',
    data: { name: '模板', icon: 'extension', side: true },
    loadComponent: () =>
      import('./pages/template/template.component').then(
        (m) => m.TemplateComponent
      ),
  },
  {
    path: '查找',
    data: { name: '查找', icon: 'content_paste_search', side: true },
    loadComponent: () =>
      import('./pages/find/find.component').then((m) => m.FindComponent),
  },
  {
    path: '排序',
    data: { name: '排序', icon: 'move_down', side: true },
    loadComponent: () =>
      import('./pages/sort/sort.component').then((m) => m.SortComponent),
  },
  {
    path: '对比',
    data: { name: '对比', icon: 'insert_page_break', side: true },
    loadComponent: () =>
      import('./pages/compare/compare.component').then(
        (m) => m.CompareComponent
      ),
  },
  {
    path: '纠错',
    data: { name: '纠错', icon: 'auto_fix_high', side: true },
    loadComponent: () =>
      import('./pages/correct/correct.component').then(
        (m) => m.CorrectComponent
      ),
  },
  {
    path: '预设',
    data: { name: '预设', icon: 'save', side: true },
    loadComponent: () =>
      import('./pages/preset/preset.component').then((m) => m.PresetComponent),
  },
  {
    path: '设置',
    data: { name: '设置', icon: 'settings', side: true },
    loadComponent: () =>
      import('./pages/settings/settings.component').then(
        (m) => m.SettingsComponent
      ),
  },
];
