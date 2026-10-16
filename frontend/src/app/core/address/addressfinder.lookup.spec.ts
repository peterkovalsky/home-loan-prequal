import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AddressSuggestion, NoAddressLookup } from './address-lookup';
import { ADDRESSFINDER_AUTOCOMPLETE_URL, AddressfinderLookup, MAX_SUGGESTIONS } from './addressfinder.lookup';

describe('AddressfinderLookup', () => {
	let lookup: AddressfinderLookup;
	let backend: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		lookup = new AddressfinderLookup(TestBed.inject(HttpClient), 'PUBLIC-KEY');
		backend = TestBed.inject(HttpTestingController);
	});

	afterEach(() => backend.verify());

	it('asks for AU street addresses with the public key, and maps the completions', () => {
		let result: AddressSuggestion[] | undefined;

		lookup.suggest('1 george st').subscribe((s) => (result = s));

		const request = backend.expectOne((r) => r.url === ADDRESSFINDER_AUTOCOMPLETE_URL);
		expect(request.request.params.get('key')).toBe('PUBLIC-KEY');
		expect(request.request.params.get('q')).toBe('1 george st');
		expect(request.request.params.get('max')).toBe(String(MAX_SUGGESTIONS));
		expect(request.request.params.get('post_box')).toBe('0');
		expect(request.request.params.has('secret')).toBeFalse();
		request.flush({
			success: true,
			completions: [{ id: 'a1', full_address: '1 George Street, SYDNEY NSW 2000', canonical_address_id: 'x' }]
		});

		expect(result).toEqual([{ id: 'a1', fullAddress: '1 George Street, SYDNEY NSW 2000' }]);
	});

	it('returns no suggestions when Addressfinder reports a failure', () => {
		let result: AddressSuggestion[] | undefined;

		lookup.suggest('1 george').subscribe((s) => (result = s));
		backend.expectOne((r) => r.url === ADDRESSFINDER_AUTOCOMPLETE_URL).flush({ success: false, completions: [] });

		expect(result).toEqual([]);
	});

	it('gives up after 5 seconds rather than leaving the list waiting', fakeAsync(() => {
		let failed = false;

		lookup.suggest('1 george').subscribe({ error: () => (failed = true) });
		const request = backend.expectOne((r) => r.url === ADDRESSFINDER_AUTOCOMPLETE_URL);
		tick(5000);

		expect(failed).toBeTrue();
		expect(request.cancelled).toBeTrue();
	}));
});

describe('NoAddressLookup', () => {
	it('is disabled and suggests nothing', () => {
		const lookup = new NoAddressLookup();
		let result: AddressSuggestion[] | undefined;

		lookup.suggest().subscribe((s) => (result = s));

		expect(lookup.enabled).toBeFalse();
		expect(result).toEqual([]);
	});
});
