import { Provider, computed, signal } from '@angular/core';
import { of } from 'rxjs';
import { DraftsService } from '../app/core/api/drafts.service';
import { ApplicationSession, SessionData } from '../app/core/session/application-session';

export const TEST_TOKEN = 'test-token';

/**
 * Stands in for ApplicationSession: no localStorage, no network. `ensure()` "creates"
 * application 7 when there's none yet.
 */
export class FakeSession {
	private readonly state = signal<SessionData | null>(null);
	readonly current = this.state.asReadonly();
	readonly applicationId = computed(() => this.state()?.id ?? null);
	readonly ensure = jasmine.createSpy('ensure').and.callFake(() => {
		this.state.update((s) => s ?? { id: 7, token: 'token-7' });
		return of(this.state()!.id);
	});
	readonly forget = jasmine.createSpy('forget').and.callFake(() => this.state.set(null));

	resume(id = 1, token = TEST_TOKEN): void {
		this.state.set({ id, token });
	}
}

/** A session already holding application `id` (a returning visitor), unless `id` is null. */
export function provideTestSession(id: number | null = 1): { session: FakeSession; providers: Provider[] } {
	const session = new FakeSession();
	if (id !== null) {
		session.resume(id);
	}
	const drafts = jasmine.createSpyObj<DraftsService>('DraftsService', ['getAll', 'save', 'saveOnExit']);
	drafts.getAll.and.returnValue(of({}));
	drafts.save.and.returnValue(of(undefined));
	return {
		session,
		providers: [
			{ provide: ApplicationSession, useValue: session },
			{ provide: DraftsService, useValue: drafts }
		]
	};
}
