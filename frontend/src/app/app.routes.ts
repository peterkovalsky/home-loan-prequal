import { Routes } from '@angular/router';
import { STEP_PATHS } from './core/journey/journey-steps';

const path = (stepPath: string) => stepPath.replace(/^\//, '');

export const routes: Routes = [
	{ path: '', redirectTo: path(STEP_PATHS.loanDetails), pathMatch: 'full' },
	{
		path: path(STEP_PATHS.loanDetails),
		loadComponent: () =>
			import('./features/loan-details/loan-details.component').then((m) => m.LoanDetailsComponent),
		title: 'Loan details'
	},
	{ path: '**', redirectTo: path(STEP_PATHS.loanDetails) }
];
