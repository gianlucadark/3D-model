import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';

@Component({
  selector: 'app-screen',
  templateUrl: './screen.component.html',
  styleUrls: ['./screen.component.scss']
})
export class ScreenComponent implements OnInit {
   @Input() isVisible: boolean = false;
   @Input() modalText: string = '';
   @Input() closeButtonText: string = 'Chiudi';

  @Output() close = new EventEmitter<void>();

  constructor() { }

  ngOnInit() {
  }

 closeModal() {
    this.close.emit();
  }

}
