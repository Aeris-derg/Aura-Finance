class DOMRegistry {
    private cache: Record<string, HTMLElement | null> = {};

    /**
     * Get an element by its ID. Lazily queries the DOM on first access and caches the result.
     */
    get<T extends HTMLElement>(id: string): T | null {
        if (!(id in this.cache)) {
            this.cache[id] = document.getElementById(id);
        }
        return this.cache[id] as T | null;
    }

    /**
     * Clear cache for testing or dynamic elements re-fetching if needed.
     */
    clear(): void {
        this.cache = {};
    }
}

export const dom = new DOMRegistry();
export default dom;
