import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { COMPLETE_PATH, STEP_PATHS } from '../journey/journey-steps';
import { ApplicationStore } from '../state/application.store';

/** The furthest point the customer has reached: submitted, About you, or Loan details. */
function furthest(): Observable<UrlTree> {
	const router = inject(Router);
	return inject(ApplicationStore)
		.ensureProgress()
		.pipe(
			map((completed) =>
				router.createUrlTree([
					completed.has(STEP_PATHS.aboutYou)
						? COMPLETE_PATH
						: completed.has(STEP_PATHS.loanDetails)
							? STEP_PATHS.aboutYou
							: STEP_PATHS.loanDetails
				])
			),
			catchError(() => of(router.createUrlTree([STEP_PATHS.loanDetails])))
		);
}

/** Opening the app picks up where the customer left off (each step restores its own draft). */
export const resumeGuard: CanActivateFn = () => furthest();

/** The completion screen is only for a submitted application; anyone else goes where they left off. */
export const submittedGuard: CanActivateFn = () => {
	const router = inject(Router);
	return furthest().pipe(map((target) => (router.serializeUrl(target) === COMPLETE_PATH ? true : target)));
};
