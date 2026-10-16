import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { AddressLookup, AddressSuggestion, NoAddressLookup } from '../../../core/address/address-lookup';
import { AddressInputComponent, DEBOUNCE_MS } from './address-input.component';

class FakeLookup extends AddressLookup {
	readonly enabled = true;
	readonly queries: string[] = [];
	result: Observable<AddressSuggestion[]> = of([
		{ id: 'a', fullAddress: '1 George Street, SYDNEY NSW 2000' },
		{ id: 'b', fullAddress: '1 George Street, PARRAMATTA NSW 2150' }
	]);

	suggest(query: string): Observable<AddressSuggestion[]> {
		this.queries.push(query);
		return this.result;
	}
}

@Component({
	imports: [ReactiveFormsModule, AddressInputComponent],
	template: `<app-address-input inputId="address" [formControl]="control" [invalid]="control.invalid">
		<div class="invalid-feedback">Please enter the property address.</div>
	</app-address-input>`,
	changeDetection: ChangeDetectionStrategy.OnPush
})
class HostComponent {
	readonly control = new FormControl<string | null>(null);
}

describe('AddressInputComponent', () => {
	let fixture: ComponentFixture<HostComponent>;
	let lookup: FakeLookup;

	function setUp(provided: AddressLookup): void {
		TestBed.configureTestingModule({
			imports: [HostComponent],
			providers: [{ provide: AddressLookup, useValue: provided }]
		});
		fixture = TestBed.createComponent(HostComponent);
		fixture.detectChanges();
	}

	const input = (): HTMLInputElement => fixture.nativeElement.querySelector('input');
	const options = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
	const listbox = (): HTMLElement => fixture.nativeElement.querySelector('[role="listbox"]');

	function type(value: string): void {
		input().value = value;
		input().dispatchEvent(new Event('input'));
		tick(DEBOUNCE_MS);
		fixture.detectChanges();
	}

	function press(key: string): KeyboardEvent {
		const event = new KeyboardEvent('keydown', { key, cancelable: true });
		input().dispatchEvent(event);
		fixture.detectChanges();
		return event;
	}

	describe('with a lookup', () => {
		beforeEach(() => {
			lookup = new FakeLookup();
			setUp(lookup);
		});

		it('is an accessible combobox tied to its list', () => {
			expect(input().getAttribute('role')).toBe('combobox');
			expect(input().getAttribute('aria-controls')).toBe(listbox().id);
			expect(input().getAttribute('aria-expanded')).toBe('false');
			expect(listbox().hidden).toBeTrue();
		});

		it('waits for 3 characters and a pause in typing before asking', fakeAsync(() => {
			type('1 G');
			expect(lookup.queries).toEqual(['1 G']);

			lookup.queries.length = 0;
			type('1 ');
			expect(lookup.queries).toEqual([]);

			input().value = '1 Ge';
			input().dispatchEvent(new Event('input'));
			tick(DEBOUNCE_MS - 1);
			expect(lookup.queries).toEqual([]);
			tick(1);
			expect(lookup.queries).toEqual(['1 Ge']);
		}));

		it('shows the suggestions and fills the form with the one that is clicked', fakeAsync(() => {
			type('1 george');

			expect(options().map((o) => o.textContent?.trim())).toEqual([
				'1 George Street, SYDNEY NSW 2000',
				'1 George Street, PARRAMATTA NSW 2150'
			]);
			expect(input().getAttribute('aria-expanded')).toBe('true');

			options()[1].dispatchEvent(new MouseEvent('click'));
			fixture.detectChanges();

			expect(fixture.componentInstance.control.value).toBe('1 George Street, PARRAMATTA NSW 2150');
			expect(input().value).toBe('1 George Street, PARRAMATTA NSW 2150');
			expect(listbox().hidden).toBeTrue();
		}));

		it('moves through the suggestions with the arrow keys and picks with Enter', fakeAsync(() => {
			type('1 george');

			press('ArrowDown');
			press('ArrowDown');
			expect(input().getAttribute('aria-activedescendant')).toBe(options()[1].id);
			expect(options().map((o) => o.classList.contains('active'))).toEqual([false, true]);
			press('ArrowDown');
			expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);
			press('ArrowUp');
			const enter = press('Enter');

			expect(enter.defaultPrevented).withContext('Enter must not submit the form').toBeTrue();
			expect(fixture.componentInstance.control.value).toBe('1 George Street, PARRAMATTA NSW 2150');
		}));

		it('closes with Escape and keeps what was typed', fakeAsync(() => {
			type('99 Unlisted Road');

			press('Escape');

			expect(listbox().hidden).toBeTrue();
			expect(fixture.componentInstance.control.value).toBe('99 Unlisted Road');
		}));

		it('does not reopen after a pick while an earlier query was still waiting', fakeAsync(() => {
			type('1 george');
			input().value = '1 george s';
			input().dispatchEvent(new Event('input'));
			options()[0].dispatchEvent(new MouseEvent('click'));
			tick(DEBOUNCE_MS);
			fixture.detectChanges();

			expect(listbox().hidden).toBeTrue();
			expect(lookup.queries).toEqual(['1 george']);
		}));

		it('treats a failed lookup as no suggestions, and typing carries on', fakeAsync(() => {
			lookup.result = throwError(() => new Error('offline'));
			type('1 george');

			expect(options().length).toBe(0);
			expect(fixture.componentInstance.control.value).toBe('1 george');

			lookup.result = of([{ id: 'c', fullAddress: '1 George Street, SYDNEY NSW 2000' }]);
			type('1 george st');
			expect(options().length).withContext('one failure must not end the stream').toBe(1);
		}));

		it('keeps the error message next to the input, so Bootstrap shows it', () => {
			fixture.componentInstance.control.setErrors({ required: true });
			fixture.detectChanges();

			expect(input().classList).toContain('is-invalid');
			expect(input().parentElement!.querySelector(':scope > .invalid-feedback')).not.toBeNull();
		});
	});

	describe('without a lookup', () => {
		beforeEach(() => setUp(new NoAddressLookup()));

		it('is a plain text input that the browser may autofill', fakeAsync(() => {
			type('12 Smith Street');

			expect(input().getAttribute('role')).toBeNull();
			expect(input().getAttribute('autocomplete')).toBe('street-address');
			expect(listbox()).toBeNull();
			expect(fixture.componentInstance.control.value).toBe('12 Smith Street');
		}));
	});
});
