import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, map, of, shareReplay } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';

export const APPLICATION_TOKEN_HEADER = 'X-Application-Token';
export const SESSION_STORAGE_KEY = 'homeloan.application';

export interface SessionData {
	id: number;
	token: string;
}

interface CreatedApplication {
	id: number;
	resumeToken: string;
}

/**
 * This browser's application: its id and the resume token that opens it. Kept in localStorage so
 * the customer can close the browser and carry on later. The front end and the API are on
 * different sites, so an API cookie would be a third-party cookie, which browsers block; once they
 * share a domain this becomes an HttpOnly cookie (see docs/plans/06-server-drafts.md).
 */
@Injectable({ providedIn: 'root' })
export class ApplicationSession {
	private readonly http = inject(HttpClient);
	private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl;
	private readonly state = signal<SessionData | null>(readStored());
	private creating: Observable<number> | null = null;

	readonly current = this.state.asReadonly();
	readonly applicationId = computed(() => this.state()?.id ?? null);

	/** The application's id, creating the application on first use (one request, however many callers). */
	ensure(): Observable<number> {
		const existing = this.state();
		if (existing) {
			return of(existing.id);
		}
		this.creating ??= this.http.post<CreatedApplication>(`${this.apiBaseUrl}/applications`, null).pipe(
			map(({ id, resumeToken }) => {
				const session = { id, token: resumeToken };
				store(session);
				this.state.set(session);
				return id;
			}),
			finalize(() => (this.creating = null)),
			shareReplay({ bufferSize: 1, refCount: false })
		);
		return this.creating;
	}

	/** Forgets the application on this device ("Not you?", or the server no longer knows it). */
	forget(): void {
		try {
			localStorage.removeItem(SESSION_STORAGE_KEY);
		} catch {
			// Storage blocked: there's nothing stored to remove.
		}
		this.state.set(null);
	}
}

function readStored(): SessionData | null {
	try {
		const parsed = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null') as Partial<SessionData> | null;
		return Number.isInteger(parsed?.id) && typeof parsed?.token === 'string'
			? { id: parsed.id!, token: parsed.token }
			: null;
	} catch {
		return null;
	}
}

function store(session: SessionData): void {
	try {
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
	} catch {
		// Storage blocked (private mode, say): the session lasts until the tab closes.
	}
}
