import { state, context } from './state.js';
import { getPurchasesForPeriod } from './budget.js';

export function hexToRgbA(hex: string, alpha: number): string {
    let c: string[];
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        const hexVal = '0x' + c.join('');
        const num = parseInt(hexVal);
        return 'rgba(' + [(num >> 16) & 255, (num >> 8) & 255, num & 255].join(',') + ',' + alpha + ')';
    }
    return `rgba(16, 185, 129, ${alpha})`;
}

export function updateChart(): void {
    const ctx = document.getElementById('category-chart') as HTMLCanvasElement | null;
    if (!ctx) return;

    const periodPurchases = getPurchasesForPeriod(context.viewingDate);
    const categoryTotals: Record<string, number> = {};
    periodPurchases.forEach(p => {
        if (!categoryTotals[p.category]) categoryTotals[p.category] = 0;
        categoryTotals[p.category] += parseFloat(p.amount.toString());
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    
    const baseColor = state.themeColor || '#b5eadd';
    const bgColors = labels.map((_, i) => hexToRgbA(baseColor, Math.max(0.3, 1 - (i * 0.15))));
    const borderColors = labels.map(() => state.isDarkMode ? '#0f172a' : '#ffffff');
    const textColor = state.isDarkMode ? '#f8fafc' : '#374151';

    if (context.pieChartInstance) {
        context.pieChartInstance.data.labels = labels;
        context.pieChartInstance.data.datasets[0].data = data;
        context.pieChartInstance.data.datasets[0].backgroundColor = bgColors;
        context.pieChartInstance.data.datasets[0].borderColor = borderColors;
        context.pieChartInstance.options.plugins.legend.labels.color = textColor;
        context.pieChartInstance.update();
    } else {
        context.pieChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: textColor, font: { family: 'Outfit' } }
                    }
                }
            }
        });
    }
}
