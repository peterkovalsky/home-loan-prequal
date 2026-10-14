import { Signal, signal } from '@angular/core';
import { Observable, catchError, of, shareReplay, tap, throwError } from 'rxjs';

/**
 * Loads a resource at most once and shares it. Concurrent callers (a guard and a
 * component, say) get the same in-flight request. A failed load is not cached, so
 * the next caller retries.
 */
export class CachedResource<T> {
	private readonly current = signal<T | null>(null);
	private request: Observable<T | null> | null = null;

	readonly value: Signal<T | null> = this.current.asReadonly();

	constructor(private readonly load: () => Observable<T | null>) {}

	ensure(): Observable<T | null> {
		this.request ??= this.load().pipe(
			tap((value) => this.current.set(value)),
			catchError((error: unknown) => {
				this.request = null;
				return throwError(() => error);
			}),
			shareReplay({ bufferSize: 1, refCount: false })
		);
		return this.request;
	}

	set(value: T): void {
		this.current.set(value);
		this.request = of(value);
	}
}
