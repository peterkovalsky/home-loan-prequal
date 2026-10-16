import { Routes } from '@angular/router';
import { loanDetailsSavedGuard } from './core/guards/loan-details-saved.guard';
import { resumeGuard, submittedGuard } from './core/guards/resume.guard';
import { COMPLETE_PATH, STEP_PATHS } from './core/journey/journey-steps';

const path = (stepPath: string) => stepPath.replace(/^\//, '');

export const routes: Routes = [
	{ path: '', pathMatch: 'full', canActivate: [resumeGuard], children: [] },
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
	{
		path: path(COMPLETE_PATH),
		loadComponent: () => import('./features/complete/complete.component').then((m) => m.CompleteComponent),
		canActivate: [submittedGuard],
		title: 'Application submitted'
	},
	{ path: '**', redirectTo: path(STEP_PATHS.loanDetails) }
];
