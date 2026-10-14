import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LoanDetails } from '../models/loan-details.model';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class LoanDetailsService {
	private readonly http = inject(HttpClient);

	get(applicationId: number): Observable<LoanDetails | null> {
		return this.http.get<LoanDetails | null>(this.url(applicationId));
	}

	save(details: LoanDetails): Observable<LoanDetails> {
		return this.http.put<LoanDetails>(this.url(details.applicationId), details);
	}

	private url(applicationId: number): string {
		return `${API_BASE_URL}/applications/${applicationId}/loan-details`;
	}
}
