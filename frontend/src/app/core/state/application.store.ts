import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApplicantCountRange, applicantCountRange } from '../../shared/validation/applicant-count';
import { CURRENT_APPLICATION_ID } from '../api/api.config';
import { ApplicantsService } from '../api/applicants.service';
import { LoanDetailsService } from '../api/loan-details.service';
import { APP_CONFIG } from '../config/app-config';
import { ApplicantsDraft, ApplicantsResponse, SaveApplicantsRequest } from '../models/applicant.model';
import { LoanDetails } from '../models/loan-details.model';
import { CachedResource } from './cached-resource';

/** The single place journey data is loaded, cached and saved, so steps, guards and the nav agree. */
@Injectable({ providedIn: 'root' })
export class ApplicationStore {
	private readonly loanDetailsService = inject(LoanDetailsService);
	private readonly applicantsService = inject(ApplicantsService);
	private readonly config = inject(APP_CONFIG);

	readonly applicationId = CURRENT_APPLICATION_ID;

	private readonly loanDetailsResource = new CachedResource(() => this.loanDetailsService.get(this.applicationId));
	private readonly applicantsResource = new CachedResource(() => this.applicantsService.get(this.applicationId));
	private readonly draft = signal<ApplicantsDraft | null>(null);

	readonly loanDetails = this.loanDetailsResource.value;
	readonly applicants = this.applicantsResource.value;
	readonly applicantsDraft = this.draft.asReadonly();

	/** How many applicant sections About you needs, based on the loan details answer. */
	readonly requiredApplicantCount = computed<ApplicantCountRange | null>(() => {
		const details = this.loanDetails();
		return details ? applicantCountRange(details.numberOfApplicants, this.config.maxApplicants) : null;
	});

	ensureLoanDetails(): Observable<LoanDetails | null> {
		return this.loanDetailsResource.ensure();
	}

	saveLoanDetails(details: LoanDetails): Observable<LoanDetails> {
		return this.loanDetailsService.save(details).pipe(tap((saved) => this.loanDetailsResource.set(saved)));
	}

	ensureApplicants(): Observable<ApplicantsResponse | null> {
		return this.applicantsResource.ensure();
	}

	saveApplicants(request: SaveApplicantsRequest): Observable<ApplicantsResponse> {
		return this.applicantsService.save(this.applicationId, request).pipe(
			tap((saved) => {
				this.applicantsResource.set(saved);
				this.draft.set(null);
			})
		);
	}

	saveApplicantsDraft(draft: ApplicantsDraft): void {
		this.draft.set(draft);
	}
}
