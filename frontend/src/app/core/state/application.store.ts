import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CURRENT_APPLICATION_ID } from '../api/api.config';
import { LoanDetailsService } from '../api/loan-details.service';
import { LoanDetails } from '../models/loan-details.model';
import { CachedResource } from './cached-resource';

/** The single place journey data is loaded, cached and saved, so steps, guards and the nav agree. */
@Injectable({ providedIn: 'root' })
export class ApplicationStore {
	private readonly loanDetailsService = inject(LoanDetailsService);

	readonly applicationId = CURRENT_APPLICATION_ID;

	private readonly loanDetailsResource = new CachedResource(() => this.loanDetailsService.get(this.applicationId));

	readonly loanDetails = this.loanDetailsResource.value;

	ensureLoanDetails(): Observable<LoanDetails | null> {
		return this.loanDetailsResource.ensure();
	}

	saveLoanDetails(details: LoanDetails): Observable<LoanDetails> {
		return this.loanDetailsService.save(details).pipe(tap((saved) => this.loanDetailsResource.set(saved)));
	}
}
