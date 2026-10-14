import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { LoanDetails } from '../models/loan-details.model';

@Injectable({ providedIn: 'root' })
export class LoanDetailsService {
	private readonly http = inject(HttpClient);
	private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl;

	get(applicationId: number): Observable<LoanDetails | null> {
		return this.http.get<LoanDetails | null>(this.url(applicationId));
	}

	save(details: LoanDetails): Observable<LoanDetails> {
		return this.http.put<LoanDetails>(this.url(details.applicationId), details);
	}

	private url(applicationId: number): string {
		return `${this.apiBaseUrl}/applications/${applicationId}/loan-details`;
	}
}
