import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComputerComponent } from './computer/computer.component';

const routes: Routes = [
  { path: '', component: ComputerComponent },
  { path: '**', redirectTo: '' } // fallback per rotte non trovate
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
