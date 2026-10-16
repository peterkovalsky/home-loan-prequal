import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { STEP_PATHS } from '../journey/journey-steps';
import { ApplicationStore } from './application.store';

/**
 * Starts a new application on this device: "Not you?" and "Start a new application" after
 * submitting. The current application isn't deleted: nobody can reach it without its token, a
 * submitted one is the lender's record, and an unfinished one is purged after 7 days.
 */
@Injectable({ providedIn: 'root' })
export class StartOver {
	private readonly store = inject(ApplicationStore);
	private readonly document = inject(DOCUMENT);

	run(): void {
		this.store.startOver();
		// A fresh page load: every step and cache starts empty, with no half-reset state.
		this.document.location.assign(STEP_PATHS.loanDetails);
	}
}
