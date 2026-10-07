import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DashboardService } from '../dashboard.service';
import { StorageComponent, formatBytes } from './storage.component';

describe('StorageComponent', () => {
  const storage = {
    measuredAtUtc: '2026-10-06T12:00:00Z',
    totalBytes: 1000,
    usedBytes: 800,
    availableBytes: 180,
    libraryBytes: 500,
    series: [
      {
        id: 3,
        name: 'Los Expedientes Secretos X',
        episodeCount: 12,
        missingEpisodeCount: 2,
        sizeBytes: 500,
      },
    ],
  };

  it('shows capacity, available space and episode counts', () => {
    TestBed.configureTestingModule({
      imports: [StorageComponent],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: { getStorage: () => of(storage) } },
      ],
    });
    const fixture = TestBed.createComponent(StorageComponent);
    fixture.componentRef.setInput('showSeries', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('12 episodios disponibles');
    expect(fixture.nativeElement.textContent).toContain('180 B');
    expect(fixture.componentInstance.usedPercent()).toBe(80);
    expect(fixture.nativeElement.querySelector('meter').value).toBe(80);
  });

  it('does not show unavailable storage as zero bytes', () => {
    expect(formatBytes(null)).toBe('No disponible');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1073741824)).toBe('1.0 GiB');
  });

  it('shows a recoverable error instead of stale metrics', () => {
    TestBed.configureTestingModule({
      imports: [StorageComponent],
      providers: [
        provideRouter([]),
        {
          provide: DashboardService,
          useValue: { getStorage: () => throwError(() => new Error('offline')) },
        },
      ],
    });
    const fixture = TestBed.createComponent(StorageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('meter')).toBeNull();
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
