import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';

export class ArmorStack<T> implements ArmorCollection<T> {
	public _elements: T[];
	public size: number;
	public _top: number;
	public _bottom: number;

	constructor() {
		this.size = 0;
		this._top = -1;
		this._bottom = 0;
		this._elements = [];
	}

	public select(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

		return selector;
	}

	public clear(): ArmorStack<T> {
		this._elements = [];
		this._bottom = 0;
		this._top = -1;
		this.size = 0;
		return this;
	}

	public push(element: T): ArmorStack<T> {
		this._elements.push(element);
		this._top++;
		this.size++;
		return this;
	}

	public pop(): T | null {
		if (!this.size) {
			return null;
		}

		const result = this._elements[this._top];
		this._top--;
		this.size--;

		return result;
	}

	public top(): T | null {
		if (!this.size) {
			return null;
		}

		return this._elements[this._top];
	}

	public bottom(): T | null {
		if (!this.size) {
			return null;
		}

		return this._elements[this._bottom];
	}


	public reverse(): ArmorStack<T> {
		if (this.size <= 1) {
			return this;
		}

		this._elements = this._elements.reverse();
		return this;
	}
}
