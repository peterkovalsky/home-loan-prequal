import { Observable, of } from 'rxjs';

export interface AddressSuggestion {
	id: string;
	fullAddress: string;
}

/**
 * Suggests Australian addresses as the customer types. The provider is swappable: Addressfinder
 * today; Geoscape, Google or AWS Location would be another implementation of this class.
 */
export abstract class AddressLookup {
	/** False when no provider is configured: the address is then a plain text field. */
	abstract readonly enabled: boolean;

	abstract suggest(query: string): Observable<AddressSuggestion[]>;
}

/** Used when `config.json` has no `addressFinderKey`. */
export class NoAddressLookup extends AddressLookup {
	readonly enabled = false;

	suggest(): Observable<AddressSuggestion[]> {
		return of([]);
	}
}
