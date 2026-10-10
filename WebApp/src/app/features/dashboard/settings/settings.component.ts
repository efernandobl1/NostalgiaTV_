import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PlatformSettings, PlatformSettingsService } from '../../../core/services/platform-settings.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly service = inject(PlatformSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly builder = inject(FormBuilder);
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly timeZones = ['America/Guatemala', 'America/Mexico_City', 'America/Bogota', 'America/Lima',
    'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/New_York', 'Europe/Madrid', 'UTC'];
  readonly appearance = [
    { key: 'seasonalThemesEnabled', title: 'Temas de temporada', description: 'Halloween permanece activo durante todo octubre, según la zona horaria configurada.' },
    { key: 'seasonalEffectsEnabled', title: 'Efectos ambientales', description: 'Arañas y detalles animados. Cada visitante puede reducirlos; se respeta la preferencia de movimiento reducido.' },
  ];
  readonly programming = [
    { key: 'seasonalEpisodesEnabled', title: 'Preferir especiales de temporada', description: 'Prioriza Halloween en octubre y Navidad en diciembre, sin saltarse el descanso entre repeticiones.' },
    { key: 'seasonalInterludesEnabled', title: 'Bumpers y publicidad de temporada', description: 'Incluye las piezas aprobadas de la época junto a las de todo el año, dentro de las eras asignadas.' },
  ];
  readonly form = this.builder.nonNullable.group({
    publicRegistrationEnabled: false,
    seasonalThemesEnabled: true,
    seasonalEffectsEnabled: true,
    seasonalEpisodesEnabled: true,
    seasonalInterludesEnabled: true,
    timeZoneId: ['America/Guatemala', Validators.required],
    noRepeatWindowHours: [24, [Validators.required, Validators.min(0), Validators.max(72), Validators.pattern(/^\d+$/)]],
    maxSpecialsPerSeriesPerDay: [2, [Validators.required, Validators.min(0), Validators.max(50), Validators.pattern(/^\d+$/)]],
    maxSpecialsPerDay: [5, [Validators.required, Validators.min(0), Validators.max(50), Validators.pattern(/^\d+$/)]],
    maxMoviesPerSeriesPerDay: [2, [Validators.required, Validators.min(0), Validators.max(20), Validators.pattern(/^\d+$/)]],
    maxMoviesPerDay: [2, [Validators.required, Validators.min(0), Validators.max(20), Validators.pattern(/^\d+$/)]],
  }, { validators: control => {
    const values = control.value as PlatformSettings;
    return values.maxSpecialsPerSeriesPerDay > values.maxSpecialsPerDay
      || values.maxMoviesPerSeriesPerDay > values.maxMoviesPerDay ? { dailyLimits: true } : null;
  } });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.saved.set(false));
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.loaded.set(false);
    this.error.set('');
    this.service.load().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({
      next: settings => {
        if (!this.timeZones.includes(settings.timeZoneId)) this.timeZones.push(settings.timeZoneId);
        this.form.reset(settings);
        this.loaded.set(true);
      },
      error: () => this.error.set('No se pudo cargar la configuración. No se ha cambiado ningún ajuste.'),
    });
  }
  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || !this.loaded()) return;
    this.error.set('');
    this.saved.set(false);
    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.service.save(this.form.getRawValue()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.saving.set(false); this.form.enable({ emitEvent: false }); }),
    ).subscribe({
      next: settings => { this.form.reset(settings); this.saved.set(true); },
      error: () => this.error.set('No se pudo guardar. Comprueba los valores y vuelve a intentarlo; tus cambios siguen aquí.'),
    });
  }
}
