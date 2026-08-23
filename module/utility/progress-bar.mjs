/**
 * A v13 based progress bar wrapper around the underlying system.
 */
class HeroProgressBarV13 {
    static #concurrentProgressBarCount = 0;

    /**
     * @param {string} message
     * @param {number} max
     * @param {number} [startCount]
     */
    constructor(message, max, { startCount = 0, suppressUi = false } = {}) {
        this._message = message;
        this._max = max;
        this._count = startCount;
        this._inProgress = true;
        this._suppressUi = suppressUi;
        this._progressBar = suppressUi
            ? null
            : ui.notifications.info(message, {
                  progress: !suppressUi,
                  console: !!CONFIG.debug.HERO?.ui?.progress, // PH: FIXME: Remove the separate console.debug perhaps
              });
        this._performance = [];
        this._performance.push({ timestamp: Date.now(), message: "constructor", pct: 0 });

        if (++HeroProgressBarV13.#concurrentProgressBarCount > 1) {
            ui.notifications.warn(
                `${Date.now()} ${this}: progress bars are fighting for control of the scene navigation`,
            );
        }

        this.advance(this._message, 0);

        if (CONFIG.debug.HERO?.ui?.progress) {
            console.debug(
                `${Date.now()} ${this}: creating progress bar with label "${message}", max ${max}, startCount ${startCount}`,
            );
        }
    }

    toString() {
        return `HeroProgressBarV13(${HeroProgressBarV13.#concurrentProgressBarCount}) (label = ${this._message}, count = ${this._count}, max = ${this._max}, inProgress=${this._inProgress})`;
    }

    /**
     * Advance the percentage on the progress bar. Yes, you can do a negative count but not sure you want to.
     *
     * @param {string} message
     * @param {number} count
     */
    advance(message = this._message, count = 1) {
        this._count = this._count + count;

        if (this._count > this._max) {
            console.log(`${this}:: Count > Max - clamping at max`);
            this._count = this._max;
        } else if (this._count < 0) {
            console.error(`${this}: Count < 0 - clamping at 0`);
            this._count = 0;
        }

        const percentage = this._count / this._max;

        this._progressBar?.update({ pct: percentage, message: this._suppressUi ? null : message });
        this._performance.at(-1).delta = Date.now() - this._performance.at(-1).timestamp;
        this._performance.push({ timestamp: Date.now(), message: message, pct: percentage });

        if (CONFIG.debug.HERO?.ui?.progress) {
            console.debug(`${Date.now()} ${this}: ${percentage * 100}% (${this._count}/${this._max}) ${message}`);
        }
    }

    /**
     * Display a final message and terminate the progress bar.
     *
     * @param {string} message
     */
    close(message = this._message) {
        if (this._inProgress) {
            this._inProgress = false;

            // Set to 100% which will cause Foundry to fade out the progress bar.
            this._progressBar?.update({ pct: 1, message: this._suppressUi ? null : message });
            this._performance.push({ timestamp: Date.now(), message: "close", pct: 1 });

            --HeroProgressBarV13.#concurrentProgressBarCount;

            if (CONFIG.debug.HERO?.ui?.progress) {
                console.debug(`${Date.now()} ${this}: closing`);
            }
        } else {
            console.warn(`${Date.now()} ${this}: close called when already closed`);
        }
    }
}

export const HeroProgressBar = HeroProgressBarV13;
