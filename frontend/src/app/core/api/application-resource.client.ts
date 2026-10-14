import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';

/**
 * HTTP access to the per-application sub-resources (`/applications/{id}/{resource}`).
 * Each is a single document that is loaded with GET and replaced with PUT.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationResourceClient {
	private readonly http = inject(HttpClient);
	private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl;

	/** Resolves to `null` when nothing has been saved yet. */
	get<T>(applicationId: number, resource: string): Observable<T | null> {
		return this.http.get<T | null>(this.url(applicationId, resource));
	}

	put<TRequest, TResponse>(applicationId: number, resource: string, body: TRequest): Observable<TResponse> {
		return this.http.put<TResponse>(this.url(applicationId, resource), body);
	}

	private url(applicationId: number, resource: string): string {
		return `${this.apiBaseUrl}/applications/${applicationId}/${resource}`;
	}
}
