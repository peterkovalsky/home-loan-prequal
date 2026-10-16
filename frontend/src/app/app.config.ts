import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideAddressLookup } from './core/address/address-lookup.provider';
import { APP_CONFIG, AppConfig } from './core/config/app-config';
import { applicationTokenInterceptor } from './core/session/application-token.interceptor';
import { mockApiInterceptor } from './mock-api/mock-api.interceptor';

export function createAppConfig(config: AppConfig): ApplicationConfig {
	return {
		providers: [
			{ provide: APP_CONFIG, useValue: config },
			provideZoneChangeDetection({ eventCoalescing: true }),
			provideRouter(routes, withComponentInputBinding()),
			// The token goes on first, so the mock sees it too and checks it like the API.
			provideHttpClient(
				withInterceptors([applicationTokenInterceptor, ...(config.useMockApi ? [mockApiInterceptor] : [])])
			),
			provideAddressLookup(config)
		]
	};
}
