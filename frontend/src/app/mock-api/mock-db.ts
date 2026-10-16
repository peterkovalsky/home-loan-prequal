const STORAGE_PREFIX = 'mock-api:';

const memoryFallback = new Map<string, string>();

function read(key: string): string | null {
	try {
		return localStorage.getItem(STORAGE_PREFIX + key);
	} catch {
		return memoryFallback.get(key) ?? null;
	}
}

function write(key: string, value: string): void {
	try {
		localStorage.setItem(STORAGE_PREFIX + key, value);
	} catch {
		memoryFallback.set(key, value);
	}
}

export const mockDb = {
	get<T>(key: string): T | null {
		const raw = read(key);
		return raw ? (JSON.parse(raw) as T) : null;
	},

	set<T>(key: string, value: T): void {
		write(key, JSON.stringify(value));
	},

	remove(key: string): void {
		memoryFallback.delete(key);
		try {
			localStorage.removeItem(STORAGE_PREFIX + key);
		} catch {
			return;
		}
	},

	clear(): void {
		memoryFallback.clear();
		try {
			Object.keys(localStorage)
				.filter((key) => key.startsWith(STORAGE_PREFIX))
				.forEach((key) => localStorage.removeItem(key));
		} catch {
			return;
		}
	}
};
