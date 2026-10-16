import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { STEP_PATHS } from '../journey/journey-steps';
import { ApplicationStore } from '../state/application.store';
import { resumeGuard, submittedGuard } from './resume.guard';

describe('resume and submitted guards', () => {
	let store: jasmine.SpyObj<ApplicationStore>;

	const run = (guard: typeof resumeGuard) =>
		firstValueFrom(
			TestBed.runInInjectionContext(() =>
				guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
			) as Observable<boolean | UrlTree>
		);
	const url = (result: boolean | UrlTree) =>
		result === true ? true : TestBed.inject(Router).serializeUrl(result as UrlTree);
	const progress = (...completed: string[]) => store.ensureProgress.and.returnValue(of(new Set(completed)));

	beforeEach(() => {
		store = jasmine.createSpyObj<ApplicationStore>('ApplicationStore', ['ensureProgress']);
		TestBed.configureTestingModule({
			providers: [provideRouter([]), { provide: ApplicationStore, useValue: store }]
		});
	});

	it('opens a submitted application on the completion screen', async () => {
		progress(STEP_PATHS.loanDetails, STEP_PATHS.aboutYou);
		expect(url(await run(resumeGuard))).toBe('/complete');
		expect(url(await run(submittedGuard))).toBeTrue();
	});

	it('takes a customer with saved loan details to About you, and not to the completion screen', async () => {
		progress(STEP_PATHS.loanDetails);
		expect(url(await run(resumeGuard))).toBe('/about-you');
		expect(url(await run(submittedGuard))).toBe('/about-you');
	});

	it('starts everyone else on Loan details', async () => {
		progress();
		expect(url(await run(resumeGuard))).toBe('/loan-details');
		expect(url(await run(submittedGuard))).toBe('/loan-details');
	});

	it('falls back to Loan details if loading fails', async () => {
		store.ensureProgress.and.returnValue(throwError(() => new Error('offline')));
		expect(url(await run(resumeGuard))).toBe('/loan-details');
	});
});
