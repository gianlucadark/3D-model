import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ComputerComponent } from './computer/computer.component';
import { DemoComponent } from './demo/demo.component';
import { ScreenComponent } from './screen/screen.component';
import { RobotDogModalComponent } from './robot-dog-modal/robot-dog-modal.component';
import { ResearchModalComponent } from './research-modal/research-modal.component';

@NgModule({
  declarations: [
    AppComponent,
    ComputerComponent,
    DemoComponent,
    ScreenComponent,
    ResearchModalComponent,
    RobotDogModalComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
