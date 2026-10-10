import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DevicesComponent } from './devices.component';
import { DeviceAccessService } from './device-access.service';
import { WatchedService } from '../../../core/services/watched.service';

describe('DevicesComponent', () => {
  const access = { inspect: vi.fn(), approve: vi.fn(), createQr: vi.fn() };
  const watched = { connect: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    access.inspect.mockReturnValue(of({ name: 'Living room TV', expiresAtUtc: new Date(Date.now() + 600000).toISOString() }));
    access.approve.mockReturnValue(of(null));
    watched.connect.mockReturnValue(of({}));
    await TestBed.configureTestingModule({ imports: [DevicesComponent], providers: [
      { provide: DeviceAccessService, useValue: access }, { provide: WatchedService, useValue: watched },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ code: 'ABC-DEF-GHJ-KLM' }) } } },
    ] }).compileComponents();
  });

  it('inspects a QR link but waits for explicit authorization', () => {
    const fixture = TestBed.createComponent(DevicesComponent);
    fixture.detectChanges();
    expect(access.inspect).toHaveBeenCalledWith('ABC-DEF-GHJ-KLM');
    expect(access.approve).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Living room TV');
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((item: any) => item.textContent.includes('Autorizar')) as HTMLButtonElement;
    button.click();
    expect(access.approve).toHaveBeenCalledWith('ABC-DEF-GHJ-KLM');
    expect(watched.connect).toHaveBeenCalled();
    fixture.destroy();
  });

  it('does not authorize an expired or invalid code', () => {
    access.inspect.mockReturnValue(throwError(() => ({ status: 404 })));
    const fixture = TestBed.createComponent(DevicesComponent);
    fixture.detectChanges();
    fixture.componentInstance.approve();
    expect(access.approve).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('expiró');
    fixture.destroy();
  });

  it('reports a browser synchronization error without losing authorization confirmation', () => {
    watched.connect.mockReturnValue(throwError(() => ({ status: 503 })));
    const fixture = TestBed.createComponent(DevicesComponent);
    fixture.componentInstance.approve();
    expect(fixture.componentInstance.message()).toContain('Pantalla autorizada');
    expect(fixture.componentInstance.error()).toContain('no se pudo sincronizar');
    fixture.destroy();
  });
});
