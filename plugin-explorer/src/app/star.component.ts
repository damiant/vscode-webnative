import { CUSTOM_ELEMENTS_SCHEMA, Component, Input } from '@angular/core';

@Component({
  selector: 'star',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @for (x of _stars; track x) {
      <svg style="width:16px" xmlns="http://www.w3.org/2000/svg" fill="#aa0" viewBox="0 0 512 512">
        <path
          d="M394 480a16 16 0 01-9.39-3L256 383.76 127.39 477a16 16 0 01-24.55-18.08L153 310.35 23 221.2a16 16 0 019-29.2h160.38l48.4-148.95a16 16 0 0130.44 0l48.4 149H480a16 16 0 019.05 29.2L359 310.35l50.13 148.53A16 16 0 01394 480z"
        />
      </svg>
    }
    @for (x of _misses; track x) {
      <svg style="width:16px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <path
          d="M480 208H308L256 48l-52 160H32l140 96-54 160 138-100 138 100-54-160z"
          fill="none"
          stroke="rgba(128,128,0,0.5)"
          stroke-linejoin="round"
          stroke-width="32"
        />
      </svg>
    }
    <ng-content></ng-content>
  `,
})
export class StarComponent {
  _stars = [0, 1, 2];
  _misses = [3, 4, 5];
  @Input() set rating(value: number) {
    if (!value) {
      this._stars = [];
      this._misses = [].constructor(5);
    } else {
      this._stars = [].constructor(value);
      this._misses = [].constructor(5 - value);
    }
  }
}
