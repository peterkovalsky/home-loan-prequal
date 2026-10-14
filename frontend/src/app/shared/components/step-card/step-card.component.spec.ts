import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepCardComponent } from './step-card.component';

@Component({
	imports: [StepCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<app-step-card heading="Step" [loading]="loading()" [errorMessages]="errors()">
		<p class="projected">Form</p>
	</app-step-card>`
})
class HostComponent {
	readonly loading = signal(false);
	readonly errors = signal<string[]>([]);
}

describe('StepCardComponent', () => {
	let fixture: ComponentFixture<HostComponent>;
	const query = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector);

	beforeEach(() => {
		fixture = TestBed.createComponent(HostComponent);
		fixture.detectChanges();
	});

	it('shows the projected content once loaded', () => {
		expect(query('h1')?.textContent).toContain('Step');
		expect(query('.projected')).not.toBeNull();
	});

	it('hides the content while loading', () => {
		fixture.componentInstance.loading.set(true);
		fixture.detectChanges();

		expect(query('[role="status"]')).not.toBeNull();
		expect(query('.projected')).toBeNull();
	});

	it('summarises error messages', () => {
		fixture.componentInstance.errors.set(['First problem', 'Second problem']);
		fixture.detectChanges();

		expect(query('[role="alert"]')?.textContent).toContain('Second problem');
	});
});
