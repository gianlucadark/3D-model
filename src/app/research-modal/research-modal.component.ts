import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-research-modal',
    templateUrl: './research-modal.component.html',
    styleUrls: ['./research-modal.component.scss']
})
export class ResearchModalComponent {
    @Input() isVisible = false;
    @Output() close = new EventEmitter<void>();

    onClose() {
        this.close.emit();
    }
}
