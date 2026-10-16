import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AutosaveStatus } from '../../../core/drafts/draft-autosave';

/** One quiet line telling the customer their progress is kept. Announced politely to screen readers. */
@Component({
	selector: 'app-draft-status',
	template: `<p class="draft-status small mb-0" [class.text-danger]="status() === 'error'" aria-live="polite">
		{{ message() }}
	</p>`,
	styles: `
		.draft-status {
			min-height: 1.5em;
			color: var(--app-text-muted);
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DraftStatusComponent {
	readonly status = input.required<AutosaveStatus>();

	readonly message = computed(() => {
		switch (this.status()) {
			case 'saving':
				return 'Saving your progress…';
			case 'saved':
				return 'Progress saved. You can close this page and carry on later.';
			case 'error':
				return "We couldn't save your progress. We'll try again when you make a change.";
			default:
				return '';
		}
	});
}
