import { AbstractControl } from '@angular/forms';

/** Show a control's error only once the customer has interacted with it (or tried to submit). */
export function isInvalid(control: AbstractControl): boolean {
	return control.invalid && control.touched;
}
