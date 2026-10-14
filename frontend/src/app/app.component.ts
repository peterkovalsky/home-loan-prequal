import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StepNavComponent } from './shared/components/step-nav/step-nav.component';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, StepNavComponent],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {}
