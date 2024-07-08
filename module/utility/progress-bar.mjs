// See https://github.com/foundryvtt/foundryvtt/issues/5692 for the FoundryVTT v9+ solution
// See https://github.com/foundryvtt/foundryvtt/issues/9637 for a possible replacement in v12

/**
 * A progress bar wrapper around the underlying system.
 */
export class HeroProgressBar {
    static #concurrentProgressBarCount = 0;

    /**
     *
     * @param {string} label
     * @param {number} max
     * @param {number} [startCount]
     */
    constructor(label, max, startCount = 0) {
        this._label = label;
        this._max = max;
        this._count = startCount;
        this._inProgress = true;

        // This is very gross reaching in and modifying the CSS while we're using the progress bar.
        document.querySelector("#loading #loading-bar").style.setProperty("white-space", "nowrap");

        const progressBarLabel = document.querySelector("#loading #context").style;
        progressBarLabel.setProperty("text-overflow", "ellipsis");
        progressBarLabel.setProperty("overflow", "hidden");
        progressBarLabel.setProperty("width", "0%");

        if (++HeroProgressBar.#concurrentProgressBarCount > 1) {
            ui.notifications.warn(
                `${HeroProgressBar.#concurrentProgressBarCount} progress bars are fighting for control of the scene navigation`,
            );
        }

        this.advance(this._label, 0);
    }

    toString() {
        return `HeroProgressBar(${HeroProgressBar.#concurrentProgressBarCount}) (label = ${this._label}, count = ${this._count}, max = ${this._max}, inProgress=${this._inProgress})`;
    }

    /**
     * advance the percentage on the progress bar. Yes, you can do a negative count but not sure you want to.
     *
     * @param {string} label
     * @param {number} count
     */
    advance(label = this._label, count = 1) {
        this._count = this._count + count;

        if (this._count < this._max) {
            const percentage = Math.trunc((100 * this._count) / this._max);

            SceneNavigation.displayProgressBar({
                label: label,
                pct: percentage,
            });

            document.querySelector("#loading #context").style.setProperty("width", `calc(100% - 52px)`);
        } else {
            this.close();
        }
    }

    close(label = this._label) {
        if (this._inProgress) {
            this._inProgress = false;
            // Set the percentage to 100 which will cause foundry to fade out the progress bar.
            SceneNavigation.displayProgressBar({ label: label, pct: 100 });

            document.querySelector("#loading #loading-bar").style.removeProperty("white-space");

            const progressBarLabel = document.querySelector("#loading #context").style;
            progressBarLabel.removeProperty("text-overflow");
            progressBarLabel.removeProperty("overflow");
            progressBarLabel.removeProperty("width");

            --HeroProgressBar.#concurrentProgressBarCount;
        } else {
            console.warn(`Progress bar ${this} close called when already closed`);
        }
    }
}
