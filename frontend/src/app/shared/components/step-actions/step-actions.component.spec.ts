import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepActionsComponent } from './step-actions.component';

describe('StepActionsComponent', () => {
	let fixture: ComponentFixture<StepActionsComponent>;
	const buttons = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

	beforeEach(() => {
		fixture = TestBed.createComponent(StepActionsComponent);
	});

	it('only shows Back when asked to', () => {
		fixture.detectChanges();
		expect(buttons().map((b) => b.textContent?.trim())).toEqual(['Continue']);

		fixture.componentRef.setInput('showBack', true);
		fixture.detectChanges();
		expect(buttons().map((b) => b.textContent?.trim())).toEqual(['Back', 'Continue']);
	});

	it('emits back and disables both buttons while saving', () => {
		fixture.componentRef.setInput('showBack', true);
		const back = jasmine.createSpy('back');
		fixture.componentInstance.back.subscribe(back);
		fixture.detectChanges();

		buttons()[0].click();
		expect(back).toHaveBeenCalled();

		fixture.componentRef.setInput('saving', true);
		fixture.detectChanges();
		expect(buttons().every((b) => b.disabled)).toBeTrue();
	});
});
