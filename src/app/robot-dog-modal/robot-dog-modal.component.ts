import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-robot-dog-modal',
    templateUrl: './robot-dog-modal.component.html',
    styleUrls: ['./robot-dog-modal.component.scss']
})
export class RobotDogModalComponent {
    @Input() isVisible = false;
    @Output() close = new EventEmitter<void>();

    onClose() {
        this.close.emit();
    }
}
