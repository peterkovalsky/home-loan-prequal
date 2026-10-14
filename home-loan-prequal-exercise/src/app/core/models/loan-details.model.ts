import { AuState, LendingPurpose, NumberOfApplicants, PropertyUsage } from './reference-data';

export interface LoanDetails {
	applicationId: number;
	purpose: LendingPurpose;
	propertyUsage: PropertyUsage;
	numberOfApplicants: NumberOfApplicants;
	isSameHousehold: boolean | null;
	numberOfDependants: number;
	loanAmount: number;
	deposit: number | null;
	estimatedPropertyValue: number | null;
	isAddressKnown: boolean;
	address: string | null;
	state: AuState | null;
}
