import { updateChart } from '../chart.js';
import { dom } from '../dom.js';

export function applyTheme(color: string): void {
    document.documentElement.style.setProperty('--theme-color', color);
    const picker = dom.get<HTMLInputElement>('theme-color-picker');
    if (picker) {
        picker.value = color;
    }
    updateChart();
}

export function applyDarkMode(isDark: boolean): void {
    const toggle = dom.get<HTMLElement>('dark-mode-toggle');
    if (isDark) {
        document.body.classList.add('dark-theme');
        if (toggle) toggle.innerHTML = '<i class="ri-sun-line"></i>';
    } else {
        document.body.classList.remove('dark-theme');
        if (toggle) toggle.innerHTML = '<i class="ri-moon-line"></i>';
    }
    updateChart();
}
