import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CustomizerSettingsService } from '../../customizer-settings/customizer-settings.service';
import { MatCardActions, MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SimpleFuComponent } from '../../simple-fu/simple-fu.component';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

export interface DialogField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'datepicker' | 'file';
  validators?: ValidatorFn[];
  options?: { value: any; label: string }[];
  // Para multiselect agrupado (p. ej. menús por sección). Si viene, tiene prioridad sobre options.
  groups?: { label: string; options: { value: any; label: string }[] }[];
  hint?: string;
  // Multiselect "creable": permite crear una opción nueva al vuelo (p. ej. categorías).
  creatable?: boolean;
  onCreate?: (label: string) => import('rxjs').Observable<{ value: any; label: string }>;
}

export interface DialogConfig<T = any> {
  title: string;
  fields: DialogField[];
  data?: T;
}

@Component({
  selector: 'app-generic-form-dialog',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCardActions,
    MatCardModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    SimpleFuComponent
  ],
  templateUrl: './generic-form-dialog.component.html',
})
export class GenericFormDialogComponent {
  form: FormGroup;
  isEdit: boolean;
  previewUrls: Record<string, string> = {};

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<GenericFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: DialogConfig,
    public themeService: CustomizerSettingsService,
  ) {
    this.isEdit = !!config.data;
    const controls: Record<string, any> = {};

    config.fields.forEach((field) => {
      const initialValue = config.data?.[field.key] ?? (field.type === 'multiselect' ? [] : '');
      controls[field.key] = [initialValue, field.validators ?? []];
      // Load existing preview for file fields on edit
      if (field.type === 'file' && config.data?.[field.key]) {
        this.previewUrls[field.key] = config.data[field.key];
      }
    });
    this.form = this.fb.group(controls);
  }

  fileSelectionMode: 'upload' | 'url' = 'upload';
  selectedFiles: Record<string, File> = {};
  fileUrls: Record<string, string> = {};

  // Estado para el multiselect "creable" (crear opción al vuelo).
  newOptionLabel: Record<string, string> = {};
  creating: Record<string, boolean> = {};

  createOption(field: DialogField) {
    const label = (this.newOptionLabel[field.key] ?? '').trim();
    if (!label || !field.onCreate || this.creating[field.key]) return;
    this.creating[field.key] = true;
    field.onCreate(label).subscribe({
      next: (opt) => {
        field.options = [...(field.options ?? []), opt];
        const ctrl = this.form.get(field.key);
        ctrl?.setValue([...(ctrl.value ?? []), opt.value]);
        this.newOptionLabel[field.key] = '';
        this.creating[field.key] = false;
      },
      error: () => { this.creating[field.key] = false; },
    });
  }

  onFileSelected(file: File, key: string) {
    this.selectedFiles = { ...this.selectedFiles, [key]: file };
    const reader = new FileReader();
    reader.onload = (e) =>
      (this.previewUrls = { ...this.previewUrls, [key]: e.target?.result as string });
    reader.readAsDataURL(file);
    this.form.get(key)?.setValue(file.name);
    this.form.get(key)?.markAsTouched();
  }

  getFileValue(key: string): File | string | null {
    if (this.fileSelectionMode === 'upload') return this.selectedFiles[key] ?? null;
    return this.fileUrls[key] ?? null;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = { ...this.form.value };

    // Formatear fechas
    this.config.fields.forEach((field) => {
      if (field.type === 'datepicker' && values[field.key]) {
        values[field.key] = new Date(values[field.key]).toISOString();
      }
    });

    // Si hay archivos construir FormData
    const hasFiles = Object.keys(this.selectedFiles).length > 0;
    if (hasFiles) {
      const formData = new FormData();
      Object.keys(values).forEach((key) => {
        if (values[key] !== null && values[key] !== undefined) {
          formData.append(key, values[key]);
        }
      });
      Object.keys(this.selectedFiles).forEach((key) => {
        formData.append(key, this.selectedFiles[key]);
      });
      this.dialogRef.close({ formData, isMultipart: true });
    } else {
      this.dialogRef.close({ data: values, isMultipart: false });
    }
  }

  cancel() {
    this.dialogRef.close();
  }
}
