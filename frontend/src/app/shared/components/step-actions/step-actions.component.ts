import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Back / Continue footer. Continue is a submit button, so place this inside the step's form. */
@Component({
	selector: 'app-step-actions',
	templateUrl: './step-actions.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepActionsComponent {
	readonly saving = input(false);
	readonly showBack = input(false);
	readonly continueLabel = input('Continue');
	readonly back = output<void>();
}
