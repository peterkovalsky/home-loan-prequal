import { ChangeDetectionStrategy, Component, ElementRef, output, viewChild } from '@angular/core';

/** Placeholder pre-qualification and privacy terms. A native <dialog> gives focus trapping and Esc to close. */
@Component({
	selector: 'app-terms-dialog',
	templateUrl: './terms-dialog.component.html',
	styleUrl: './terms-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TermsDialogComponent {
	private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

	readonly agreed = output<void>();

	open(): void {
		this.dialog().nativeElement.showModal();
	}

	close(): void {
		this.dialog().nativeElement.close();
	}

	agree(): void {
		this.agreed.emit();
		this.close();
	}
}
