import {ADTObjectPool} from '../src/object-pool';
import {ADTObjectPoolInstance} from '../src/object-pool/instance';
import {ADTQueryFilter} from '../src/query/filter';
import {ADTQueryOptions} from '../src/query/options';
import {ADTObjectPoolOptions as Options} from '../src/object-pool/options';
import {ADTObjectPoolState as State} from '../src/object-pool/state';

describe('ADTObjectPool', () => {
	const FALSY_NAN_VALUES = [null, undefined, '', NaN];
	const TRUTHY_NAN_VALUES = ['1.5', '-1', '0', '1', '1.5'];
	const NAN_VALUES = ([] as any[]).concat(FALSY_NAN_VALUES, TRUTHY_NAN_VALUES);

	const NEG_FLOAT_VALUES = [-9.9, -0.5];
	const POS_FLOAT_VALUES = [0.5, 9.9];
	const FLOAT_VALUES = ([] as any[]).concat(NEG_FLOAT_VALUES, POS_FLOAT_VALUES);

	const NEG_INT_VALUES = [-1, -10];
	const POS_INT_VALUES = [1, 10];
	const INT_VALUES = ([0] as any[]).concat(NEG_INT_VALUES, POS_INT_VALUES);

	const NEG_NUM_VALUES = ([] as any[]).concat(NEG_INT_VALUES, NEG_FLOAT_VALUES);
	const POS_NUM_VALUES = ([] as any[]).concat(POS_INT_VALUES, POS_FLOAT_VALUES);
	const NUM_VALUES = ([0] as any[]).concat(NEG_NUM_VALUES, POS_NUM_VALUES);

	const DEFAULT_STATE: State<objectClass> = {
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
	const STATE_PROPERTIES = Object.keys(DEFAULT_STATE);
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "ObjectPool",',
		'"pool": [],',
		'"used": [],',
		'"autoIncrease": true,',
		'"startSize": 2,',
		'"objectCount": 2,',
		'"maxSize": 4,',
		'"increaseBreakPoint": 0,',
		'"increaseFactor": 3,',
		'"instanceArgs": []',
		'}'
	].join('');

	class objectClass implements ADTObjectPoolInstance {
		public name!: string;
		public amount!: number;

		constructor(name: string = '') {
			this.cleanObj();
			this.name = name;
			this.amount = Math.random();
		}

		cleanObj(): void {
			this.name = '';
			this.amount = 0;
		}
	}
	const isValidStateRuns = function (action: (obj: any) => void): void {
		it('should run isValidState check', () => {
			const custom: ADTObjectPool<objectClass> = new ADTObjectPool<objectClass>(objectClass);
			const spy = jest.spyOn(custom, 'isValidState');
			spy.mockClear();
			custom.state.type = '' as any;
			action(custom);
			expect(spy).toBeCalled();
		});
	};
	const queryFilter = function (target: number): ADTQueryFilter<objectClass> {
		const filter: ADTQueryFilter<objectClass> = (element): boolean => {
			return element.amount < target;
		};

		return filter;
	};

	let instance: ADTObjectPool<objectClass>;

	beforeAll(() => {
		instance = new ADTObjectPool(objectClass);
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		describe('constructor', () => {
			it('should throw if no class is passed', () => {
				expect(() => {
					const custom = new ADTObjectPool(null as any);
				}).toThrow('Must have a class contructor for object pool to operate properly');
			});

			it('should initialize with default state when no options are paseed', () => {
				const expectedV = {...DEFAULT_STATE};
				expectedV.objectCount = DEFAULT_STATE.startSize;
				const custom = new ADTObjectPool<objectClass>(objectClass);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expectedV);
			});

			it('should initialize with serializedState', () => {
				const custom = new ADTObjectPool<objectClass>(objectClass, {
					serializedState: VALID_SERIALIZED_STATE
				});
				expect(custom.state.objectCount).toBe(2);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
			});

			it('should initialize with other options overriding serializedState if they are valid', () => {
				const expectedV: State<objectClass> = JSON.parse(VALID_SERIALIZED_STATE);
				expectedV.startSize = 20;
				expectedV.objectCount = expectedV.startSize;
				expectedV.maxSize = 100;
				expectedV.increaseFactor = 10;
				expectedV.instanceArgs = ['name is dog'];

				const custom = new ADTObjectPool<objectClass>(objectClass, {
					serializedState: VALID_SERIALIZED_STATE,
					startSize: expectedV.startSize,
					maxSize: expectedV.maxSize,
					increaseBreakPoint: 2,
					increaseFactor: expectedV.increaseFactor,
					instanceArgs: expectedV.instanceArgs
				});

				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expectedV);
			});
		});

		describe('parseOptions', () => {
			it('should return default properties if options is falsey', () => {
				expect(instance.parseOptions()).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptions(null!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptions(undefined!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptions({} as any)).toStrictEqual(DEFAULT_STATE);
			});

			it('should return properties from parsed options', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
				expectedV.objectCount = 0;

				expect(
					instance.parseOptions({
						serializedState: VALID_SERIALIZED_STATE
					})
				).toStrictEqual(expectedV);

				expectedV.startSize = 95;

				expect(
					instance.parseOptions({
						serializedState: VALID_SERIALIZED_STATE,
						startSize: expectedV.startSize,
						maxSize: -5
					})
				).toStrictEqual(expectedV);
			});
		});

		describe('parseOptionsState', () => {
			it('should return the default state if options is falsey', () => {
				expect(instance.parseOptionsState(null!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsState('' as any)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsState(undefined!)).toStrictEqual(DEFAULT_STATE);
			});

			it.each(STATE_PROPERTIES)('should throw when state.%s is null', (myTest) => {
				const state = {...DEFAULT_STATE};
				state[myTest] = null!;
				const errors = instance.getStateErrors(state);

				expect(() => {
					instance.parseOptionsState({
						serializedState: JSON.stringify(state)
					});
				}).toThrow(errors.join('\n'));
			});

			describe('should throw if serializedState is not valid', () => {
				STATE_PROPERTIES.forEach((v) => {
					it(v + ' is null', () => {
						const state = {...DEFAULT_STATE};
						state[v] = null!;
						const errors = instance.getStateErrors(state);

						expect(() => {
							instance.parseOptionsState({
								serializedState: JSON.stringify(state)
							});
						}).toThrow(errors.join('\n'));
					});
				});
			});

			it('should return serializedState as ADTObjectPoolState if it is valid', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
				expectedV.objectCount = 0;

				expect(
					instance.parseOptionsState({
						serializedState: VALID_SERIALIZED_STATE
					})
				).toStrictEqual(expectedV);
			});
		});

		describe('parseOptionsStateString', () => {
			it('should return null if argument is not a string with length > 0', () => {
				expect(instance.parseOptionsStateString(4 as any)).toBeNull();
				expect(instance.parseOptionsStateString([] as any)).toBeNull();
				expect(instance.parseOptionsStateString({} as any)).toBeNull();
				expect(instance.parseOptionsStateString('' as any)).toBeNull();
				expect(instance.parseOptionsStateString(false as any)).toBeNull();
			});

			it('should return array of errors if string cant be parsed', () => {
				const expectedErrorEnd = Error('Unexpected end of JSON input');
				expect(instance.parseOptionsStateString('[4,3,')).toContainEqual(expectedErrorEnd);

				const expectedErrorToken = Error('Unexpected token l in JSON at position 1');
				expect(instance.parseOptionsStateString('{left:f,right:')).toContainEqual(expectedErrorToken);
			});

			const toParseList = ['{}', '{"type": "ObjectPool"}', '{"pool":4, "type": "ObjectPool"}'];
			it.each(toParseList)('should return errors, %p wont parse into an ADTStackState', (toParse) => {
				let errors: Error[] = [];
				errors = instance.getStateErrors(JSON.parse(toParse) as any);
				errors.unshift(Error('state is not a valid ADTObjectPoolState'));
				expect(instance.parseOptionsStateString(toParse)).toStrictEqual(errors);
			});

			it('should return an ADTObjectPoolState when a parsable string is passed', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
				expect(instance.parseOptionsStateString(VALID_SERIALIZED_STATE)).toStrictEqual(expectedV);
			});
		});

		describe('parseOptionsOther', () => {
			it('should return the default state if state is falsey', () => {
				expect(instance.parseOptionsOther(null!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsOther('' as any)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsOther(undefined!)).toStrictEqual(DEFAULT_STATE);
			});

			it('should return passed state if options is null or undefined', () => {
				const testSuite = [null, undefined];
				testSuite.forEach((myTest) => {
					expect(instance.parseOptionsOther(instance.state, myTest!)).toStrictEqual(instance.state);
					expect(instance.parseOptionsOther(DEFAULT_STATE as any, myTest!)).toStrictEqual(
						DEFAULT_STATE
					);

					const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
					expect(instance.parseOptionsOther(expectedV as any, myTest!)).toStrictEqual(expectedV);
				});
			});

			it('should return passed state with values changed to match other passed options if those are valid', () => {
				type Option = Required<Omit<Options, 'serializedState'>>;
				const opts: Option = {
					startSize: 20,
					maxSize: 666,
					autoIncrease: true,
					increaseBreakPoint: 0.54321,
					increaseFactor: 10,
					instanceArgs: ['test']
				};

				const expectedV = {...DEFAULT_STATE, ...opts};
				const result = instance.parseOptionsOther({...DEFAULT_STATE}, opts);

				expect(result).toStrictEqual(expectedV);
			});
		});
	});

	describe('Helpers', () => {
		describe('getDefaultState', () => {
			it('should return the default state', () => {
				expect(instance.getDefaultState()).toStrictEqual(DEFAULT_STATE);
			});
		});

		describe('getStateErrors', () => {
			it('should return an empty array if state is valid', () => {
				expect(instance.getStateErrors(DEFAULT_STATE)).toStrictEqual([]);
			});

			const testSuite = [null, undefined, '', 0];
			it.each(testSuite)('should return errors if state is %p', (myTest) => {
				const expectedV = Error('state is null or undefined');
				const errors = instance.getStateErrors(myTest as any);

				expect(Array.isArray(errors)).toBe(true);
				expect(errors).toContainEqual(expectedV);
			});
		});

		const stateTestSuiteObj = [
			{
				prop: 'Type',
				result: 'not "ObjectPool"',
				testSuite: ([] as any).concat([null, undefined, '', 'state']),
				expectedV: Error('state type must be ObjectPool')
			},
			{
				prop: 'Pool',
				result: 'not an array',
				testSuite: ([] as any).concat([{}, '', 'true', 'false', 0, 1, null, undefined]),
				expectedV: Error('state pool must be an array')
			},
			{
				prop: 'Used',
				result: 'not an array',
				testSuite: ([] as any).concat([{}, '', 'true', 'false', 0, 1, null, undefined]),
				expectedV: Error('state used must be an array')
			},
			{
				prop: 'AutoIncrease',
				result: 'not a boolean',
				testSuite: ([] as any).concat([{}, null, undefined, '', 'teststring']),
				expectedV: Error('state autoIncrease must be a boolean')
			},
			{
				prop: 'StartSize',
				result: 'not an integer >= 0',
				testSuite: ([] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES),
				expectedV: Error('state startSize must be an integer >= 0')
			},
			{
				prop: 'ObjectCount',
				result: 'not an integer >= 0',
				testSuite: ([] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES),
				expectedV: Error('state objectCount must be an integer >= 0')
			},
			{
				prop: 'MaxSize',
				result: 'not an integer >= 1',
				testSuite: ([0] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES),
				expectedV: Error('state maxSize must be an integer >= 1')
			},
			{
				prop: 'IncreaseBreakPoint',
				result: 'not (0 <= number <= 1)',
				testSuite: ([2, 2.5] as any[]).concat(NAN_VALUES, NEG_NUM_VALUES),
				expectedV: Error('state increaseBreakPoint must be a number between 0 and 1')
			},
			{
				prop: 'IncreaseFactor',
				result: 'not a number > 1',
				testSuite: ([0, 1] as any[]).concat(NAN_VALUES, NEG_NUM_VALUES),
				expectedV: Error('state increaseFactor must be a number > 1')
			},
			{
				prop: 'InstanceArgs',
				result: 'not an array',
				testSuite: ([] as any).concat([{}, '', 'true', 'false', 0, 1, null, undefined]),
				expectedV: Error('state instanceArgs must be an array')
			}
		];
		const stateTestSuite = stateTestSuiteObj.map((elem) => {
			return [elem.prop, elem.result, elem.testSuite, elem.expectedV];
		});
		describe.each(stateTestSuite)('%p', (prop, result, myTests, expectedV) => {
			it.each(myTests)(`should return errors, ${prop} is %p, ${result}`, (myTest) => {
				const errors = instance[`getStateErrors${prop}`](myTest);

				expect(Array.isArray(errors)).toBe(true);
				expect(errors).toContainEqual(expectedV);
			});
		});

		describe('isAboveThreshold', () => {
			isValidStateRuns((obj) => {
				obj.isAboveThreshold();
			});

			const testSuiteObj: Array<{resultText: string; testSuite: any[]; expectedV: boolean}> = [
				{
					resultText: 'true, n is a number > 0',
					testSuite: ([] as any).concat(([] as any[]).concat(POS_NUM_VALUES)),
					expectedV: true
				},
				{
					resultText: 'false, n is a number <= 0',
					testSuite: ([0] as any).concat(NEG_NUM_VALUES, NAN_VALUES),
					expectedV: false
				}
			];
			const testSuite: Array<any[]> = testSuiteObj.map((elem) => {
				return [elem.resultText, elem.testSuite, elem.expectedV];
			});
			describe.each(testSuite)('should return %s', (resultText, myTests, expectedV) => {
				it.each(myTests)(`should return ${resultText}, it is %p`, (myTest) => {
					instance.state.increaseBreakPoint = 0;
					expect(instance.isAboveThreshold(myTest!)).toBe(expectedV);
				});
			});
		});

		describe('isValidState', () => {
			it('should return true if state is a valid ADTObjectPoolState', () => {
				expect(instance.isValidState(instance.state)).toBe(true);
			});

			it('should return false if state is null or undefined', () => {
				const testSuite = [null, undefined];
				testSuite.forEach((myTest) => {
					expect(instance.isValidState(myTest!)).toBe(false);
				});
			});

			it.each(STATE_PROPERTIES)('should return false if a state state.%s is not valid', (myTest) => {
				const state = {...DEFAULT_STATE};
				state[myTest] = null!;
				expect(instance.isValidState(state)).toBe(false);
			});
		});

		describe('queryDelete', () => {
			it('should return null if arg does not have an index method', () => {
				expect(instance.queryDelete({} as any)).toBeNull();
			});

			it('should return element if it is in queue', () => {
				instance.allocate();
				const queryResult = instance.query(queryFilter(1))[0];
				expect(instance.queryDelete(queryResult)).toBe(queryResult.element);
			});

			it('should delete the element from queue', () => {
				instance.allocate();
				const queryResult = instance.query(queryFilter(1))[0];
				instance.queryDelete(queryResult);
				instance.cleanUsed();
				expect(instance.state.used.length).toBe(0);
			});
		});

		describe('queryIndex', () => {
			it('should return null if element is not in queue', () => {
				instance.allocate();
				const queryResult = instance.query(queryFilter(1))[0];

				queryResult.delete();
				expect(queryResult.index()).toBeNull();
			});
		});

		describe('queryOptions', () => {
			const DEFAULT_OPTS = {
				limit: Infinity
			};
			it('should return ADTQueryOptions with all properties', () => {
				const props = ['limit'];
				const opts1 = instance.queryOptions();
				const opts2 = instance.queryOptions({});
				const opts3 = instance.queryOptions({limit: 99});
				const opts4 = instance.queryOptions({limit: '99' as any});

				props.forEach((prop) => {
					expect(opts1[prop]).not.toBeUndefined();
					expect(opts2[prop]).not.toBeUndefined();
					expect(opts3[prop]).not.toBeUndefined();
					expect(opts4[prop]).not.toBeUndefined();
				});
			});

			it('should return default if opts is null or underfined', () => {
				expect(instance.queryOptions()).toStrictEqual(DEFAULT_OPTS);
				expect(instance.queryOptions(null!)).toStrictEqual(DEFAULT_OPTS);
				expect(instance.queryOptions(undefined!)).toStrictEqual(DEFAULT_OPTS);
			});

			it('should return default with passed props overridden', () => {
				const expectedV = {...DEFAULT_OPTS};
				const opts: ADTQueryOptions = {};
				expect(instance.queryOptions({})).toStrictEqual(expectedV);

				const limit = 5;
				opts.limit = limit;
				expectedV.limit = limit;
				expect(instance.queryOptions(opts)).toStrictEqual(expectedV);

				const limitFloat = 5.7;
				opts.limit = limitFloat;
				expectedV.limit = Math.round(limitFloat);
				expect(instance.queryOptions(opts)).toStrictEqual(expectedV);
			});

			const testSuite = ([0] as any).concat(NAN_VALUES, NEG_NUM_VALUES);
			it.each(testSuite)('should ignore limit = %p, not a number >= 1', (myTest) => {
				const opts = {limit: myTest as any};
				expect(instance.queryOptions(opts)).toStrictEqual(DEFAULT_OPTS);
			});
		});

		describe('store', () => {
			isValidStateRuns((obj) => {
				obj.store();
			});

			it('should add obj to pool', () => {
				expect(instance.state.pool.length).toBe(DEFAULT_STATE.startSize);
				instance.store({} as any);
				expect(instance.state.pool.length).toBe(DEFAULT_STATE.startSize + 1);
			});
		});
	});

	describe('Implementation', () => {
		describe('allocate', () => {
			isValidStateRuns((obj) => {
				obj.allocate();
			});

			it("should return null if pool has no more objects and can't increase", () => {
				instance.clearElements();
				expect(instance.state.autoIncrease).toBe(false);
				instance.state.objectCount = 10;
				expect(instance.state.objectCount).toBe(10);
				expect(instance.state.pool.length).toBe(0);
				expect(instance.allocate()).toBeNull();
			});

			it('should return 1 element from pool if only 1 is available', () => {
				instance.clearElements();
				expect(instance.state.autoIncrease).toBe(false);
				instance.increaseCapacity(1);
				expect(instance.state.objectCount).toBe(1);
				expect(instance.state.pool.length).toBe(1);
				expect(instance.allocate()).not.toBeNull();
				expect(instance.state.pool.length).toBe(0);
			});

			it('should return 1 element from pool if multiple are available', () => {
				expect(instance.state.autoIncrease).toBe(false);
				instance.increaseCapacity(10 - DEFAULT_STATE.startSize);
				expect(instance.state.objectCount).toBe(10);
				expect(instance.state.pool.length).toBe(10);
				expect(instance.allocate()).not.toBeNull();
				expect(instance.state.pool.length).toBe(9);
			});
		});

		describe('allocateMultiple', () => {
			isValidStateRuns((obj) => {
				obj.allocateMultiple();
			});

			let testSuite: any[] = ([50] as any[]).concat(POS_INT_VALUES);
			it.each(testSuite)('should return n elements, %p is an integer > 0', (myTest) => {
				let objs: any[] = [];
				expect(objs.length).toBe(0);

				objs = instance.allocateMultiple(myTest);
				expect(objs.length).toBe(Math.min(myTest, instance.state.objectCount));
				objs.forEach((obj) => {
					instance.release(obj);
				});

				instance.state.autoIncrease = true;
				objs = instance.allocateMultiple(myTest);
				expect(objs.length).toBe(myTest);
			});

			testSuite = ([0] as any[]).concat(FLOAT_VALUES, NAN_VALUES, NEG_INT_VALUES);
			it.each(testSuite)('should return 1 element, %p is not an integer or is < 0', (myTest) => {
				let objs: any[] = [];
				expect(objs.length).toBe(0);

				objs = instance.allocateMultiple(myTest!);
				expect(objs.length).toBe(1);
				objs.forEach((obj) => {
					instance.release(obj);
				});

				instance.state.autoIncrease = true;
				objs = instance.allocateMultiple(myTest!);
				expect(objs.length).toBe(1);
			});
		});

		describe('clearElements', () => {
			it('should not throw if object pool is empty', () => {
				instance.state.pool = [];
				expect(() => {
					instance.clearElements();
				}).not.toThrow();
			});

			it('should remove all elements from op and reset objectCount to 0', () => {
				expect(instance.state.pool).not.toStrictEqual([]);
				expect(instance.state.objectCount).not.toBe(0);

				instance.clearElements();

				expect(instance.state.pool).toStrictEqual([]);
				expect(instance.state.objectCount).toBe(0);
			});

			it('should not change any other state variables', () => {
				const custom = new ADTObjectPool<objectClass>(objectClass);

				custom.state.type = 'test' as any;
				custom.state.autoIncrease = 'test' as any;
				custom.state.maxSize = 'test' as any;
				custom.state.increaseBreakPoint = 'test' as any;
				custom.state.increaseFactor = 'test' as any;

				custom.clearElements();

				expect(custom.state.type).toBe('test');
				expect(custom.state.autoIncrease).toBe('test');
				expect(custom.state.maxSize).toBe('test');
				expect(custom.state.increaseBreakPoint).toBe('test');
				expect(custom.state.increaseFactor).toBe('test');
			});
		});

		describe('increaseCapacity', () => {
			isValidStateRuns((obj) => {
				obj.increaseCapacity();
			});

			const testSuite: any[] = ([0] as any[]).concat(FLOAT_VALUES, NAN_VALUES, NEG_NUM_VALUES);
			it.each(testSuite)('should do nothing, %p is not an integer > 0', (myTest) => {
				expect(instance.state.objectCount).toBe(DEFAULT_STATE.startSize);
				instance.increaseCapacity(myTest!);
				expect(instance.state.objectCount).toBe(DEFAULT_STATE.startSize);
			});

			it('should increase the objectCount by n up to maxSize and create that many new elements', () => {
				let expectedV = DEFAULT_STATE.startSize;
				expect(instance.state.objectCount).toBe(expectedV);
				expect(instance.state.pool.length).toBe(expectedV);

				expectedV += 1;
				instance.increaseCapacity(1);
				expect(instance.state.objectCount).toBe(expectedV);
				expect(instance.state.pool.length).toBe(expectedV);

				expectedV += 10;
				instance.increaseCapacity(10);
				expect(instance.state.objectCount).toBe(expectedV);
				expect(instance.state.pool.length).toBe(expectedV);
			});
		});

		describe('release', () => {
			it('should call cleanObj and store if cleanObj is defined', () => {
				const spy1 = jest.spyOn(instance, 'store');

				const obj = new objectClass();
				const spy2 = jest.spyOn(obj, 'cleanObj');

				spy1.mockClear();
				spy2.mockClear();

				instance.release(obj);

				expect(spy1).toBeCalled();
				expect(spy2).toBeCalled();
			});

			it('should not call store if cleanObj is not defined', () => {
				const custom = new ADTObjectPool<objectClass>(objectClass, {startSize: 0});
				const spy = jest.spyOn(custom, 'store');
				const obj = {};

				spy.mockClear();

				custom.release(obj as objectClass);

				expect(spy).not.toBeCalled();
			});
		});

		describe('releaseMultiple', () => {
			it('should not throw if array is empty', () => {
				expect(instance.state.pool.length).toBe(DEFAULT_STATE.startSize);

				expect(() => {
					instance.releaseMultiple([]);
				}).not.toThrow();

				expect(instance.state.pool.length).toBe(DEFAULT_STATE.startSize);
			});

			it('should release element from array if there is only 1', () => {
				expect(instance.state.pool.length).toBe(instance.state.objectCount);

				const objs = instance.allocateMultiple(1);
				expect(instance.state.pool.length).toBe(instance.state.objectCount - 1);

				instance.releaseMultiple(objs);
				expect(instance.state.pool.length).toBe(instance.state.objectCount);
			});

			it('should release all elements from the array', () => {
				instance.increaseCapacity(10);
				expect(instance.state.pool.length).toBe(instance.state.objectCount);

				const amount = 5;
				const objs = instance.allocateMultiple(amount);
				expect(instance.state.pool.length).toBe(instance.state.objectCount - amount);

				instance.releaseMultiple(objs);
				expect(instance.state.pool.length).toBe(instance.state.objectCount);
			});
		});

		describe('reset', () => {
			it('should not throw if state has errors', () => {
				instance.state.pool = '' as any;
				expect(() => {
					instance.reset();
				}).not.toThrow();
			});

			it('should set objectCount to startSize and initialize that many elements', () => {
				expect(instance.state.pool).not.toStrictEqual([]);
				expect(instance.state.objectCount).not.toBe(0);
				instance.reset();
				expect(instance.state.pool.length).toBe(instance.state.startSize);
				expect(instance.state.objectCount).toBe(instance.state.startSize);
			});

			it('should change state variables to default', () => {
				const custom = new ADTObjectPool<objectClass>(objectClass);

				custom.state.type = 'test' as any;
				custom.state.autoIncrease = 'test' as any;
				custom.state.maxSize = 'test' as any;
				custom.state.increaseBreakPoint = 'test' as any;
				custom.state.increaseFactor = 'test' as any;

				custom.reset();

				expect(custom.state.type).toBe('ObjectPool');
				expect(custom.state.autoIncrease).toBe(false);
				expect(custom.state.maxSize).toBe('test');
				expect(custom.state.increaseBreakPoint).toBe(1);
				expect(custom.state.increaseFactor).toBe(2);
			});
		});

		describe('stringify', () => {
			isValidStateRuns((obj) => {
				obj.stringify();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.stringify()).toBeNull();
			});

			it('should return the state as a string if it is validated', () => {
				const custom = new ADTObjectPool<objectClass>(objectClass);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'ObjectPool',
					pool: [],
					used: [],
					startSize: 1,
					objectCount: 1,
					maxSize: 1000,
					autoIncrease: false,
					increaseFactor: 2,
					increaseBreakPoint: 1,
					instanceArgs: []
				});

				custom.increaseCapacity(1);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'ObjectPool',
					pool: [],
					used: [],
					startSize: 1,
					objectCount: 2,
					maxSize: 1000,
					autoIncrease: false,
					increaseFactor: 2,
					increaseBreakPoint: 1,
					instanceArgs: []
				});

				custom.increaseCapacity(2);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'ObjectPool',
					pool: [],
					used: [],
					startSize: 1,
					objectCount: 4,
					maxSize: 1000,
					autoIncrease: false,
					increaseFactor: 2,
					increaseBreakPoint: 1,
					instanceArgs: []
				});

				custom.increaseCapacity(10);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'ObjectPool',
					pool: [],
					used: [],
					startSize: 1,
					objectCount: 14,
					maxSize: 1000,
					autoIncrease: false,
					increaseFactor: 2,
					increaseBreakPoint: 1,
					instanceArgs: []
				});
			});
		});

		describe('utilization', () => {
			isValidStateRuns((obj) => {
				obj.utilization(0);
			});

			it('should return NaN if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.utilization()).toBeNaN();
			});

			it('should return Infinity, objectCount === 0', () => {
				instance.state.objectCount = 0;
				expect(instance.utilization()).toBe(Infinity);
			});

			const testSuite: any[] = ([0] as any[]).concat(NUM_VALUES, NAN_VALUES);
			it.each(testSuite)('should return a number as a decimal, %p is ', (myTest) => {
				expect(instance.utilization(myTest!)).not.toBeNaN();
			});
		});
	});
});
