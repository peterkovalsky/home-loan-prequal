import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The frame every journey step sits in: heading, loading state and the error summary. */
@Component({
	selector: 'app-step-card',
	templateUrl: './step-card.component.html',
	styleUrl: './step-card.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepCardComponent {
	readonly heading = input.required<string>();
	readonly subheading = input<string>();
	readonly loading = input(false);
	readonly loadingText = input('Loading your details...');
	readonly errorMessages = input<string[]>([]);
}
