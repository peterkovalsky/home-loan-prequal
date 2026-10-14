import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, dematerialize, materialize, of, throwError } from 'rxjs';
import { API_BASE_URL } from '../core/api/api.config';
import { MOCK_ROUTES } from './mock-routes';

export const MOCK_LATENCY_MS = 400;

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
	const path = new URL(req.url, 'http://localhost').pathname;
	if (!path.startsWith(API_BASE_URL)) {
		return next(req);
	}

	for (const route of MOCK_ROUTES) {
		const match = route.method === req.method ? route.path.exec(path) : null;
		if (!match) {
			continue;
		}

		const { status, body } = route.handle(req, match.slice(1));
		const response$ =
			status < 400
				? of(new HttpResponse({ status, body, url: req.url }))
				: throwError(() => new HttpErrorResponse({ status, error: body, url: req.url }));

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
