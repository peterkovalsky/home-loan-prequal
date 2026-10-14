import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestAppConfig } from '../../../testing/test-app-config';
import { ApplicationResourceClient } from './application-resource.client';

describe('ApplicationResourceClient', () => {
	const url = 'https://api.example.com/api/applications/7/applicants';
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
		client.get(7, 'applicants').subscribe((value) => (result = value));

		http.expectOne({ method: 'GET', url }).flush({ a: 1 });

		expect(result).toEqual({ a: 1 });
	});

	it('treats 404 as "nothing saved yet" and other errors as errors', () => {
		let result: unknown = 'unset';
		let failure: unknown;
		client.get(7, 'applicants').subscribe((value) => (result = value));
		http.expectOne(url).flush({ title: 'Not found' }, { status: 404, statusText: 'Not Found' });

		client.get(7, 'applicants').subscribe({ error: (e: unknown) => (failure = e) });
		http.expectOne(url).flush(null, { status: 500, statusText: 'Server Error' });

		expect(result).toBeNull();
		expect(failure).toBeDefined();
	});

	it('sends no If-Match before anything has been loaded', () => {
		client.put(7, 'applicants', { a: 1 }).subscribe();

		const request = http.expectOne({ method: 'PUT', url });
		expect(request.request.body).toEqual({ a: 1 });
		expect(request.request.headers.has('If-Match')).toBeFalse();
		request.flush({});
	});

	it('sends back the ETag from the last read or save as If-Match', () => {
		client.get(7, 'applicants').subscribe();
		http.expectOne(url).flush({ a: 1 }, { headers: { ETag: '"1"' } });

		client.put(7, 'applicants', { a: 2 }).subscribe();
		const first = http.expectOne({ method: 'PUT', url });
		expect(first.request.headers.get('If-Match')).toBe('"1"');
		first.flush({ a: 2 }, { headers: { ETag: '"2"' } });

		client.put(7, 'applicants', { a: 3 }).subscribe();
		const second = http.expectOne({ method: 'PUT', url });
		expect(second.request.headers.get('If-Match')).toBe('"2"');
		second.flush({ a: 3 });
	});
});
