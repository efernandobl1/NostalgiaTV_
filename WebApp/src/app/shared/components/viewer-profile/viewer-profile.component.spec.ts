import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { WatchedService, ViewerSession } from '../../../core/services/watched.service';
import { SeasonalThemeService } from '../../../core/services/seasonal-theme.service';
import { ViewerProfileComponent } from './viewer-profile.component';

describe('ViewerProfileComponent', () => {
  const session: ViewerSession = {
    profileId: 'profile-one',
    progress: [],
    devices: [
      {
        id: 'device-one',
        name: 'TV de la sala',
        current: true,
        lastSeenUtc: '2026-10-07T12:00:00Z',
      },
    ],
  };
  const pairing = { code: 'ABC-DEF-GHJ-KLM', expiresAtUtc: '2026-10-07T12:10:00Z' };
  const watched = {
    session: signal<ViewerSession | null>(session),
    syncError: signal(''),
    connect: vi.fn(),
    createCode: vi.fn(),
    pair: vi.fn(),
    unlink: vi.fn(),
  };
  const theme = { enabled: signal(true), effects: signal(true), toggleEffects: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    watched.session.set(session);
    watched.syncError.set('');
    watched.connect.mockImplementation(() => {
      watched.session.set(session);
      return of(session);
    });
    watched.createCode.mockReturnValue(of(pairing));
    watched.pair.mockReturnValue(of(null));
    watched.unlink.mockReturnValue(of(null));
    theme.enabled.set(true);
    TestBed.configureTestingModule({
      imports: [ViewerProfileComponent],
      providers: [
        { provide: WatchedService, useValue: watched },
        { provide: SeasonalThemeService, useValue: theme },
      ],
    });
  });

  function setup() {
    const fixture = TestBed.createComponent(ViewerProfileComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows one main action and keeps device management and appearance collapsed', () => {
    const fixture = setup();
    expect(fixture.nativeElement.querySelector('.profile-primary').textContent).toContain(
      'Añadir dispositivo',
    );
    expect(fixture.nativeElement.querySelector('.pairing-flow')).toBeNull();
    expect(
      [...fixture.nativeElement.querySelectorAll('details')].every((item: any) => !item.open),
    ).toBe(true);
    expect(fixture.nativeElement.querySelector('summary').textContent).toContain('(1)');
  });

  it('activates synchronization with a safe default name', () => {
    watched.session.set(null);
    const fixture = setup();
    fixture.componentInstance.name = '  ';
    fixture.componentInstance.connect();
    fixture.detectChanges();
    expect(watched.connect).toHaveBeenCalledWith('Mi dispositivo');
    expect(fixture.nativeElement.querySelector('.profile-primary').textContent).toContain(
      'Añadir dispositivo',
    );
    expect(watched.createCode).not.toHaveBeenCalled();
  });

  it('asks which screen is being used without generating codes automatically', () => {
    const fixture = setup();
    fixture.nativeElement.querySelector('.profile-primary').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.pairing-choices button').length).toBe(2);
    expect(fixture.nativeElement.querySelector('input[name="pairCode"]')).toBeNull();
    expect(watched.createCode).not.toHaveBeenCalled();
  });

  it('generates a code only for the new-screen flow and clears it when cancelled', () => {
    const fixture = setup();
    fixture.componentInstance.startPairing();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.pairing-choices button').click();
    fixture.detectChanges();
    expect(watched.createCode).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('output').textContent).toBe(pairing.code);
    expect(fixture.nativeElement.querySelector('input[name="pairCode"]')).toBeNull();
    fixture.nativeElement.querySelector('.profile-cancel').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.code()).toBeNull();
    expect(fixture.componentInstance.pairingMode()).toBeNull();
    expect(fixture.nativeElement.querySelector('output')).toBeNull();
  });

  it('accepts the other screen code without creating another code', () => {
    const fixture = setup();
    fixture.componentInstance.enterPairingCode();
    fixture.detectChanges();
    const submit = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submit.disabled).toBe(true);
    fixture.componentInstance.enteredCode = `  ${pairing.code}  `;
    fixture.componentInstance.pair();
    fixture.detectChanges();
    expect(watched.pair).toHaveBeenCalledWith(pairing.code);
    expect(watched.createCode).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pairingMode()).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Dispositivo vinculado',
    );
  });

  it('preserves the entered code after an error so the user can retry', () => {
    watched.pair.mockReturnValue(throwError(() => ({ status: 400 })));
    const fixture = setup();
    fixture.componentInstance.enterPairingCode();
    fixture.componentInstance.enteredCode = pairing.code;
    fixture.componentInstance.pair();
    fixture.detectChanges();
    expect(fixture.componentInstance.enteredCode).toBe(pairing.code);
    expect(fixture.componentInstance.pairingMode()).toBe('enter');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'genera otro',
    );
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it('explains the device limit instead of treating it as an invalid code', () => {
    watched.pair.mockReturnValue(throwError(() => ({ status: 409 })));
    const fixture = setup();
    fixture.componentInstance.enteredCode = pairing.code;
    fixture.componentInstance.pair();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'diez dispositivos',
    );
  });

  it('blocks duplicate requests while a code is being generated', () => {
    const pending = new Subject<typeof pairing>();
    watched.createCode.mockReturnValue(pending);
    const fixture = setup();
    fixture.componentInstance.generate();
    fixture.componentInstance.generate();
    fixture.detectChanges();
    expect(watched.createCode).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.profile-cancel').disabled).toBe(true);
    pending.next(pairing);
    pending.complete();
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it('closes the code automatically when the server reports that this device joined the other profile', () => {
    const fixture = setup();
    fixture.componentInstance.generate();
    fixture.detectChanges();
    watched.session.set({ ...session, profileId: 'shared-profile' });
    fixture.detectChanges();
    expect(fixture.componentInstance.pairingMode()).toBeNull();
    expect(fixture.componentInstance.code()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('ya comparte lo visto');
  });

  it('keeps unlink confirmation and supports cancelling it', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = setup();
    fixture.componentInstance.unlink('device-one');
    expect(watched.unlink).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fixture.componentInstance.unlink('device-one');
    expect(watched.unlink).toHaveBeenCalledWith('device-one');
    confirm.mockRestore();
  });
});
