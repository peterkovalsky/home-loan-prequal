import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApplicationStore } from '../../core/state/application.store';
import { StartOver } from '../../core/state/start-over';

/** After About you is saved: the application is submitted. A reference to quote, and a way to start another. */
@Component({
	selector: 'app-complete',
	templateUrl: './complete.component.html',
	styleUrl: './complete.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompleteComponent {
	private readonly store = inject(ApplicationStore);
	private readonly startOverService = inject(StartOver);

	readonly firstName = computed(() => this.store.applicants()?.applicants[0]?.firstName ?? null);
	/** Something to quote on the phone. The id isn't a secret; the resume token is. */
	readonly reference = computed(() => {
		const id = this.store.applicationId();
		return id === null ? null : `HL-${id}`;
	});

	startNewApplication(): void {
		this.startOverService.run();
	}
}
