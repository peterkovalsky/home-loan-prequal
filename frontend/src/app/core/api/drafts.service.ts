import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { APPLICATION_TOKEN_HEADER, SessionData } from '../session/application-session';

export type DraftStep = 'loan-details' | 'about-you';

export interface StoredDraft {
	data: unknown;
	updatedAt: string;
}

export type Drafts = Partial<Record<DraftStep, StoredDraft>>;

/** What the customer has typed so far, valid or not, kept on the server per step. */
@Injectable({ providedIn: 'root' })
export class DraftsService {
	private readonly http = inject(HttpClient);
	private readonly config = inject(APP_CONFIG);

	/** Every step's draft, or `null` when the server doesn't know this application (or its token) any more. */
	getAll(applicationId: number): Observable<Drafts | null> {
		return this.http
			.get<Drafts>(this.url(applicationId))
			.pipe(
				catchError((error: unknown) =>
					error instanceof HttpErrorResponse && error.status === 404 ? of(null) : throwError(() => error)
				)
			);
	}

	save(applicationId: number, step: DraftStep, data: unknown): Observable<void> {
		return this.http.put(`${this.url(applicationId)}/${step}`, data).pipe(map(() => undefined));
	}

	/**
	 * A last save while the page is being hidden or closed. `fetch` with `keepalive` outlives the
	 * page; an HttpClient request may be cancelled with it. The in-browser mock has no network to
	 * outlive, so there it's a normal save (and may be lost if the tab closes within its delay).
	 */
	saveOnExit(session: SessionData, step: DraftStep, data: unknown): void {
		if (this.config.useMockApi) {
			this.save(session.id, step, data).subscribe({ error: () => undefined });
			return;
		}
		void fetch(`${this.url(session.id)}/${step}`, {
			method: 'PUT',
			keepalive: true,
			headers: { 'Content-Type': 'application/json', [APPLICATION_TOKEN_HEADER]: session.token },
			body: JSON.stringify(data)
		}).catch(() => undefined);
	}

	private url(applicationId: number): string {
		return `${this.config.apiBaseUrl}/applications/${applicationId}/drafts`;
	}
}
