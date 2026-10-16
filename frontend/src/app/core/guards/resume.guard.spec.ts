import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { LoanDetails } from '../models/loan-details.model';
import { ApplicationStore } from '../state/application.store';
import { resumeGuard } from './resume.guard';

describe('resumeGuard', () => {
	let store: jasmine.SpyObj<ApplicationStore>;

	const target = async () =>
		TestBed.inject(Router).serializeUrl(
			(await firstValueFrom(
				TestBed.runInInjectionContext(() =>
					resumeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
				) as Observable<UrlTree>
			)) as UrlTree
		);

	beforeEach(() => {
		store = jasmine.createSpyObj<ApplicationStore>('ApplicationStore', ['ensureLoanDetails']);
		TestBed.configureTestingModule({
			providers: [provideRouter([]), { provide: ApplicationStore, useValue: store }]
		});
	});

	it('takes a returning customer with saved loan details straight to About you', async () => {
		store.ensureLoanDetails.and.returnValue(of({ applicationId: 1 } as LoanDetails));
		expect(await target()).toBe('/about-you');
	});

	it('starts everyone else on Loan details', async () => {
		store.ensureLoanDetails.and.returnValue(of(null));
		expect(await target()).toBe('/loan-details');
	});

	it('falls back to Loan details if loading fails', async () => {
		store.ensureLoanDetails.and.returnValue(throwError(() => new Error('offline')));
		expect(await target()).toBe('/loan-details');
	});
});
