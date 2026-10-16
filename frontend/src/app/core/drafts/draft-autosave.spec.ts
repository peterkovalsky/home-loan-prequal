import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApplicationStore } from '../state/application.store';
import { AUTOSAVE_DEBOUNCE_MS, DraftAutosave } from './draft-autosave';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class HostComponent {
	value: unknown = { name: '' };
	readonly autosave = new DraftAutosave('about-you', () => this.value);
	readonly document = inject(DOCUMENT);
}

describe('DraftAutosave', () => {
	let fixture: ComponentFixture<HostComponent>;
	let host: HostComponent;
	let store: jasmine.SpyObj<ApplicationStore>;

	beforeEach(() => {
		store = jasmine.createSpyObj<ApplicationStore>('ApplicationStore', ['saveDraft', 'saveDraftOnExit']);
		store.saveDraft.and.returnValue(of(undefined));
		TestBed.configureTestingModule({
			imports: [HostComponent],
			providers: [{ provide: ApplicationStore, useValue: store }]
		});
		fixture = TestBed.createComponent(HostComponent);
		host = fixture.componentInstance;
		host.autosave.restored();
	});

	function edit(value: unknown): void {
		host.value = value;
		host.autosave.changed();
	}

	it('saves the latest input once the customer pauses for a second', fakeAsync(() => {
		edit({ name: 'A' });
		tick(500);
		edit({ name: 'Al' });
		tick(AUTOSAVE_DEBOUNCE_MS - 1);
		expect(store.saveDraft).not.toHaveBeenCalled();

		tick(1);

		expect(store.saveDraft).toHaveBeenCalledOnceWith('about-you', { name: 'Al' });
		expect(host.autosave.status()).toBe('saved');
	}));

	it('does not send what was just loaded, or the same input twice', fakeAsync(() => {
		edit({ name: '' });
		tick(AUTOSAVE_DEBOUNCE_MS);
		expect(store.saveDraft).not.toHaveBeenCalled();

		edit({ name: 'A' });
		tick(AUTOSAVE_DEBOUNCE_MS);
		edit({ name: 'A' });
		tick(AUTOSAVE_DEBOUNCE_MS);
		expect(store.saveDraft).toHaveBeenCalledTimes(1);
	}));

	it('never lets an older save overtake a newer one: one at a time, each with the latest input', fakeAsync(() => {
		const first = new Subject<void>();
		store.saveDraft.and.returnValues(first as Observable<void>, of(undefined));

		edit({ name: 'A' });
		tick(AUTOSAVE_DEBOUNCE_MS);
		edit({ name: 'Al' });
		tick(AUTOSAVE_DEBOUNCE_MS);
		expect(store.saveDraft).withContext('the second waits for the first').toHaveBeenCalledTimes(1);

		first.next();
		first.complete();

		expect(store.saveDraft.calls.allArgs()).toEqual([
			['about-you', { name: 'A' }],
			['about-you', { name: 'Al' }]
		]);
	}));

	it('retries with back-off, then says it could not save', fakeAsync(() => {
		store.saveDraft.and.returnValue(throwError(() => new Error('offline')));

		edit({ name: 'A' });
		tick(AUTOSAVE_DEBOUNCE_MS);
		expect(host.autosave.status()).toBe('saving');
		tick(1000 + 2000 + 4000);

		expect(host.autosave.status()).toBe('error');
		expect(host.autosave.hasUnsavedChanges).toBeTrue();
	}));

	it('makes the real save wait for a draft save already on its way, and sends nothing after it', fakeAsync(() => {
		const inFlight = new Subject<void>();
		store.saveDraft.and.returnValue(inFlight as Observable<void>);
		edit({ name: 'A' });
		tick(AUTOSAVE_DEBOUNCE_MS);
		edit({ name: 'Al' });

		let ready = false;
		host.autosave.beforeSave().subscribe(() => (ready = true));
		expect(ready).toBeFalse();
		inFlight.next();
		inFlight.complete();
		tick(AUTOSAVE_DEBOUNCE_MS);

		expect(ready).toBeTrue();
		expect(store.saveDraft).withContext('the pending edit is covered by the real save').toHaveBeenCalledTimes(1);
	}));

	it('saves straight away when the tab is hidden, and when the step is left', fakeAsync(() => {
		edit({ name: 'A' });
		spyOnProperty(host.document, 'visibilityState').and.returnValue('hidden');
		host.document.dispatchEvent(new Event('visibilitychange'));
		expect(store.saveDraftOnExit).toHaveBeenCalledOnceWith('about-you', { name: 'A' });

		edit({ name: 'Al' });
		fixture.destroy();
		expect(store.saveDraft).toHaveBeenCalledOnceWith('about-you', { name: 'Al' });
		tick(AUTOSAVE_DEBOUNCE_MS);
		expect(store.saveDraft).toHaveBeenCalledTimes(1);
	}));
});
