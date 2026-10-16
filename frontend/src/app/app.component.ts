import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApplicationSession } from './core/session/application-session';
import { StartOver } from './core/state/start-over';
import { StepNavComponent } from './shared/components/step-nav/step-nav.component';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, StepNavComponent],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
	private readonly startOverService = inject(StartOver);

	readonly hasApplication = inject(ApplicationSession).applicationId;

	/** For a shared computer: forget this device's application and start a blank one. */
	startOver(): void {
		this.startOverService.run();
	}
}
