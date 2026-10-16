import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApplicantsResponse } from '../../core/models/applicant.model';
import { ApplicationStore } from '../../core/state/application.store';
import { StartOver } from '../../core/state/start-over';
import { CompleteComponent } from './complete.component';

describe('CompleteComponent', () => {
	let fixture: ComponentFixture<CompleteComponent>;
	let startOver: jasmine.SpyObj<StartOver>;
	const applicants = signal<ApplicantsResponse | null>(null);

	beforeEach(() => {
		applicants.set({ applicationId: 1000042, applicants: [{ firstName: 'Alex' }] } as ApplicantsResponse);
		startOver = jasmine.createSpyObj<StartOver>('StartOver', ['run']);
		TestBed.configureTestingModule({
			imports: [CompleteComponent],
			providers: [
				{
					provide: ApplicationStore,
					useValue: { applicants: applicants.asReadonly(), applicationId: computed(() => 1000042) }
				},
				{ provide: StartOver, useValue: startOver }
			]
		});
		fixture = TestBed.createComponent(CompleteComponent);
		fixture.detectChanges();
	});

	const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

	it('confirms the submission, thanks the primary applicant and gives a reference to quote', () => {
		expect(text()).toContain('Application submitted');
		expect(text()).toContain('Thanks, Alex.');
		expect(text()).toContain('Your reference is HL-1000042');
	});

	it('keeps the tick out of the accessibility tree; the heading says it', () => {
		expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
		expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe('Application submitted');
	});

	it('starts a new application from the button', () => {
		fixture.nativeElement.querySelector('button').click();

		expect(startOver.run).toHaveBeenCalled();
	});
});
