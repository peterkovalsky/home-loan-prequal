import { Routes } from '@angular/router';
import { loanDetailsSavedGuard } from './core/guards/loan-details-saved.guard';
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
	{
		path: path(STEP_PATHS.aboutYou),
		loadComponent: () => import('./features/about-you/about-you.component').then((m) => m.AboutYouComponent),
		canActivate: [loanDetailsSavedGuard],
		title: 'About you'
	},
	{ path: '**', redirectTo: path(STEP_PATHS.loanDetails) }
];
