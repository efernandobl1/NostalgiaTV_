import { Injectable, signal } from '@angular/core';

/** Mock viewer session (no backend yet): toggled by the auth screens and the profile menu. */
@Injectable({ providedIn: 'root' })
export class Session {
  readonly signedIn = signal(true);
  readonly user = 'fernando';
  readonly initials = 'FE';

  signIn(): void { this.signedIn.set(true); }
  signOut(): void { this.signedIn.set(false); }
}
