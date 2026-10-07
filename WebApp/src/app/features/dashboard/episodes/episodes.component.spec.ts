import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EpisodesComponent } from './episodes.component';
import { EpisodeResponse } from '../../../shared/models/episode.model';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

describe('EpisodesComponent', () => {
  let component: EpisodesComponent;
  let fixture: ComponentFixture<EpisodesComponent>;
  let http: HttpTestingController;
  const episode = (
    id: number,
    season: number,
    number: number,
    title = 'Homero',
    type = 1,
  ): EpisodeResponse => ({
    id,
    season,
    episodeNumber: number,
    title,
    episodeTypeId: type,
    episodeTypeName: 'Regular',
    seriesId: 1,
    fileSizeBytes: 100,
  });
  function load(episodes: EpisodeResponse[]) {
    component.onSeriesChange(1);
    http.expectOne((request) => request.url.endsWith('/episodes/series/1')).flush(episodes);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpisodesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EpisodesComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/series')).flush([]);
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('orders numerically by season and chapter without mutating the input', () => {
    const input = [episode(1, 5, 20), episode(2, 5, 9), episode(3, 1, 2), episode(4, 5, 1)];
    load(input);
    expect(component.dataSource.data.map((item) => item.id)).toEqual([3, 4, 2, 1]);
    expect(input.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    component.onSeasonChange(5);
    fixture.detectChanges();
    expect(component.dataSource.data.map((item) => item.episodeNumber)).toEqual([1, 9, 20]);
  });

  it('combines season, accent-insensitive title and episode type filters', () => {
    load([
      episode(1, 5, 2, 'La última tentación', 2),
      episode(2, 1, 1, 'La última tentación', 2),
      episode(3, 5, 3),
    ]);
    component.onSeasonChange(5);
    component.search.set(' ULTIMA ');
    component.selectedType.set(2);
    fixture.detectChanges();
    expect(component.dataSource.data.map((item) => item.id)).toEqual([1]);
    expect(component.activeFilterCount()).toBe(2);
    component.clearFilters();
    fixture.detectChanges();
    expect(component.selectedSeason()).toBe(5);
    expect(component.dataSource.data.length).toBe(2);
  });

  it('matches chapter numbers exactly and offers recovery for an empty result', () => {
    load([episode(1, 1, 1), episode(2, 1, 10), episode(3, 1, 21)]);
    component.search.set('1');
    fixture.detectChanges();
    expect(component.dataSource.data.map((item) => item.episodeNumber)).toEqual([1]);
    component.search.set('missing title');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ningún episodio coincide');
    expect(fixture.nativeElement.textContent).not.toContain('Sube archivos o sincroniza');
  });

  it('keeps the selected season and filters when synchronizing the folder', () => {
    load([episode(1, 5, 20)]);
    component.onSeasonChange(5);
    component.search.set('Homero');
    component.scan();
    http
      .expectOne((request) => request.url.endsWith('/series/1/scan'))
      .flush([episode(1, 5, 20), episode(2, 5, 1), episode(3, 1, 9)]);
    fixture.detectChanges();
    expect(component.selectedSeason()).toBe(5);
    expect(component.search()).toBe('Homero');
    expect(component.dataSource.data.map((item) => item.episodeNumber)).toEqual([1, 20]);
  });

  it('reorders chapters after editing their number', () => {
    const first = episode(1, 5, 20);
    load([first, episode(2, 5, 9)]);
    vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of({ data: { title: 'Homero', episodeNumber: 1, episodeTypeId: 1 } }),
    } as ReturnType<MatDialog['open']>);
    component.editEpisode(first);
    http
      .expectOne((request) => request.method === 'PUT' && request.url.endsWith('/episodes/1'))
      .flush({ ...first, episodeNumber: 1 });
    fixture.detectChanges();
    expect(component.dataSource.data.map((item) => item.episodeNumber)).toEqual([1, 9]);
  });

  it('resets pagination when filters change', () => {
    load(Array.from({ length: 30 }, (_, index) => episode(index + 1, 1, index + 1)));
    component.paginator!.pageIndex = 2;
    component.search.set('1');
    fixture.detectChanges();
    expect(component.paginator!.pageIndex).toBe(0);
  });
});
