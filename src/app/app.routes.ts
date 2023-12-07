import { Routes } from '@angular/router';
import { DifferenceComponent } from './difference/difference.component';
import { HomeComponent } from './home/home.component';
import { ListComponent } from './list/list.component';
import { TemplateComponent } from './template/template.component';
import { TextComponent } from './text/text.component';
import { DevtoolComponent } from './devtool/devtool.component';
import { ShortcutComponent } from './shortcut/shortcut.component';
import { HelpComponent } from './help/help.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    data: { name: '主页', icon: 'home_filled' },
  },
  {
    path: '常用',
    component: ShortcutComponent,
    data: { name: '常用', icon: 'flag' },
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
  {
    path: '差异',
    component: DifferenceComponent,
    data: { name: '差异', icon: 'layers' },
  },
  {
    path: '工具',
    component: DevtoolComponent,
    data: { name: '工具', icon: 'design_services' },
  },
  {
    path: '帮助',
    component: HelpComponent,
    data: { name: '帮助', icon: 'info' },
  },
];
