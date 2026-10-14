import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TermsDialogComponent } from './terms-dialog.component';

describe('TermsDialogComponent', () => {
	let fixture: ComponentFixture<TermsDialogComponent>;
	const dialog = () => (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
	const button = (text: string) =>
		Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === text
		)!;

	beforeEach(() => {
		fixture = TestBed.createComponent(TermsDialogComponent);
		fixture.detectChanges();
	});

	afterEach(() => dialog().close());

	it('opens as a modal and closes without agreeing', () => {
		const agreed = jasmine.createSpy('agreed');
		fixture.componentInstance.agreed.subscribe(agreed);

		fixture.componentInstance.open();
		expect(dialog().open).toBeTrue();

		button('Close').click();
		expect(dialog().open).toBeFalse();
		expect(agreed).not.toHaveBeenCalled();
	});

	it('emits agreed and closes when the customer agrees', () => {
		const agreed = jasmine.createSpy('agreed');
		fixture.componentInstance.agreed.subscribe(agreed);
		fixture.componentInstance.open();

		button('I agree').click();

		expect(agreed).toHaveBeenCalled();
		expect(dialog().open).toBeFalse();
	});
});
