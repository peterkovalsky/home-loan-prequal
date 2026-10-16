import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { isApiUrl } from '../api/api-url';
import { APP_CONFIG } from '../config/app-config';
import { APPLICATION_TOKEN_HEADER, ApplicationSession } from './application-session';

/** Sends the resume token with every request to our API, and never to anyone else. */
export const applicationTokenInterceptor: HttpInterceptorFn = (req, next) => {
	const token = inject(ApplicationSession).current()?.token;
	return token && isApiUrl(req.url, inject(APP_CONFIG).apiBaseUrl)
		? next(req.clone({ setHeaders: { [APPLICATION_TOKEN_HEADER]: token } }))
		: next(req);
};
