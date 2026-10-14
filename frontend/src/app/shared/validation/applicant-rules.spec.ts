import { ageOn, dateOfBirthProblem, isValidEmail, normaliseAuMobile, parseIsoDate, toIsoDate } from './applicant-rules';

describe('applicant rules', () => {
	describe('normaliseAuMobile', () => {
		const accepted: [string, string][] = [
			['0412345678', '0412345678'],
			['0412 345 678', '0412345678'],
			['+61 412 345 678', '0412345678'],
			['61412345678', '0412345678'],
			['+61 0412 345 678', '0412345678'],
			['(04) 1234-5678', '0412345678']
		];
		const rejected = ['', '0212345678', '041234567', '04123456789', '0412abc678', '+1 412 345 678', '412345678'];

		accepted.forEach(([raw, expected]) =>
			it(`accepts "${raw}"`, () => expect(normaliseAuMobile(raw)).toBe(expected))
		);
		rejected.forEach((raw) => it(`rejects "${raw}"`, () => expect(normaliseAuMobile(raw)).toBeNull()));
	});

	describe('isValidEmail', () => {
		it('accepts ordinary addresses, ignoring surrounding spaces', () => {
			expect(isValidEmail('alex.taylor@example.com')).toBeTrue();
			expect(isValidEmail(' a@b.co ')).toBeTrue();
		});

		it('rejects addresses without a domain dot, with spaces, or over 254 characters', () => {
			expect(isValidEmail('alex@example')).toBeFalse();
			expect(isValidEmail('alex taylor@example.com')).toBeFalse();
			expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBeFalse();
		});
	});

	describe('parseIsoDate', () => {
		it('parses as a local date', () => {
			const date = parseIsoDate('1990-01-01')!;
			expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([1990, 0, 1]);
		});

		it('rejects impossible or badly formatted dates', () => {
			expect(parseIsoDate('2023-02-30')).toBeNull();
			expect(parseIsoDate('01/01/1990')).toBeNull();
			expect(parseIsoDate('')).toBeNull();
		});

		it('round-trips with toIsoDate', () => {
			expect(toIsoDate(parseIsoDate('2004-03-09')!)).toBe('2004-03-09');
		});
	});

	describe('ageOn', () => {
		const today = new Date(2026, 9, 14); // 14 Oct 2026

		it('counts a birthday that falls today', () => expect(ageOn('2008-10-14', today)).toBe(18));
		it('does not count a birthday tomorrow', () => expect(ageOn('2008-10-15', today)).toBe(17));
		it('treats a 29 Feb birthday as reached on 1 Mar in other years', () => {
			expect(ageOn('2008-02-29', new Date(2026, 1, 28))).toBe(17);
			expect(ageOn('2008-02-29', new Date(2026, 2, 1))).toBe(18);
		});
	});

	describe('dateOfBirthProblem', () => {
		const today = new Date(2026, 9, 14);
		const cases: [string, string | null][] = [
			['2008-10-14', null],
			['2008-10-15', 'underage'],
			['2027-01-01', 'future'],
			['1905-01-01', 'tooOld'],
			['1906-10-14', null],
			['not-a-date', 'invalid']
		];

		cases.forEach(([dob, problem]) =>
			it(`${dob} → ${problem ?? 'ok'}`, () => expect(dateOfBirthProblem(dob, today)).toBe(problem as never))
		);
	});
});
