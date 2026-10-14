import { InjectionToken } from '@angular/core';

export interface JourneyStep {
	path: string;
	title: string;
}

export const STEP_PATHS = {
	loanDetails: '/loan-details',
	aboutYou: '/about-you'
} as const;

export const JOURNEY_STEPS: JourneyStep[] = [
	{ path: STEP_PATHS.loanDetails, title: 'Loan details' },
	{ path: STEP_PATHS.aboutYou, title: 'About you' }
];

/** The ordered steps for this journey. A token so tests (and later, per-lender config) can supply their own. */
export const JOURNEY = new InjectionToken<readonly JourneyStep[]>('JOURNEY', { factory: () => JOURNEY_STEPS });
