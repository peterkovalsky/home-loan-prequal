import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApplicantCountRange, applicantCountRange } from '../../shared/validation/applicant-count';
import { ApplicantsService } from '../api/applicants.service';
import { DraftStep, Drafts, DraftsService } from '../api/drafts.service';
import { LoanDetailsService } from '../api/loan-details.service';
import { APP_CONFIG } from '../config/app-config';
import { STEP_PATHS } from '../journey/journey-steps';
import { ApplicantsDraft, ApplicantsResponse, SaveApplicantsRequest } from '../models/applicant.model';
import { LoanDetails } from '../models/loan-details.model';
import { ApplicationSession } from '../session/application-session';
import { CachedResource } from './cached-resource';

/** The single place journey data is loaded, cached and saved, so steps, guards and the nav agree. */
@Injectable({ providedIn: 'root' })
export class ApplicationStore {
	private readonly loanDetailsService = inject(LoanDetailsService);
	private readonly applicantsService = inject(ApplicantsService);
	private readonly draftsService = inject(DraftsService);
	private readonly session = inject(ApplicationSession);
	private readonly config = inject(APP_CONFIG);

	/** This browser's application, or null before the customer has started (nothing to load yet). */
	readonly applicationId = this.session.applicationId;

	private readonly loanDetailsResource = new CachedResource(() =>
		this.whenStarted((id) => this.loanDetailsService.get(id))
	);
	private readonly applicantsResource = new CachedResource(() =>
		this.whenStarted((id) => this.applicantsService.get(id))
	);
	private readonly draftsResource = new CachedResource<Drafts>(() =>
		this.whenStarted((id) =>
			// null: the server no longer knows this application (expired or deleted), so start afresh.
			this.draftsService.getAll(id).pipe(tap((drafts) => drafts ?? this.session.forget()))
		)
	);
	private readonly localDrafts = signal<Drafts>({});

	readonly loanDetails = this.loanDetailsResource.value;
	readonly applicants = this.applicantsResource.value;

	/** Unsaved About you input: typed in this tab, else as the server kept it. */
	readonly applicantsDraft = computed(() => this.draft('about-you') as ApplicantsDraft | null);

	/** How many applicant sections About you needs, based on the loan details answer. */
	readonly requiredApplicantCount = computed<ApplicantCountRange | null>(() => {
		const details = this.loanDetails();
		return details ? applicantCountRange(details.numberOfApplicants, this.config.maxApplicants) : null;
	});

	/**
	 * Steps whose saved data is complete for the current answers. About you only counts if the saved
	 * applicants still fit the loan details' applicant count and were agreed under the current terms.
	 */
	readonly completedSteps = computed<ReadonlySet<string>>(() => {
		const completed = new Set<string>();
		if (this.loanDetails()) {
			completed.add(STEP_PATHS.loanDetails);
		}
		const saved = this.applicants();
		const range = this.requiredApplicantCount();
		if (
			saved &&
			range &&
			saved.applicants.length >= range.min &&
			saved.applicants.length <= range.max &&
			saved.consent.termsVersion === this.config.termsVersion
		) {
			completed.add(STEP_PATHS.aboutYou);
		}
		return completed;
	});

	/** Loads what's saved and reports which steps are complete (both: the application is submitted). */
	ensureProgress(): Observable<ReadonlySet<string>> {
		return forkJoin([this.ensureLoanDetails(), this.ensureApplicants()]).pipe(map(() => this.completedSteps()));
	}

	ensureLoanDetails(): Observable<LoanDetails | null> {
		return this.loanDetailsResource.ensure();
	}

	saveLoanDetails(details: Omit<LoanDetails, 'applicationId'>): Observable<LoanDetails> {
		return this.session.ensure().pipe(
			switchMap((applicationId) => this.loanDetailsService.save({ ...details, applicationId })),
			tap((saved) => {
				this.loanDetailsResource.set(saved);
				// The server deleted the draft in the same transaction.
				this.clearDraft('loan-details');
			})
		);
	}

	ensureApplicants(): Observable<ApplicantsResponse | null> {
		return this.applicantsResource.ensure();
	}

	saveApplicants(request: SaveApplicantsRequest): Observable<ApplicantsResponse> {
		return this.session.ensure().pipe(
			switchMap((applicationId) => this.applicantsService.save(applicationId, request)),
			tap((saved) => {
				this.applicantsResource.set(saved);
				this.clearDraft('about-you');
			})
		);
	}

	/** Loads every step's draft (once). */
	ensureDrafts(): Observable<Drafts> {
		return this.draftsResource.ensure().pipe(map((drafts) => drafts ?? {}));
	}

	/** The step's unsaved input, if any: typed in this tab, else as the server kept it. */
	draft(step: DraftStep): unknown {
		return this.localDrafts()[step]?.data ?? this.draftsResource.value()?.[step]?.data ?? null;
	}

	/**
	 * Keeps the step's input as typed: here at once (so Back and Continue see it), then on the
	 * server, creating the application with the first save.
	 */
	saveDraft(step: DraftStep, data: unknown): Observable<void> {
		this.rememberDraft(step, data);
		return this.session
			.ensure()
			.pipe(switchMap((applicationId) => this.draftsService.save(applicationId, step, data)));
	}

	/** The last save as the page is hidden or closed; only if the application already exists. */
	saveDraftOnExit(step: DraftStep, data: unknown): void {
		this.rememberDraft(step, data);
		const session = this.session.current();
		if (session) {
			this.draftsService.saveOnExit(session, step, data);
		}
	}

	/** "Not you? Start a new application": forget this device's application and all that was loaded. */
	startOver(): void {
		this.session.forget();
		this.loanDetailsResource.reset();
		this.applicantsResource.reset();
		this.draftsResource.reset();
		this.localDrafts.set({});
	}

	private rememberDraft(step: DraftStep, data: unknown): void {
		this.localDrafts.update((drafts) => ({ ...drafts, [step]: { data, updatedAt: new Date().toISOString() } }));
	}

	private clearDraft(step: DraftStep): void {
		this.localDrafts.update((drafts) => withoutStep(drafts, step));
		const server = this.draftsResource.value();
		if (server?.[step]) {
			this.draftsResource.set(withoutStep(server, step));
		}
	}

	private whenStarted<T>(load: (applicationId: number) => Observable<T | null>): Observable<T | null> {
		const id = this.session.applicationId();
		return id === null ? of(null) : load(id);
	}
}

function withoutStep(drafts: Drafts, step: DraftStep): Drafts {
	const copy = { ...drafts };
	delete copy[step];
	return copy;
}
