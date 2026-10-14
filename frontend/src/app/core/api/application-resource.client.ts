import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';

/**
 * HTTP access to the per-application sub-resources (`/applications/{id}/{resource}`).
 * Each is a single document that is loaded with GET and replaced with PUT.
 *
 * Optimistic concurrency: the ETag from the last GET or PUT is sent back as `If-Match`,
 * so a save based on stale data is rejected (412) instead of overwriting someone else's.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationResourceClient {
	private readonly http = inject(HttpClient);
	private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl;
	private readonly etags = new Map<string, string>();

	/** Resolves to `null` when nothing has been saved yet (the API answers 404). */
	get<T>(applicationId: number, resource: string): Observable<T | null> {
		const url = this.url(applicationId, resource);
		return this.http.get<T>(url, { observe: 'response' }).pipe(
			map((response) => this.read(url, response)),
			catchError((error: unknown) => {
				if (error instanceof HttpErrorResponse && error.status === 404) {
					this.etags.delete(url);
					return of(null);
				}
				return throwError(() => error);
			})
		);
	}

	put<TRequest, TResponse>(applicationId: number, resource: string, body: TRequest): Observable<TResponse> {
		const url = this.url(applicationId, resource);
		const etag = this.etags.get(url);
		const headers = etag ? new HttpHeaders({ 'If-Match': etag }) : undefined;
		return this.http
			.put<TResponse>(url, body, { headers, observe: 'response' })
			.pipe(map((response) => this.read(url, response) as TResponse));
	}

	private read<T>(url: string, response: HttpResponse<T>): T | null {
		const etag = response.headers.get('ETag');
		if (etag) {
			this.etags.set(url, etag);
		}
		return response.body;
	}

	private url(applicationId: number, resource: string): string {
		return `${this.apiBaseUrl}/applications/${applicationId}/${resource}`;
	}
}
