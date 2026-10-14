import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApplicantsResponse, SaveApplicantsRequest } from '../models/applicant.model';
import { ApplicationResourceClient } from './application-resource.client';

const RESOURCE = 'applicants';

@Injectable({ providedIn: 'root' })
export class ApplicantsService {
	private readonly client = inject(ApplicationResourceClient);

	get(applicationId: number): Observable<ApplicantsResponse | null> {
		return this.client.get<ApplicantsResponse>(applicationId, RESOURCE);
	}

	save(applicationId: number, request: SaveApplicantsRequest): Observable<ApplicantsResponse> {
		return this.client.put<SaveApplicantsRequest, ApplicantsResponse>(applicationId, RESOURCE, request);
	}
}
