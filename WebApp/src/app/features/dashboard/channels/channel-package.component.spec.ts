import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChannelPackageComponent } from './channel-package.component';
import { environment } from '../../../../environments/environment';
import { PackagePreview } from './channel-packages.service';

describe('ChannelPackageComponent', () => {
  let fixture: ComponentFixture<ChannelPackageComponent>;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/v1/channel-packages`;
  const preview: PackagePreview = {
    manifest: {
      name: 'City',
      schedulingMode: 'Shuffle',
      excludedClips: 1,
      eras: [
        {
          key: 'city',
          name: 'City era',
          series: [{ seriesKey: 'retro', hasSeasonFilter: true, seasons: [1, 3] }],
        },
      ],
      clips: [{ key: 'bumper', title: 'Halloween opener', kind: 0, season: 1, license: 'CC0' }],
    },
    fingerprint: 'verified',
    alreadyInstalled: false,
    downloadBytes: 10,
    series: [{ key: 'retro', name: 'Retro series', existingId: null, availableEpisodes: 0 }],
  };
  const choose = (name = 'city.ntv.zip') =>
    fixture.componentInstance.chooseFile({
      target: { files: [new File(['test'], name)] },
    } as unknown as Event);
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelPackageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChannelPackageComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/v1/community-catalog`).flush({ publicUrl: null });
  });
  afterEach(() => http.verify());

  it('opens the independent catalog without forwarding credentials', () => {
    fixture.componentInstance.catalogUrl.set('https://catalog.example');
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe('https://catalog.example/#catalog');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.target).toBe('_blank');
  });

  it('rejects unsupported file names before uploading', () => {
    choose('script.zip');
    fixture.componentInstance.inspect();
    expect(fixture.componentInstance.error()).toContain('.ntv.zip');
    http.expectNone(`${base}/preview`);
  });
  it('previews seasonal media and missing series before importing', () => {
    choose();
    fixture.componentInstance.inspect();
    const request = http.expectOne(`${base}/preview`);
    expect(request.request.withCredentials).toBe(true);
    request.flush(preview);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Halloween · octubre');
    expect(fixture.nativeElement.textContent).toContain('Temporadas: 1, 3');
    expect(fixture.nativeElement.textContent).toContain('Nueva ficha');
  });
  it('invalidates preview when selecting another file', () => {
    fixture.componentInstance.preview.set(preview);
    choose('other.ntv.zip');
    expect(fixture.componentInstance.preview()).toBeNull();
    fixture.componentInstance.install();
    http.expectNone(`${base}/import`);
  });
  it('imports only the reviewed file and emits the new channel', () => {
    choose();
    fixture.componentInstance.preview.set(preview);
    let imported = 0;
    fixture.componentInstance.imported.subscribe((id) => (imported = id));
    fixture.componentInstance.install();
    const request = http.expectOne(`${base}/import`);
    expect(request.request.body.get('fingerprint')).toBe('verified');
    request.flush({ channelId: 5, newSeries: 1, reusedSeries: 0, importedClips: 1 });
    expect(imported).toBe(5);
    expect(fixture.componentInstance.busy()).toBe(false);
  });
  it('does not import duplicate packages', () => {
    choose();
    fixture.componentInstance.preview.set({ ...preview, alreadyInstalled: true });
    fixture.componentInstance.install();
    http.expectNone(`${base}/import`);
  });
  it('requires rights confirmation before exporting media', () => {
    fixture.componentRef.setInput('channelId', 1);
    fixture.componentInstance.includeMedia = true;
    fixture.componentInstance.download();
    http.expectNone(`${base}/export/1`);
    expect(fixture.componentInstance.error()).toContain('permiso');
  });
  it('handles server errors and restores actionable controls', () => {
    choose();
    fixture.componentInstance.inspect();
    http
      .expectOne(`${base}/preview`)
      .flush({ message: 'Invalid package' }, { status: 400, statusText: 'Bad Request' });
    expect(fixture.componentInstance.error()).toBe('Invalid package');
    expect(fixture.componentInstance.busy()).toBe(false);
  });
  it('sends one explicit sharing permission for the entire export', () => {
    fixture.componentRef.setInput('channelId', 1);
    const component = fixture.componentInstance;
    component.includeMedia = true;
    component.rightsConfirmed = true;
    component.sharingPermission = ' Permission granted by the rights holder ';
    component.download();
    const request = http.expectOne(`${base}/export/1`);
    expect(request.request.body).toEqual({
      includeMedia: true,
      rightsConfirmed: true,
      sharingPermission: 'Permission granted by the rights holder',
    });
    request.error(new ProgressEvent('error'));
  });
});
