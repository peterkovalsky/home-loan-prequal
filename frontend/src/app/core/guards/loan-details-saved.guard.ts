import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { STEP_PATHS } from '../journey/journey-steps';
import { ApplicationStore } from '../state/application.store';

/**
 * Later steps depend on the loan details (About you needs the number of applicants).
 * If the load fails, let the step show its own error rather than redirect in a loop.
 */
export const loanDetailsSavedGuard: CanActivateFn = () => {
	const router = inject(Router);
	return inject(ApplicationStore)
		.ensureLoanDetails()
		.pipe(
			map((details) => (details ? true : router.createUrlTree([STEP_PATHS.loanDetails]))),
			catchError(() => of(true))
		);
};
