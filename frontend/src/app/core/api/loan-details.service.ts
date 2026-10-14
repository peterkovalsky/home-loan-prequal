import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LoanDetails } from '../models/loan-details.model';
import { ApplicationResourceClient } from './application-resource.client';

const RESOURCE = 'loan-details';

@Injectable({ providedIn: 'root' })
export class LoanDetailsService {
	private readonly client = inject(ApplicationResourceClient);

	get(applicationId: number): Observable<LoanDetails | null> {
		return this.client.get<LoanDetails>(applicationId, RESOURCE);
	}

	save(details: LoanDetails): Observable<LoanDetails> {
		return this.client.put<LoanDetails, LoanDetails>(details.applicationId, RESOURCE, details);
	}
}
