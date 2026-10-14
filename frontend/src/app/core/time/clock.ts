import { InjectionToken } from '@angular/core';

/** Current date and time. Injected so date rules (such as the minimum age) can be tested on a fixed day. */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', { factory: () => () => new Date() });
