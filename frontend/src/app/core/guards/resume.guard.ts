import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { STEP_PATHS } from '../journey/journey-steps';
import { ApplicationStore } from '../state/application.store';

/**
 * Opening the app picks up where the customer left off: About you once Loan details is saved,
 * otherwise Loan details (which restores any draft itself).
 */
export const resumeGuard: CanActivateFn = () => {
	const router = inject(Router);
	return inject(ApplicationStore)
		.ensureLoanDetails()
		.pipe(
			map((details) => router.createUrlTree([details ? STEP_PATHS.aboutYou : STEP_PATHS.loanDetails])),
			catchError(() => of(router.createUrlTree([STEP_PATHS.loanDetails])))
		);
};
