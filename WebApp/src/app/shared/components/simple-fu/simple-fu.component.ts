import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { FileUploadControl, FileUploadModule } from '@iplab/ngx-file-upload';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-simple-fu',
    imports: [FileUploadModule],
    templateUrl: './simple-fu.component.html',
    styleUrl: './simple-fu.component.scss',
})
export class SimpleFuComponent implements OnDestroy {
    public fileUploadControl = new FileUploadControl();
    private subscription: Subscription;

    @Output() fileSelected = new EventEmitter<File>();

    constructor() {
        this.subscription = this.fileUploadControl.valueChanges.subscribe(files => {
            console.log('valueChanges files:', files);
            if (files?.length) {
                this.fileSelected.emit(files[0]);
            }
        });
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
