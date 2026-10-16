import { HttpClient } from '@angular/common/http';
import { Provider } from '@angular/core';
import { AppConfig } from '../config/app-config';
import { AddressLookup, NoAddressLookup } from './address-lookup';
import { AddressfinderLookup } from './addressfinder.lookup';

/** Addressfinder when `config.json` has a key; otherwise suggestions are off. */
export function provideAddressLookup(config: AppConfig): Provider {
	return {
		provide: AddressLookup,
		useFactory: (http: HttpClient) =>
			config.addressFinderKey ? new AddressfinderLookup(http, config.addressFinderKey) : new NoAddressLookup(),
		deps: [HttpClient]
	};
}
