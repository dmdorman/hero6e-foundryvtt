/**
 * Stage timing for HDC uploads. Each mark closes out the previous label, so a
 * mark's duration covers the work done while that label was current.
 */
export class UploadPerformance {
    #start = performance.now();
    #last = this.#start;
    #currentLabel;

    marks = [];
    counts = {};

    constructor(initialLabel) {
        this.#currentLabel = initialLabel;
    }

    mark(nextLabel) {
        const now = performance.now();
        if (this.#currentLabel !== undefined) {
            this.marks.push({ label: this.#currentLabel, ms: now - this.#last });
        }
        this.#currentLabel = nextLabel;
        this.#last = now;
    }

    count(key, value) {
        this.counts[key] = value;
    }

    // Live clock, not frozen at the last mark; sum marks for a settled total.
    get totalMs() {
        return performance.now() - this.#start;
    }

    slowMarks(thresholdMs = 500) {
        return this.marks.filter((mark) => mark.ms >= thresholdMs).sort((a, b) => b.ms - a.ms);
    }

    table() {
        return this.marks.map((mark) => ({ label: mark.label, ms: Math.round(mark.ms) }));
    }
}
