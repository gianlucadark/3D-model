import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComputerComponent } from './computer/computer.component';
import { ScreenComponent } from './screen/screen.component';

const routes: Routes = [
  { path: '', component: ComputerComponent },
  { path: 'monitor', component: ScreenComponent },
  { path: '**', redirectTo: '' } // fallback per rotte non trovate
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
