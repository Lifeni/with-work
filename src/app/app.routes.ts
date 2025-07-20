import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: { name: '常用', icon: 'dashboard', side: true },
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: '比较',
    data: { name: '比较', icon: 'compare', side: true },
    loadComponent: () =>
      import('./compare/compare.component').then((m) => m.CompareComponent),
  },
  {
    path: '查找',
    data: { name: '查找', icon: 'content_paste_search', side: true },
    loadComponent: () =>
      import('./find/find.component').then((m) => m.FindComponent),
  },
  {
    path: '替换',
    data: { name: '替换', icon: 'insert_page_break', side: true },
    loadComponent: () =>
      import('./replace/replace.component').then((m) => m.ReplaceComponent),
  },
  {
    path: '排序',
    data: { name: '排序', icon: 'move_down', side: true },
    loadComponent: () =>
      import('./sort/sort.component').then((m) => m.SortComponent),
  },
  {
    path: '模板',
    data: { name: '模板', icon: 'extension', side: true },
    loadComponent: () =>
      import('./template/template.component').then((m) => m.TemplateComponent),
  },
];
