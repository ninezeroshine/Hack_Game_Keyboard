/** Reusable object pool — avoids GC spikes from frequent virus spawn/destroy */
export class ObjectPool {
    constructor(factory, reset, initialSize = 20) {
        this._factory = factory;
        this._reset = reset;
        this._pool = [];
        for (let i = 0; i < initialSize; i++) {
            this._pool.push(factory());
        }
    }

    acquire() {
        const obj = this._pool.length > 0 ? this._pool.pop() : this._factory();
        return obj;
    }

    release(obj) {
        this._reset(obj);
        this._pool.push(obj);
    }

    get available() {
        return this._pool.length;
    }
}
