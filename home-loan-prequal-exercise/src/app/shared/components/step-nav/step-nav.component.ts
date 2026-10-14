import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { JOURNEY_STEPS } from '../../../core/journey/journey-steps';

@Component({
	selector: 'app-step-nav',
	imports: [RouterLink, RouterLinkActive],
	templateUrl: './step-nav.component.html',
	styleUrl: './step-nav.component.scss'
})
export class StepNavComponent {
	readonly steps = JOURNEY_STEPS;
}
