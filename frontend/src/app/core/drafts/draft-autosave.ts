import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
	EMPTY,
	Observable,
	Subject,
	catchError,
	concatMap,
	debounceTime,
	defer,
	filter,
	finalize,
	fromEvent,
	merge,
	of,
	retry,
	take,
	tap,
	timer
} from 'rxjs';
import { DraftStep } from '../api/drafts.service';
import { ApplicationStore } from '../state/application.store';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const AUTOSAVE_DEBOUNCE_MS = 1000;
const RETRIES = 3;

/**
 * Saves a step's input to the server as the customer types: 1 s after they pause, and at once
 * when the tab is hidden or closed. Saves run one at a time and each sends the latest input, so an
 * older save can never land after a newer one. Unchanged input isn't sent again.
 *
 * Create it in a component's injection context (a field initialiser), then call `changed()` on
 * every edit. `restored()` records what was loaded, so loading doesn't count as an edit.
 */
export class DraftAutosave {
	private readonly store = inject(ApplicationStore);
	private readonly changes = new Subject<void>();
	private readonly idle = new Subject<void>();
	private inFlight = 0;
	private lastSent: string | null = null;
	private edits = 0;
	private sentEdits = 0;

	readonly status = signal<AutosaveStatus>('idle');

	constructor(
		private readonly step: DraftStep,
		private readonly snapshot: () => unknown
	) {
		const destroyRef = inject(DestroyRef);
		const document = inject(DOCUMENT);

		this.changes
			.pipe(
				debounceTime(AUTOSAVE_DEBOUNCE_MS),
				concatMap(() => this.saveLatest()),
				takeUntilDestroyed(destroyRef)
			)
			.subscribe();

		// Switching tab, minimising, or closing: all hide the page first; pagehide covers the rest.
		const hidden = fromEvent(document, 'visibilitychange').pipe(
			filter(() => document.visibilityState === 'hidden')
		);
		const leaving = document.defaultView ? fromEvent(document.defaultView, 'pagehide') : EMPTY;
		merge(hidden, leaving)
			.pipe(takeUntilDestroyed(destroyRef))
			.subscribe(() => this.saveOnExit());
		// Leaving the step inside the app (Back, Continue's navigation): keep what was typed.
		destroyRef.onDestroy(() => this.flush());
	}

	get hasUnsavedChanges(): boolean {
		return this.edits !== this.sentEdits;
	}

	/** The input as it was loaded (from the server or a draft): not an edit. */
	restored(): void {
		this.lastSent = JSON.stringify(this.snapshot());
	}

	changed(): void {
		this.edits++;
		this.changes.next();
	}

	/**
	 * Call just before the step's real save (Continue). The server deletes the draft when that
	 * save succeeds, so no draft save may land after it: the current input counts as sent, and
	 * this completes once any draft save already on its way has finished.
	 */
	beforeSave(): Observable<void> {
		this.markSent(JSON.stringify(this.snapshot()), this.edits);
		return this.inFlight === 0 ? of(undefined) : this.idle.pipe(take(1));
	}

	/** Saves now if there's anything unsaved (for example when leaving the step). */
	flush(): void {
		if (this.hasUnsavedChanges) {
			this.saveLatest().subscribe();
		}
	}

	private saveOnExit(): void {
		if (!this.hasUnsavedChanges) {
			return;
		}
		const value = this.snapshot();
		this.store.saveDraftOnExit(this.step, value);
		this.markSent(JSON.stringify(value), this.edits);
	}

	private saveLatest(): Observable<void> {
		return defer(() => {
			const value = this.snapshot();
			const json = JSON.stringify(value);
			const edits = this.edits;
			if (json === this.lastSent) {
				this.sentEdits = Math.max(this.sentEdits, edits);
				return EMPTY;
			}
			this.status.set('saving');
			this.inFlight++;
			return this.store.saveDraft(this.step, value).pipe(
				retry({ count: RETRIES, delay: (_error, attempt) => timer(1000 * 2 ** (attempt - 1)) }),
				tap(() => {
					this.markSent(json, edits);
					this.status.set('saved');
				}),
				catchError(() => {
					// The next edit (or leaving the page) tries again.
					this.status.set('error');
					return EMPTY;
				}),
				finalize(() => {
					if (--this.inFlight === 0) {
						this.idle.next();
					}
				})
			);
		});
	}

	/**
	 * Records what the server now has. Never goes backwards: a slow save finishing after
	 * `beforeSave()` (or a newer save) mustn't make newer input look unsent and send it again.
	 */
	private markSent(json: string, edits: number): void {
		if (edits >= this.sentEdits) {
			this.lastSent = json;
			this.sentEdits = edits;
		}
	}
}
