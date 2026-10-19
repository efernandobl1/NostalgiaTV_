import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

type Dir = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]';

/**
 * Android TV shell: renders a fixed 1920×1080 stage (the design's canvas) scaled to fit the screen,
 * and moves focus between controls with the D-pad (arrow keys) — spatial navigation.
 */
@Component({
  selector: 'app-tv-layout',
  imports: [RouterOutlet],
  host: {
    class: 'fixed inset-0 overflow-hidden bg-black text-fg font-sans',
    '(window:resize)': 'measure()',
    '(window:keydown)': 'onKey($event)',
  },
  template: `
    <div #stage class="absolute left-0 top-0 w-480 h-270 overflow-hidden origin-top-left" [style.transform]="transform()">
      <router-outlet />
    </div>
  `,
})
export class TvLayout {
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly router = inject(Router);
  private readonly size = signal({ w: window.innerWidth, h: window.innerHeight });

  readonly transform = computed(() => {
    const { w, h } = this.size();
    const s = Math.min(w / 1920, h / 1080);
    return `translate(${(w - 1920 * s) / 2}px, ${(h - 1080 * s) / 2}px) scale(${s})`;
  });

  constructor() {
    const sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.autofocus());
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    this.autofocus();
  }

  measure(): void {
    this.size.set({ w: window.innerWidth, h: window.innerHeight });
  }

  onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'BrowserBack') {
      if ((e.target as HTMLElement).tagName === 'INPUT' && e.key === 'Backspace') return;
      e.preventDefault();
      history.length > 1 ? history.back() : this.router.navigateByUrl('/tv');
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault();
    this.move(e.key as Dir);
  }

  /** Focus the nearest control in the pressed direction (center-to-center, favoring alignment). */
  private move(dir: Dir): void {
    const root = this.stage().nativeElement;
    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length);
    const current = document.activeElement as HTMLElement | null;
    if (!current || !root.contains(current)) {
      items[0]?.focus();
      return;
    }
    const a = current.getBoundingClientRect();
    const horizontal = dir === 'ArrowLeft' || dir === 'ArrowRight';
    const tol = 6;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === current || el.contains(current)) continue;
      const b = el.getBoundingClientRect();
      // Edge-based: the candidate must start beyond the current control in the pressed direction.
      const gap = dir === 'ArrowRight' ? b.left - a.right : dir === 'ArrowLeft' ? a.left - b.right : dir === 'ArrowDown' ? b.top - a.bottom : a.top - b.bottom;
      if (gap < -tol) continue;
      // Rows/columns that overlap on the cross axis win; then the closest centers.
      const crossGap = horizontal
        ? Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom))
        : Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
      const crossCenter = horizontal
        ? Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2)
        : Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2);
      const score = Math.max(0, gap) + crossGap * 4 + crossCenter * 0.25;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    // Large surfaces (e.g. the player's video area) contain everything: fall back to centers.
    if (!best) {
      const ax = (a.left + a.right) / 2, ay = (a.top + a.bottom) / 2;
      for (const el of items) {
        if (el === current) continue;
        const b = el.getBoundingClientRect();
        const dx = (b.left + b.right) / 2 - ax, dy = (b.top + b.bottom) / 2 - ay;
        const ahead = dir === 'ArrowRight' ? dx > 0 : dir === 'ArrowLeft' ? dx < 0 : dir === 'ArrowDown' ? dy > 0 : dy < 0;
        const score = Math.hypot(dx, dy);
        if (ahead && score < bestScore) { bestScore = score; best = el; }
      }
    }
    if (!best) return;
    best.focus({ preventScroll: true });
    this.reveal(best);
  }

  /** Keep the focused control visible inside its `[data-tv-scroll]` container (the stage itself never scrolls). */
  private reveal(el: HTMLElement): void {
    const box = el.closest<HTMLElement>('[data-tv-scroll]');
    if (!box) return;
    const { w, h } = this.size();
    const s = Math.min(w / 1920, h / 1080);
    const r = el.getBoundingClientRect(), c = box.getBoundingClientRect();
    const pad = 24 * s;
    if (r.bottom + pad > c.bottom) box.scrollTop += (r.bottom + pad - c.bottom) / s;
    else if (r.top - pad < c.top) box.scrollTop -= (c.top - r.top + pad) / s;
  }

  /** After each screen renders (lazy chunks may take a moment), focus its `[data-autofocus]` control or the first one. */
  private autofocus(attempt = 0): void {
    setTimeout(() => {
      const root = this.stage().nativeElement;
      if (root.contains(document.activeElement) && document.activeElement !== document.body) return;
      const el = root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE);
      if (el) el.focus({ preventScroll: true });
      else if (attempt < 20) this.autofocus(attempt + 1);
    }, 100);
  }
}
