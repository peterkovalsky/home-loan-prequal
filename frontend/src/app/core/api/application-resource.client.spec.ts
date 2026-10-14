import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestAppConfig } from '../../../testing/test-app-config';
import { ApplicationResourceClient } from './application-resource.client';

describe('ApplicationResourceClient', () => {
	let client: ApplicationResourceClient;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideTestAppConfig({ apiBaseUrl: 'https://api.example.com/api' }),
				provideHttpClient(),
				provideHttpClientTesting()
			]
		});
		client = TestBed.inject(ApplicationResourceClient);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('loads a resource from the configured base URL', () => {
		let result: unknown;
		client.get(7, 'loan-details').subscribe((value) => (result = value));

		http.expectOne({ method: 'GET', url: 'https://api.example.com/api/applications/7/loan-details' }).flush(null);

		expect(result).toBeNull();
	});

	it('replaces a resource with PUT', () => {
		client.put(7, 'applicants', { a: 1 }).subscribe();

		const request = http.expectOne({ method: 'PUT', url: 'https://api.example.com/api/applications/7/applicants' });
		expect(request.request.body).toEqual({ a: 1 });
		request.flush({});
	});
});
