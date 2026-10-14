import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { EMPTY, catchError, merge } from 'rxjs';
import { JourneyService } from '../../../core/journey/journey.service';
import { ApplicationStore } from '../../../core/state/application.store';

@Component({
	selector: 'app-step-nav',
	imports: [RouterLink, RouterLinkActive],
	templateUrl: './step-nav.component.html',
	styleUrl: './step-nav.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepNavComponent implements OnInit {
	private readonly store = inject(ApplicationStore);

	readonly steps = inject(JourneyService).steps;
	readonly completedSteps = this.store.completedSteps;

	ngOnInit(): void {
		// Load (or reuse) the saved data so completed steps get their tick on first visit. A failure
		// here only means no ticks; the step itself reports load errors.
		merge(this.store.ensureLoanDetails(), this.store.ensureApplicants())
			.pipe(catchError(() => EMPTY))
			.subscribe();
	}
}
