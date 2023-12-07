import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { TextComponent } from './text/text.component';
import { ListComponent } from './list/list.component';
import { TemplateComponent } from './template/template.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    data: { name: '主页', icon: 'home_filled' },
  },
  {
    path: '文字',
    component: TextComponent,
    data: { name: '文字', icon: 'draw' },
  },
  {
    path: '列表',
    component: ListComponent,
    data: { name: '列表', icon: 'view_stream' },
  },
  {
    path: '模板',
    component: TemplateComponent,
    data: { name: '模板', icon: 'category' },
  },
];
