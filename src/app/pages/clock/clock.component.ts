import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './clock.component.html',
  styleUrl: './clock.component.less',
})
export class ClockComponent {
  time = {
    hours: '00',
    minutes: '00',
    seconds: '00',
  };
  timer = 0;
  isFullScreen = false;

  ngOnInit() {
    this.getTime();
    this.timer = setInterval(() => {
      this.getTime();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  addZero = (num: number) => String(num).padStart(2, '0');
  getTime = () => {
    const date = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    this.time = {
      hours: this.addZero(hours),
      minutes: this.addZero(minutes),
      seconds: this.addZero(seconds),
    };
  };

  toggleFullScreen = () => {
    this.isFullScreen = !this.isFullScreen;
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
  };
}
