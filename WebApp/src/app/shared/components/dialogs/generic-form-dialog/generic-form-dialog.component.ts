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
import { MatCheckboxModule } from '@angular/material/checkbox';

export interface DialogField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'checkboxes' | 'date' | 'datepicker' | 'file';
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
    MatCheckboxModule,
    SimpleFuComponent
  ],
  templateUrl: './generic-form-dialog.component.html',
  styleUrl: './generic-form-dialog.component.scss',
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
      const isArrayField = field.type === 'multiselect' || field.type === 'checkboxes';
      const initialValue = config.data?.[field.key] ?? (isArrayField ? [] : '');
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

  // ── Checkboxes agrupados (p. ej. menús de un rol) ──────────────────────────
  isChecked(key: string, value: any): boolean {
    const arr = this.form.get(key)?.value;
    return Array.isArray(arr) && arr.includes(value);
  }

  toggleCheckbox(key: string, value: any, checked: boolean) {
    const ctrl = this.form.get(key);
    const arr: any[] = Array.isArray(ctrl?.value) ? [...ctrl!.value] : [];
    const idx = arr.indexOf(value);
    if (checked && idx === -1) arr.push(value);
    else if (!checked && idx !== -1) arr.splice(idx, 1);
    ctrl?.setValue(arr);
    ctrl?.markAsDirty();
  }

  // Marca/desmarca todas las opciones de un grupo (encabezado de sección).
  toggleGroup(key: string, options: { value: any }[], checked: boolean) {
    const ctrl = this.form.get(key);
    const set = new Set<any>(Array.isArray(ctrl?.value) ? ctrl!.value : []);
    options.forEach(o => (checked ? set.add(o.value) : set.delete(o.value)));
    ctrl?.setValue([...set]);
    ctrl?.markAsDirty();
  }

  isGroupAllChecked(key: string, options: { value: any }[]): boolean {
    return options.length > 0 && options.every(o => this.isChecked(key, o.value));
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
