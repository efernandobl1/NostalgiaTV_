import { signal } from '@angular/core';
import { InterludeForm } from '../../../core/api/admin-api';
import { InterludeItem } from '../../../core/api/models';

/** Editable fields of an interlude, shared by the upload panel and the edit dialog. */
export class InterludeFields {
  readonly title = signal('');
  readonly kind = signal('Bumper');
  readonly bumperType = signal('ComingUp');
  readonly season = signal('AllYear');
  readonly region = signal('');
  readonly yearFrom = signal<string | number>('');
  readonly yearTo = signal<string | number>('');
  readonly sourceUrl = signal('');
  readonly redistribution = signal(false);
  readonly license = signal('');
  readonly approved = signal(true);

  /** The API requires a license when redistribution is allowed. */
  licenseMissing(): boolean { return this.redistribution() && !this.license().trim(); }

  load(item: InterludeItem): void {
    this.title.set(item.title);
    this.kind.set(item.kind);
    this.bumperType.set(item.bumperType ?? 'ComingUp');
    this.season.set(item.season);
    this.region.set(item.regionCode ?? '');
    this.yearFrom.set(item.originalYearFrom ?? '');
    this.yearTo.set(item.originalYearTo ?? '');
    this.sourceUrl.set(item.sourceUrl ?? '');
    this.redistribution.set(item.redistributionAllowed);
    this.license.set(item.license ?? '');
    this.approved.set(item.approvedForBroadcast);
  }

  value(): InterludeForm {
    const year = (v: string | number) => (v === '' || v === null ? null : Number(v) || null);
    return {
      title: this.title().trim() || null, kind: this.kind(), bumperType: this.kind() === 'Bumper' ? this.bumperType() : null, season: this.season(),
      redistributionAllowed: this.redistribution(), license: this.license().trim() || null, sourceUrl: this.sourceUrl().trim() || null,
      regionCode: this.region().trim() || null, originalYearFrom: year(this.yearFrom()), originalYearTo: year(this.yearTo()),
    };
  }
}
