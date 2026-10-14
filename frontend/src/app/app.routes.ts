import { Routes } from '@angular/router';
import { LoanDetailsComponent } from './features/loan-details/loan-details.component';

export const routes: Routes = [
	{ path: '', redirectTo: 'loan-details', pathMatch: 'full' },
	{ path: 'loan-details', component: LoanDetailsComponent, title: 'Loan details' },
	{ path: '**', redirectTo: 'loan-details' }
];
