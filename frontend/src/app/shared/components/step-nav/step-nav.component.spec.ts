import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { JOURNEY } from '../../../core/journey/journey-steps';
import { ApplicationStore } from '../../../core/state/application.store';
import { StepNavComponent } from './step-nav.component';

describe('StepNavComponent', () => {
	let fixture: ComponentFixture<StepNavComponent>;
	const completed = signal<ReadonlySet<string>>(new Set());

	beforeEach(() => {
		const store = {
			completedSteps: completed,
			ensureLoanDetails: () => of(null),
			ensureApplicants: () => of(null)
		};
		TestBed.configureTestingModule({
			imports: [StepNavComponent],
			providers: [
				provideRouter([]),
				{ provide: ApplicationStore, useValue: store },
				{
					provide: JOURNEY,
					useValue: [
						{ path: '/one', title: 'One' },
						{ path: '/two', title: 'Two' }
					]
				}
			]
		});
		fixture = TestBed.createComponent(StepNavComponent);
	});

	const links = () =>
		Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map((a) =>
			a.textContent?.replace(/\s+/g, ' ').trim()
		);

	it('numbers each step', () => {
		completed.set(new Set());
		fixture.detectChanges();

		expect(links()).toEqual(['1 One', '2 Two']);
	});

	it('ticks completed steps and says so to screen readers', () => {
		completed.set(new Set(['/one']));
		fixture.detectChanges();

		expect(links()).toEqual(['One (completed)', '2 Two']);
		expect((fixture.nativeElement as HTMLElement).querySelector('.step-nav__index--done svg')).not.toBeNull();
	});
});
