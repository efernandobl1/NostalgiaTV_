import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenericFormDialogComponent } from './generic-form-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

describe('GenericFormDialogComponent', () => {
  let component: GenericFormDialogComponent;
  let fixture: ComponentFixture<GenericFormDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenericFormDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: { title: 'Test', fields: [] } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GenericFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
