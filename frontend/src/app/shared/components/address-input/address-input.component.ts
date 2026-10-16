import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { AddressLookup, AddressSuggestion } from '../../../core/address/address-lookup';

export const MIN_QUERY_LENGTH = 3;
export const DEBOUNCE_MS = 250;

/**
 * A text input that suggests addresses as the customer types (the ARIA combobox pattern). Typing
 * an address that isn't suggested still works: a suggestion is a convenience, never a gate. With
 * no lookup configured it is a plain text input. Content (the error message) is projected after
 * the input, so Bootstrap's `.is-invalid ~ .invalid-feedback` styling still applies.
 */
@Component({
	selector: 'app-address-input',
	templateUrl: './address-input.component.html',
	styleUrl: './address-input.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AddressInputComponent), multi: true }]
})
export class AddressInputComponent implements ControlValueAccessor {
	protected readonly lookup = inject(AddressLookup);

	readonly inputId = input.required<string>();
	readonly invalid = input(false);
	readonly maxLength = input(200);

	readonly value = signal('');
	readonly disabled = signal(false);
	readonly suggestions = signal<AddressSuggestion[]>([]);
	readonly activeIndex = signal(-1);
	readonly open = computed(() => this.suggestions().length > 0);
	readonly listId = computed(() => `${this.inputId()}-suggestions`);
	readonly activeOptionId = computed(() => (this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null));

	private readonly queries = new Subject<string>();
	private onChange: (value: string) => void = () => undefined;
	private onTouched: () => void = () => undefined;

	constructor() {
		this.queries
			.pipe(
				debounceTime(DEBOUNCE_MS),
				map((query) => query.trim()),
				distinctUntilChanged(),
				// switchMap: a newer query cancels the one in flight. Failures just mean no suggestions.
				switchMap((query) =>
					query.length < MIN_QUERY_LENGTH
						? of([])
						: this.lookup.suggest(query).pipe(catchError(() => of<AddressSuggestion[]>([])))
				),
				takeUntilDestroyed()
			)
			.subscribe((suggestions) => {
				this.suggestions.set(suggestions);
				this.activeIndex.set(-1);
			});
	}

	optionId(index: number): string {
		return `${this.inputId()}-option-${index}`;
	}

	onInput(value: string): void {
		this.value.set(value);
		this.onChange(value);
		if (this.lookup.enabled) {
			this.queries.next(value);
		}
	}

	onKeydown(event: KeyboardEvent): void {
		const count = this.suggestions().length;
		if (count === 0) {
			return;
		}
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				this.activeIndex.update((i) => (i + 1) % count);
				break;
			case 'ArrowUp':
				event.preventDefault();
				this.activeIndex.update((i) => (i <= 0 ? count - 1 : i - 1));
				break;
			case 'Enter':
				if (this.activeIndex() >= 0) {
					// Pick the suggestion instead of submitting the form.
					event.preventDefault();
					this.select(this.suggestions()[this.activeIndex()]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				this.close();
				break;
		}
	}

	onBlur(): void {
		this.close();
		this.onTouched();
	}

	select(suggestion: AddressSuggestion): void {
		this.value.set(suggestion.fullAddress);
		this.onChange(suggestion.fullAddress);
		// Cancels any query still waiting, so the list doesn't reopen after a pick.
		this.queries.next('');
		this.close();
	}

	writeValue(value: string | null): void {
		this.value.set(value ?? '');
	}

	registerOnChange(fn: (value: string) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(disabled: boolean): void {
		this.disabled.set(disabled);
	}

	private close(): void {
		this.suggestions.set([]);
		this.activeIndex.set(-1);
	}
}
