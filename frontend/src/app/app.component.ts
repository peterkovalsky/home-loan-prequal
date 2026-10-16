import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { STEP_PATHS } from './core/journey/journey-steps';
import { ApplicationSession } from './core/session/application-session';
import { ApplicationStore } from './core/state/application.store';
import { StepNavComponent } from './shared/components/step-nav/step-nav.component';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, StepNavComponent],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
	private readonly store = inject(ApplicationStore);
	private readonly document = inject(DOCUMENT);

	readonly hasApplication = inject(ApplicationSession).applicationId;

	/**
	 * For a shared computer: forget this device's application and start a blank one. The old one
	 * isn't deleted (its owner may still want it); nobody can reach it without its token, and an
	 * unfinished one is purged after 7 days.
	 */
	startOver(): void {
		this.store.startOver();
		// A fresh page load: every step and cache starts empty, with no half-reset state.
		this.document.location.assign(STEP_PATHS.loanDetails);
	}
}
