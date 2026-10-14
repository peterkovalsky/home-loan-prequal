export interface Option<T> {
	value: T;
	label: string;
}

export enum LendingPurpose {
	PurchaseExistingDwelling = 1003,
	PurchaseNewDwelling = 1004,
	Construction = 1000,
	Refinance = 1006,
	FurtherAdvance = 1001,
	Other = 1002
}

export enum PropertyUsage {
	OwnerOccupied = 1003,
	InvestmentResidential = 1002
}

export enum NumberOfApplicants {
	Single = 1,
	Couple = 2,
	More = 3
}

export enum AuState {
	ACT = 1000,
	NSW = 1001,
	NT = 1002,
	QLD = 1003,
	SA = 1004,
	TAS = 1005,
	VIC = 1006,
	WA = 1007
}

export const LENDING_PURPOSE_OPTIONS: Option<LendingPurpose>[] = [
	{ value: LendingPurpose.PurchaseExistingDwelling, label: 'Buy an existing home' },
	{ value: LendingPurpose.PurchaseNewDwelling, label: 'Buy a new home' },
	{ value: LendingPurpose.Construction, label: 'Build a home' },
	{ value: LendingPurpose.Refinance, label: 'Refinance' },
	{ value: LendingPurpose.FurtherAdvance, label: 'Borrow more on my current loan' },
	{ value: LendingPurpose.Other, label: 'Something else' }
];

export const PROPERTY_USAGE_OPTIONS: Option<PropertyUsage>[] = [
	{ value: PropertyUsage.OwnerOccupied, label: 'To live in' },
	{ value: PropertyUsage.InvestmentResidential, label: 'Investment' }
];

export const NUMBER_OF_APPLICANTS_OPTIONS: Option<NumberOfApplicants>[] = [
	{ value: NumberOfApplicants.Single, label: 'Just me' },
	{ value: NumberOfApplicants.Couple, label: 'Two of us' },
	{ value: NumberOfApplicants.More, label: 'More than two' }
];

export const AU_STATE_OPTIONS: Option<AuState>[] = [
	{ value: AuState.ACT, label: 'ACT' },
	{ value: AuState.NSW, label: 'NSW' },
	{ value: AuState.NT, label: 'NT' },
	{ value: AuState.QLD, label: 'QLD' },
	{ value: AuState.SA, label: 'SA' },
	{ value: AuState.TAS, label: 'TAS' },
	{ value: AuState.VIC, label: 'VIC' },
	{ value: AuState.WA, label: 'WA' }
];

export const PURCHASE_PURPOSES: LendingPurpose[] = [
	LendingPurpose.PurchaseExistingDwelling,
	LendingPurpose.PurchaseNewDwelling,
	LendingPurpose.Construction
];
