import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { JOURNEY, JourneyStep } from './journey-steps';

/** Knows the order of the journey so steps never hard-code their neighbours. */
@Injectable({ providedIn: 'root' })
export class JourneyService {
	private readonly router = inject(Router);

	readonly steps = inject(JOURNEY);

	next(path: string): JourneyStep | null {
		return this.offset(path, 1);
	}

	previous(path: string): JourneyStep | null {
		return this.offset(path, -1);
	}

	/** Navigates to the step after `path`. Returns false when `path` is the last step. */
	goNext(path: string): boolean {
		return this.goTo(this.next(path));
	}

	/** Navigates to the step before `path`. Returns false when `path` is the first step. */
	goBack(path: string): boolean {
		return this.goTo(this.previous(path));
	}

	private offset(path: string, delta: number): JourneyStep | null {
		const index = this.steps.findIndex((step) => step.path === path);
		return index === -1 ? null : (this.steps[index + delta] ?? null);
	}

	private goTo(step: JourneyStep | null): boolean {
		if (!step) {
			return false;
		}
		void this.router.navigateByUrl(step.path);
		return true;
	}
}
