import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { APP_CONFIG, AppConfig } from './core/config/app-config';
import { mockApiInterceptor } from './mock-api/mock-api.interceptor';

export function createAppConfig(config: AppConfig): ApplicationConfig {
	return {
		providers: [
			{ provide: APP_CONFIG, useValue: config },
			provideZoneChangeDetection({ eventCoalescing: true }),
			provideRouter(routes, withComponentInputBinding()),
			provideHttpClient(withInterceptors(config.useMockApi ? [mockApiInterceptor] : []))
		]
	};
}
