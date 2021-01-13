import {isInteger, isNumber} from './utility';

import {ADTBase} from './base';
import {ADTObjectPoolConstructor as Constructor} from './object-pool/constructor';
import {ADTObjectPoolInstance as Instance} from './object-pool/instance';
import {ADTObjectPoolOptions as Options} from './object-pool/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTObjectPoolState as State} from './object-pool/state';

export class ADTObjectPool<T extends Instance> implements ADTBase<T> {
	public readonly state: State<T>;
	public readonly objectClass: Constructor<T>;
	private wastedSpace: number = 0;

	constructor(objectClass: Constructor<T>, options?: Options) {
		if (typeof objectClass !== 'function') {
			throw Error('Must have a class contructor for object pool to operate properly');
		}

		this.objectClass = objectClass;

		this.state = this.parseOptions(options);

		this.increaseCapacity(this.state.startSize);
	}

	public parseOptions(options?: Options): State<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: Options): State<T> {
		const state: State<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let result: State<T> | null = null;

		if (typeof options.serializedState === 'string') {
			const parsed = this.parseOptionsStateString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw parsed;
			}

			result = parsed;
		}

		if (result) {
			state.autoIncrease = result.autoIncrease;
			state.increaseBreakPoint = result.increaseBreakPoint;
			state.increaseFactor = result.increaseFactor;
			state.instanceArgs = result.instanceArgs;
			state.maxSize = result.maxSize;
			state.startSize = result.objectCount;
		}

		return state;
	}

	public parseOptionsStateString(state: string): State<T> | Error[] | null {
		if (typeof state !== 'string' || state === '') {
			return null;
		}

		let result: State<T> | Error[] | null = null;
		let errors: Error[] = [];

		try {
			const parsed = JSON.parse(state);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw Error('state is not a valid ADTObjectPoolState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
		}

		return result;
	}

	public parseOptionsOther(stateArg: State<T>, options?: Options): State<T> {
		let state: State<T> | null = stateArg;

		if (!stateArg) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		/* eslint-disable prettier/prettier */
		if (
			options.autoIncrease != null &&
			this.getStateErrorsAutoIncrease(options.autoIncrease).length === 0
		) {
			state.autoIncrease = options.autoIncrease;
		}
		if (
			options.increaseBreakPoint != null &&
			this.getStateErrorsIncreaseBreakPoint(options.increaseBreakPoint).length === 0
		) {
			state.increaseBreakPoint = options.increaseBreakPoint;
		}
		if (
			options.increaseFactor != null &&
			this.getStateErrorsIncreaseFactor(options.increaseFactor).length === 0
		) {
			state.increaseFactor = options.increaseFactor;
		}
		if (
			options.instanceArgs != null &&
			this.getStateErrorsInstanceArgs(options.instanceArgs).length === 0
		) {
			state.instanceArgs = options.instanceArgs;
		}
		if (options.maxSize != null && this.getStateErrorsMaxSize(options.maxSize).length === 0) {
			state.maxSize = options.maxSize;
		}
		if (options.startSize != null && this.getStateErrorsStartSize(options.startSize).length === 0) {
			state.startSize = options.startSize;
		}
		/* eslint-enable prettier/prettier */

		return state;
	}

	public cleanUsed(): void {
		this.state.used = this.state.used.filter((obj) => {
			return obj != null;
		});

		this.wastedSpace = 0;
	}

	public getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'ObjectPool',
			pool: [],
			used: [],
			autoIncrease: false,
			startSize: 1,
			objectCount: 0,
			maxSize: 1000,
			increaseBreakPoint: 1,
			increaseFactor: 2,
			instanceArgs: []
		};

		return state;
	}

	public getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		if (!state) {
			errors.push(Error('state is null or undefined'));
			return errors;
		}

		errors.push(...this.getStateErrorsAutoIncrease(state.autoIncrease));
		errors.push(...this.getStateErrorsIncreaseBreakPoint(state.increaseBreakPoint));
		errors.push(...this.getStateErrorsIncreaseFactor(state.increaseFactor));
		errors.push(...this.getStateErrorsInstanceArgs(state.instanceArgs));
		errors.push(...this.getStateErrorsMaxSize(state.maxSize));
		errors.push(...this.getStateErrorsObjectCount(state.objectCount));
		errors.push(...this.getStateErrorsPool(state.pool));
		errors.push(...this.getStateErrorsStartSize(state.startSize));
		errors.push(...this.getStateErrorsType(state.type));
		errors.push(...this.getStateErrorsUsed(state.used));

		return errors;
	}

	public getStateErrorsAutoIncrease(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || typeof data !== 'boolean') {
			errors.push(Error('state autoIncrease must be a boolean'));
		}

		return errors;
	}

	public getStateErrorsIncreaseBreakPoint(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isNumber(data) || data < 0 || data > 1) {
			errors.push(Error('state increaseBreakPoint must be a number between 0 and 1'));
		}

		return errors;
	}

	public getStateErrorsIncreaseFactor(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isNumber(data) || data <= 1) {
			errors.push(Error('state increaseFactor must be a number > 1'));
		}

		return errors;
	}

	public getStateErrorsInstanceArgs(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state instanceArgs must be an array'));
		}

		return errors;
	}

	public getStateErrorsMaxSize(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 1) {
			errors.push(Error('state maxSize must be an integer >= 1'));
		}

		return errors;
	}

	public getStateErrorsObjectCount(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 0) {
			errors.push(Error('state objectCount must be an integer >= 0'));
		}

		return errors;
	}

	public getStateErrorsPool(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state pool must be an array'));
		}

		return errors;
	}

	public getStateErrorsStartSize(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 0) {
			errors.push(Error('state startSize must be an integer >= 0'));
		}

		return errors;
	}

	public getStateErrorsType(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || data !== 'ObjectPool') {
			errors.push(Error('state type must be ObjectPool'));
		}

		return errors;
	}

	public getStateErrorsUsed(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state used must be an array'));
		}

		return errors;
	}

	public isAboveThreshold(allocationsPending: number = 0): boolean {
		return this.utilization(allocationsPending) > this.state.increaseBreakPoint;
	}

	public isValidState(state: State<T>): boolean {
		return this.getStateErrors(state).length === 0;
	}

	public queryDelete(query: QueryResult<T>): T | null {
		if (query.element == null) {
			return null;
		}

		this.release(query.element);

		return query.element;
	}

	public queryIndex(query: T): number | null {
		const index = this.state.used.findIndex((element) => {
			return element === query;
		});

		if (index < 0) {
			return null;
		}

		return index;
	}

	public queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && isNumber(opts.limit) && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}

	public shouldCleanUsed(): boolean {
		const empty = this.wastedSpace || 1;
		const total = this.state.used.length;

		return total / empty < Math.log(total);
	}

	public store(object: T): void {
		if (!this.isValidState(this.state)) {
			return;
		}

		this.state.pool.push(object);
	}

	public allocate(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (this.state.autoIncrease && this.isAboveThreshold(1)) {
			const maxSize = Math.ceil(this.state.objectCount * this.state.increaseFactor);
			this.increaseCapacity(maxSize - this.state.objectCount);
		}

		const result = this.state.pool.pop();

		if (result == null) {
			return null;
		}

		this.state.used.push(result);

		return result;
	}

	public allocateMultiple(n: number = 1): Array<T> {
		let num: number;
		if (!isInteger(n) || n < 1) {
			num = 1;
		} else {
			num = n;
		}

		while (this.state.autoIncrease && this.isAboveThreshold(num)) {
			const maxSize = Math.ceil(this.state.objectCount * this.state.increaseFactor);
			this.increaseCapacity(maxSize - this.state.objectCount);
		}

		const result: Array<T> = [];

		for (let i = 0; i < num && this.state.pool.length; i++) {
			const item = this.allocate();
			if (item !== null) {
				result.push(item);
			}
		}

		return result;
	}

	public clearElements(): ADTObjectPool<T> {
		this.state.pool = [];
		this.state.objectCount = 0;

		return this;
	}

	public forEach(func: (element: T, index: number, arr: T[]) => void, thisArg?: unknown): ADTObjectPool<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg as this;
		}

		this.state.used.forEach((elem, idx) => {
			if (elem == null) {
				return;
			}

			func.call(boundThis, elem, idx, this.state.pool);
		}, boundThis);

		return this;
	}

	public increaseCapacity(n: number): void {
		if (!this.isValidState(this.state)) {
			return;
		}
		if (!isInteger(n)) {
			return;
		}

		for (let i = 0; i < n && this.state.objectCount < this.state.maxSize; i++) {
			this.store(new this.objectClass(...this.state.instanceArgs));
			this.state.objectCount++;
		}
	}

	public map(): T[];
	public map<U>(func: (element: T, index: number, arr: T[]) => U, thisArg?: unknown): U[];
	public map<U>(func?: (element: T, index: number, arr: T[]) => U, thisArg?: unknown): U[] | T[] {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg as this;
		}

		const filtered = this.state.used.filter((elem) => elem != null) as T[];

		if (func == null) {
			return filtered;
		}

		const mapped = filtered.map((elem, idx) => {
			return func.call(boundThis, elem, idx, filtered);
		});

		return mapped;
	}

	public query(filters: QueryFilter<T> | QueryFilter<T>[], opts?: QueryOptions): QueryResult<T>[] {
		const resultsArray: QueryResult<T>[] = [];
		const options = this.queryOptions(opts);

		this.forEach((element) => {
			let take = false;

			if (resultsArray.length >= options.limit) {
				return false;
			}

			if (Array.isArray(filters)) {
				take =
					!!filters.length &&
					filters.every((filter) => {
						return filter(element);
					});
			} else {
				take = filters(element);
			}

			if (!take) {
				return false;
			}

			const result: QueryResult<T> = {} as QueryResult<T>;
			result.element = element;
			result.key = (): string | null => null;
			result.index = this.queryIndex.bind(this, element);
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public release(object: T): void {
		if (typeof object.cleanObj !== 'function') {
			return;
		}

		const index = this.state.used.findIndex((obj) => obj === object);
		if (index >= 0) {
			this.state.used[index] = null;
			this.wastedSpace++;
		}

		if (this.shouldCleanUsed()) {
			this.cleanUsed();
		}

		object.cleanObj();
		this.store(object);
	}

	public releaseMultiple(objects: Array<T>): void {
		for (let i = 0; i < objects.length; i++) {
			this.release(objects[i]);
		}

		this.cleanUsed();
	}

	public reset(): ADTObjectPool<T> {
		this.clearElements();

		this.state.type = 'ObjectPool';
		this.state.autoIncrease = false;
		this.state.increaseFactor = 2;
		this.state.increaseBreakPoint = 1;

		this.increaseCapacity(this.state.startSize);

		return this;
	}

	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		let state = JSON.stringify(this.state);
		state = state.replace(/"(pool|used)":\[.*?\]/g, '"$1":[]');

		return state;
	}

	public utilization(allocationsPending: number = 0): number {
		if (!this.isValidState(this.state)) {
			return NaN;
		}
		if (this.state.objectCount === 0) {
			return Infinity;
		}

		let num: number = allocationsPending;
		if (!isNumber(num)) {
			num = 0;
		}

		const freeObj = this.state.pool.length - num;
		return (this.state.objectCount - freeObj) / this.state.objectCount;
	}
}
