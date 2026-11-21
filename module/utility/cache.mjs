/**
 * A simple in memory cache using objects.
 */
export class HeroSystemGenericSharedCache {
    static _cache = {};

    /**
     *
     * @param {string} purpose
     * @returns {HeroSystemGenericSharedCache}
     */
    static create(purpose) {
        if (HeroSystemGenericSharedCache._cache[purpose]) {
            throw Error(`Trying to create a new cache for existing purpose ${purpose}`);
        }

        HeroSystemGenericSharedCache._cache[purpose] = new HeroSystemGenericSharedCache(purpose);
        return HeroSystemGenericSharedCache._cache[purpose];
    }

    _cachedValue = {};

    // Some simplified cache performance metrics. Move into per id if you want to develop finer grained metrics.
    #gets = 0;
    #sets = 0;
    #invalidated = 0;

    #purpose;

    constructor(purpose) {
        this.#purpose = purpose;
    }

    /**
     * Purpose this cache was created for. Read it when debugging cache contents.
     *
     * @returns {string}
     */
    get purpose() {
        return this.#purpose;
    }

    setCachedValue(id, newValue) {
        this.#sets = this.#sets + 1;
        this._cachedValue[id] = newValue;
    }

    getCachedValue(id) {
        this.#gets = this.#gets + 1;
        return this._cachedValue[id];
    }

    invalidateCachedValue(id) {
        this._cachedValue[id] = null;
        this.#invalidated = this.#invalidated + 1;
    }
}

function getPropertyDescriptorUpChain(obj, propName) {
    let current = obj;
    while (current != null) {
        const descriptor = Reflect.getOwnPropertyDescriptor(current, propName);
        if (descriptor) {
            return descriptor; // Found the descriptor
        }

        // Move up the prototype chain
        current = Reflect.getPrototypeOf(current);
    }

    return undefined;
}

let cachedObjectCachingSetting = null;
function objectCachingEnabled() {
    if (cachedObjectCachingSetting == null) {
        cachedObjectCachingSetting = game.settings.get(game.system.id, "ObjectCaching");
    }

    return cachedObjectCachingSetting;
}

/**
 * Add object caching functionality to this Base class.
 *
 * `T` must be a constructor type, because that is what keeps the base class's instance members and
 * static members on the returned class. A `*` or `Function` parameter erases both, so every read of an
 * inherited member, for example a static `create`, then fails. The return type comes from inference.
 * Restating it by hand would drop the members this mixin adds.
 *
 * @template {abstract new (...args: any) => any} T
 * @param {T} Base
 */
