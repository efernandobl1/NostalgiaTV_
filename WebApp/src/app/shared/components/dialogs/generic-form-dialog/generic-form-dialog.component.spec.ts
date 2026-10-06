import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Validators } from '@angular/forms';
import { vi } from 'vitest';

import { GenericFormDialogComponent } from './generic-form-dialog.component';

describe('GenericFormDialogComponent', () => {
  let component: GenericFormDialogComponent;
  let fixture: ComponentFixture<GenericFormDialogComponent>;
  const close = vi.fn();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenericFormDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            title: 'Create channel',
            fields: [
              { key: 'name', label: 'Name', type: 'text', validators: [Validators.required] },
            ],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GenericFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides a heading for the accessible dialog title', () => {
    const title = fixture.nativeElement.querySelector('h2[mat-dialog-title]');
    expect(title.textContent).toContain('Create channel');
    expect(title.id).not.toBe('');
  });

  it('does not submit an invalid form', () => {
    close.mockClear();
    component.submit();
    expect(close).not.toHaveBeenCalled();
    expect(component.form.get('name')?.touched).toBe(true);
  });

  it('returns the completed form', () => {
    close.mockClear();
    component.form.get('name')?.setValue('Jetix');
    component.submit();
    expect(close).toHaveBeenCalledWith({ data: { name: 'Jetix' }, isMultipart: false });
  });
});
