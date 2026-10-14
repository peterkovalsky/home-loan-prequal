import { Subject, of, throwError } from 'rxjs';
import { CachedResource } from './cached-resource';

describe('CachedResource', () => {
	it('loads once and shares the result with every caller', () => {
		const response = new Subject<string | null>();
		const load = jasmine.createSpy('load').and.returnValue(response);
		const resource = new CachedResource<string>(load);
		const results: (string | null)[] = [];

		resource.ensure().subscribe((value) => results.push(value));
		resource.ensure().subscribe((value) => results.push(value));
		response.next('saved');
		response.complete();
		resource.ensure().subscribe((value) => results.push(value));

		expect(load).toHaveBeenCalledTimes(1);
		expect(results).toEqual(['saved', 'saved', 'saved']);
		expect(resource.value()).toBe('saved');
	});

	it('retries after a failed load', () => {
		const load = jasmine.createSpy('load').and.returnValues(
			throwError(() => new Error('offline')),
			of('saved')
		);
		const resource = new CachedResource<string>(load);

		resource.ensure().subscribe({ error: () => undefined });
		resource.ensure().subscribe();

		expect(load).toHaveBeenCalledTimes(2);
		expect(resource.value()).toBe('saved');
	});

	it('uses a value set after a save without reloading', () => {
		const load = jasmine.createSpy('load').and.returnValue(of('old'));
		const resource = new CachedResource<string>(load);

		resource.set('new');
		let result: string | null = null;
		resource.ensure().subscribe((value) => (result = value));

		expect(load).not.toHaveBeenCalled();
		expect(result as string | null).toBe('new');
	});
});
