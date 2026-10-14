import { HttpErrorResponse, HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { delay, dematerialize, materialize, of, throwError } from 'rxjs';
import { APP_CONFIG } from '../core/config/app-config';
import { MOCK_ROUTES } from './mock-routes';

export const MOCK_LATENCY_MS = 400;

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
	const apiBasePath = new URL(inject(APP_CONFIG).apiBaseUrl, 'http://localhost').pathname;
	const path = new URL(req.url, 'http://localhost').pathname;
	if (!path.startsWith(apiBasePath)) {
		return next(req);
	}

	for (const route of MOCK_ROUTES) {
		const match = route.method === req.method ? route.path.exec(path) : null;
		if (!match) {
			continue;
		}

		const { status, body, headers: rawHeaders } = route.handle(req, match.slice(1));
		const headers = new HttpHeaders(rawHeaders);
		const response$ =
			status < 400
				? of(new HttpResponse({ status, body, headers, url: req.url }))
				: throwError(() => new HttpErrorResponse({ status, error: body, headers, url: req.url }));

		return response$.pipe(materialize(), delay(MOCK_LATENCY_MS), dematerialize());
	}

	return throwError(
		() =>
			new HttpErrorResponse({
				status: 404,
				error: { message: `No mock route for ${req.method} ${path}` },
				url: req.url
			})
	);
};
