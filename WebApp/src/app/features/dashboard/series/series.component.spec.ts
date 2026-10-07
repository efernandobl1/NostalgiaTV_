import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { SeriesComponent } from './series.component';

describe('SeriesComponent', () => {
  let component: SeriesComponent;
  let fixture: ComponentFixture<SeriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeriesComponent],
      providers: [provideHttpClient(), provideRouter([]), provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(SeriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('orders the library by physical size and by episode count', () => {
    component.dataSource.data = [
      { id: 1, name: 'Small', episodeCount: 20 },
      { id: 3, name: 'Unknown', episodeCount: 0 },
      { id: 2, name: 'Large', episodeCount: 5 },
    ] as any;
    component.setStorage({
      measuredAtUtc: '',
      totalBytes: null,
      usedBytes: null,
      availableBytes: null,
      libraryBytes: 110,
      series: [
        { id: 1, name: 'Small', sizeBytes: 10, episodeCount: 20, missingEpisodeCount: 0 },
        { id: 2, name: 'Large', sizeBytes: 100, episodeCount: 5, missingEpisodeCount: 0 },
      ],
    });
    component.sortSeries('size');
    expect(component.dataSource.data.map((item) => item.id)).toEqual([2, 1, 3]);
    component.sortSeries('episodes');
    expect(component.dataSource.data.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});
