import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { JOURNEY, JourneyStep } from './journey-steps';
import { JourneyService } from './journey.service';

describe('JourneyService', () => {
	const steps: JourneyStep[] = [
		{ path: '/one', title: 'One' },
		{ path: '/two', title: 'Two' },
		{ path: '/three', title: 'Three' }
	];
	let service: JourneyService;
	let router: jasmine.SpyObj<Router>;

	beforeEach(() => {
		router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
		router.navigateByUrl.and.resolveTo(true);
		TestBed.configureTestingModule({
			providers: [
				{ provide: Router, useValue: router },
				{ provide: JOURNEY, useValue: steps }
			]
		});
		service = TestBed.inject(JourneyService);
	});

	it('finds the neighbouring steps', () => {
		expect(service.next('/one')?.path).toBe('/two');
		expect(service.previous('/three')?.path).toBe('/two');
	});

	it('returns null past either end or for an unknown path', () => {
		expect(service.previous('/one')).toBeNull();
		expect(service.next('/three')).toBeNull();
		expect(service.next('/unknown')).toBeNull();
	});

	it('navigates forwards and backwards', () => {
		expect(service.goNext('/one')).toBeTrue();
		expect(router.navigateByUrl).toHaveBeenCalledWith('/two');

		expect(service.goBack('/two')).toBeTrue();
		expect(router.navigateByUrl).toHaveBeenCalledWith('/one');
	});

	it('does not navigate past the last step', () => {
		expect(service.goNext('/three')).toBeFalse();
		expect(router.navigateByUrl).not.toHaveBeenCalled();
	});
});