export const HeroObjectCacheMixin = (Base) =>
    class HeroObjectCache extends Base {
        prepareDerivedData() {
            super.prepareDerivedData();

            // NOTE: Can't define and initialize as an object element as the flows sometimes have prepareDerivedData being called before property initialization
            this._cache ??= {};

            // Clean out any memoized information about this object
            this.invalidateAllComposedObjectFunctions();
        }

        /**
         * NOTE: cmofs -> composed memoizable object functions
         * NOTE: cmofd -> composed memoizable object function data
         *
         * @param {*} funcName
         * @param {*} originalFunc
         */
        _generateMemoizableObjectComposerFunction(funcName, originalFunc) {
            return function (...args) {
                const joinedArgs = JSON.stringify(args);
                const cachedInfo = foundry.utils.getProperty(this._cache, `cmofd.${funcName}.${joinedArgs}`);
                if (cachedInfo && Object.hasOwn(cachedInfo, "retValue")) {
                    foundry.utils.setProperty(
                        this._cache,
                        `cmofd.${funcName}.${joinedArgs}.cacheHits`,
                        cachedInfo.cacheHits + 1,
                    );
                    return cachedInfo.retValue;
                }

                const callStartTime = Date.now();
                const retValue = originalFunc.call(this, ...args);
                const callEndTime = Date.now();

                foundry.utils.setProperty(this._cache, `cmofd.${funcName}.${joinedArgs}`, {
                    retValue,
                    cacheHits: 0,
                    time: callEndTime - callStartTime,
                });

                return retValue;
            };
        }

        /**
         * Make the return value of this[funcName] based on the call's arguments be cached. Also track interesting statistics about
         * caching.
         *
         * NOTE: This will be ignored when called on a non database object because invalidation of the cache relies on calling update()
         *       on objects. Right now we generally only have effective items and already temporary things related to the actor sheet.
         *
         * @param {String} funcName
         */
        composeMemoizableObjectFunction(funcName) {
            // Is object caching enabled?
            if (!objectCachingEnabled()) {
                return;
            }

            // Is this a temporary object or is this a data model of an object? If so, do not compose it since our prepareDerivedData
            // function invoked when data changes.
            if (this._id == null && this.parent?._id == null) {
                return;
            }

            // If we have already composed this function, don't compose again
            if (foundry.utils.getProperty(this._cache, `cmofs.${funcName}`)) {
                return;
            }

            // Start composing/wrapping this object
            const descriptor = foundry.utils.deepClone(
                getPropertyDescriptorUpChain(this.constructor.prototype, funcName),
            );
            const originalFunc = descriptor.value ?? descriptor.get;
            foundry.utils.setProperty(this._cache, `cmofs.${funcName}.origFunc`, originalFunc);
            foundry.utils.setProperty(this._cache, `cmofd.${funcName}`, {});

            // Memoize the existing function or getter using a composing/wrapping function
            if (descriptor.value) {
                descriptor.value = this._generateMemoizableObjectComposerFunction(funcName, originalFunc);
            } else if (descriptor.get || descriptor.set) {
                descriptor.get = this._generateMemoizableObjectComposerFunction(funcName, originalFunc);
            } else {
                console.error(
                    `Asked to composeObjectFunction for ${funcName} that is not a function or getter - are you sure?`,
                    descriptor,
                );
            }

            // Replace the function with the composable function
            Object.defineProperty(this, funcName, descriptor);
        }

        /**
         * Reset all the memoized information about the funcName but continue to keep it composed.
         *
         * @param {String} funcName
         */
        invalidateComposedMemoizableObjectFunction(funcName) {
            foundry.utils.deleteProperty(this._cache, `cmofd.${funcName}`);
        }

        /**
         * Reset all the memoized information for this object but continue to keep any functions composed.
         */
        invalidateAllComposedObjectFunctions() {
            foundry.utils.deleteProperty(this._cache, `cmofd`);
        }

        /**
         * Restore the original function so that it is no longer memoized.
         *
         * @param {String} funcName
         */
        restoreComposedMemoizableObjectFunction(funcName) {
            const originalFunc = foundry.utils.getProperty(this._cache, `cmofs.${funcName}.origFunc`);
            if (originalFunc) {
                const descriptor = foundry.utils.deepClone(
                    getPropertyDescriptorUpChain(this.constructor.prototype, funcName),
                );
                if (descriptor.value) {
                    descriptor.value = originalFunc;
                } else if (descriptor.get) {
                    descriptor.get = originalFunc;
                }

                Object.defineProperty(this, funcName, descriptor);
            }

            foundry.utils.deleteProperty(this._cache, `cmofs.${funcName}`);
            foundry.utils.deleteProperty(this._cache, `cmofd.${funcName}`);
        }

        /**
         * Restore all function on this object that were memoized to their original function.
         */
        restoreAllComposedObjectFunctions() {
            for (const funcName of Object.keys(this._cache.cmofs || {})) {
                this.restoreComposedMemoizableObjectFunction(funcName);
            }

            foundry.utils.deleteProperty(this._cache, `cmofd`);
        }
    };

export function printObjectCacheInfo(obj) {
    let composedFunctionCount = 0;
    let smallestCacheTimeSaving = +Infinity;
    let largestCacheTimeSaving = 0;
    let smallestNumberOfCacheHits = +Infinity;
    let largestNumberOfCacheHits = 0;

    for (const funcName of Object.keys(obj._cache?.cmofd || {})) {
        composedFunctionCount++;

        for (const funcArgs of Object.keys(obj._cache.cmofd[funcName])) {
            const data = obj._cache.cmofd[funcName][funcArgs];

            if (data.time < smallestCacheTimeSaving) {
                smallestCacheTimeSaving = data.time;
            }
            if (data.time > largestCacheTimeSaving) {
                largestCacheTimeSaving = data.time;
            }

            if (data.cacheHits < smallestNumberOfCacheHits) {
                smallestNumberOfCacheHits = data.cacheHits;
            }
            if (data.cacheHits > largestNumberOfCacheHits) {
                largestNumberOfCacheHits = data.cacheHits;
            }
        }
    }

    console.log(`${obj.name} has ${composedFunctionCount} composed objects`);
    console.log(`Time savings`);
    console.log(`smallest: ${smallestCacheTimeSaving}ms largest: ${largestCacheTimeSaving}ms`);
    console.log(`Number of cache hits`);
    console.log(`smallest: ${smallestNumberOfCacheHits} largest: ${largestNumberOfCacheHits}`);
}
window.printObjectCacheInfo = printObjectCacheInfo;
