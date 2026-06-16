import { switchTab } from '../ui/index.js';

export function initNavigationEvents(): void {
    // Attach app tab button listeners
    document.querySelectorAll('.app-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement | null;
            if (target) {
                const tab = target.getAttribute('data-tab');
                if (tab) switchTab(tab);
            }
        });
    });
}
