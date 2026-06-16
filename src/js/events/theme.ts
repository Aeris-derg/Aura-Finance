import { state } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { applyTheme } from '../ui/index.js';
import { dom } from '../dom.js';

export function initThemeEvents(): void {
    // Theme Toggle
    const darkModeToggle = dom.get<HTMLElement>('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            state.isDarkMode = !state.isDarkMode;
            sounds.click();
            syncState();
        });
    }

    // Theme Picker
    const themePicker = dom.get<HTMLInputElement>('theme-color-picker');
    if (themePicker) {
        themePicker.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            applyTheme(target.value);
        });
        themePicker.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            state.themeColor = target.value;
            syncState();
        });
    }
}
