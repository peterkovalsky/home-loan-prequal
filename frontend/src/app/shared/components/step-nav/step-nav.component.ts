import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { JourneyService } from '../../../core/journey/journey.service';

@Component({
	selector: 'app-step-nav',
	imports: [RouterLink, RouterLinkActive],
	templateUrl: './step-nav.component.html',
	styleUrl: './step-nav.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepNavComponent {
	readonly steps = inject(JourneyService).steps;
}
