import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout } from 'rxjs';
import { AddressLookup, AddressSuggestion } from './address-lookup';

export const ADDRESSFINDER_AUTOCOMPLETE_URL = 'https://api.addressfinder.io/api/au/address/autocomplete/';
export const MAX_SUGGESTIONS = 6;
const TIMEOUT_MS = 5000;

interface AutocompleteResponse {
	success: boolean;
	completions?: { id: string; full_address: string }[];
}

/**
 * Addressfinder's AU autocomplete (G-NAF data), called from the browser with the public key only.
 * Addressfinder checks the calling domain against the account's allowed list; the secret is for
 * server-to-server calls and never reaches the front end.
 */
export class AddressfinderLookup extends AddressLookup {
	readonly enabled = true;

	constructor(
		private readonly http: HttpClient,
		private readonly key: string
	) {
		super();
	}

	suggest(query: string): Observable<AddressSuggestion[]> {
		return this.http
			.get<AutocompleteResponse>(ADDRESSFINDER_AUTOCOMPLETE_URL, {
				params: {
					key: this.key,
					q: query,
					format: 'json',
					max: MAX_SUGGESTIONS,
					// A property can't be a PO box.
					post_box: 0
				}
			})
			.pipe(
				timeout(TIMEOUT_MS),
				map((response) =>
					response.success
						? (response.completions ?? []).map((c) => ({ id: c.id, fullAddress: c.full_address }))
						: []
				)
			);
	}
}
