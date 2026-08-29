import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FileUploadModule } from '@iplab/ngx-file-upload';

@Component({
  selector: 'app-multiple-fu',
  imports: [FileUploadModule],
  templateUrl: './multiple-fu.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './multiple-fu.component.scss',
})
export class MultipleFuComponent {}
