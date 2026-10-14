import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { LoanDetails } from '../models/loan-details.model';
import { ApplicationStore } from '../state/application.store';
import { loanDetailsSavedGuard } from './loan-details-saved.guard';

describe('loanDetailsSavedGuard', () => {
	let store: jasmine.SpyObj<ApplicationStore>;

	const run = () =>
		firstValueFrom(
			TestBed.runInInjectionContext(() =>
				loanDetailsSavedGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
			) as Observable<boolean | UrlTree>
		);

	beforeEach(() => {
		store = jasmine.createSpyObj<ApplicationStore>('ApplicationStore', ['ensureLoanDetails']);
		TestBed.configureTestingModule({
			providers: [provideRouter([]), { provide: ApplicationStore, useValue: store }]
		});
	});

	it('lets the customer through once loan details are saved', async () => {
		store.ensureLoanDetails.and.returnValue(of({ applicationId: 1 } as LoanDetails));

		expect(await run()).toBeTrue();
	});

	it('sends the customer to Loan details first', async () => {
		store.ensureLoanDetails.and.returnValue(of(null));

		const result = await run();

		expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/loan-details');
	});

	it('lets the step show its own error if loan details could not be loaded', async () => {
		store.ensureLoanDetails.and.returnValue(throwError(() => new Error('offline')));

		expect(await run()).toBeTrue();
	});
});
