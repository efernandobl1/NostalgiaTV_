import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { ChannelPackagesService, PackagePreview } from './channel-packages.service';
import { interludeSeasonLabel } from '../broadcast-admin.service';

@Component({
  selector: 'app-channel-package',
  imports: [FormsModule],
  templateUrl: './channel-package.component.html',
  styleUrl: './channel-package.component.scss',
})
export class ChannelPackageComponent implements OnInit {
  readonly catalogUrl = signal<string | null>(null);
  readonly channelId = input<number | null>(null);
  readonly imported = output<number>();
  readonly busy = signal(false);
  readonly stage = signal('');
  readonly error = signal('');
  readonly feedback = signal('');
  readonly preview = signal<PackagePreview | null>(null);
  readonly seasonLabel = interludeSeasonLabel;
  includeMedia = false;
  rightsConfirmed = false;
  sharingPermission = '';
  private file?: File;
  private readonly service = inject(ChannelPackagesService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.service
      .catalogConfiguration()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ publicUrl }) => {
          if (!publicUrl) return;
          try {
            const url = new URL(publicUrl);
            if (
              (url.protocol === 'https:' ||
                (url.protocol === 'http:' &&
                  ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) &&
              !url.username &&
              !url.password &&
              url.pathname === '/' &&
              !url.search &&
              !url.hash
            )
              this.catalogUrl.set(url.origin);
          } catch {
            /* A catalog link is optional and never receives this server's credentials. */
          }
        },
        error: () => this.catalogUrl.set(null),
      });
  }

  chooseFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0];
    this.preview.set(null);
    this.error.set('');
    this.feedback.set('');
  }
  inspect(): void {
    if (this.busy()) return;
    if (!this.file || !/\.ntv\.zip$/i.test(this.file.name) || this.file.size > 524288000) {
      this.error.set('Selecciona un paquete .ntv.zip de hasta 500 MiB.');
      return;
    }
    this.start('Revisando paquete…');
    this.service
      .preview(this.file)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (preview) => this.preview.set(preview),
        error: (error) => this.report(error),
      });
  }
  install(): void {
    const preview = this.preview();
    if (this.busy() || !this.file || !preview || preview.alreadyInstalled) return;
    this.start('Validando archivos e instalando…');
    this.service
      .install(this.file, preview.fingerprint)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => this.imported.emit(result.channelId),
        error: (error) => this.report(error),
      });
  }
  download(): void {
    const id = this.channelId();
    if (!id || this.busy()) return;
    if (this.includeMedia && !this.rightsConfirmed) {
      this.error.set('Confirma que tienes permiso para compartir los archivos.');
      return;
    }
    this.start('Preparando descarga…');
    this.service
      .export(id, this.includeMedia, this.rightsConfirmed, this.sharingPermission.trim())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `channel-${id}.ntv.zip`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          this.feedback.set(
            'Paquete preparado. Comprueba los archivos incluidos antes de compartirlo.',
          );
        },
        error: async (error: HttpErrorResponse) => {
          if (error.error instanceof Blob) {
            try {
              this.report({ error: JSON.parse(await error.error.text()) });
            } catch {
              this.report(error);
            }
          } else this.report(error);
        },
      });
  }
  private start(stage: string): void {
    this.busy.set(true);
    this.stage.set(stage);
    this.error.set('');
    this.feedback.set('');
  }
  private report(error: { error?: { message?: string } }): void {
    this.error.set(
      typeof error.error?.message === 'string'
        ? error.error.message
        : 'No se pudo procesar el paquete. Inténtalo nuevamente.',
    );
  }
}
