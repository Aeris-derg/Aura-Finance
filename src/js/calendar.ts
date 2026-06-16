import { state, context } from './state.js';
import { sounds } from './audio.js';
import { formatMoney, updateUI } from './ui/index.js';
import { getDailyPurchases, getDailyIncomes } from './budget.js';
import { dom } from './dom.js';

export function updateCalendar(): void {
    const monthDisplay = dom.get<HTMLElement>('cal-month-display');
    const grid = dom.get<HTMLElement>('calendar-grid');
    if (!monthDisplay || !grid) return;

    const year = context.calendarViewingDate.getFullYear();
    const month = context.calendarViewingDate.getMonth();
    
    monthDisplay.textContent = context.calendarViewingDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const headers = grid.querySelectorAll('.cal-day-header');
    
    // Create a DocumentFragment to compile cells in memory
    const fragment = document.createDocumentFragment();
    headers.forEach(h => fragment.appendChild(h));

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-cell empty';
        fragment.appendChild(emptyCell);
    }

    const todayDateStr = context.viewingDate.toDateString();

    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        
        if (cellDate.toDateString() === todayDateStr) {
            cell.classList.add('selected');
        }

        // Optimized O(1) Daily lookups
        const dayPurchases = getDailyPurchases(cellDate).filter(p => !(p.category === 'Savings' && (p.comment || '').startsWith('Savings Spend:')));
        const dayTotal = dayPurchases.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
        
        const dayIncomes = getDailyIncomes(cellDate).filter(inc => !(inc.note || '').startsWith('Savings Withdrawal'));
        const dayIncomeTotal = dayIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0);

        if (dayTotal > 0) cell.classList.add('has-spending');
        if (dayIncomeTotal > 0) cell.classList.add('has-income');

        const spendLine = dayTotal > 0 ? `<div class="cal-amount spent">-${formatMoney(dayTotal)}</div>` : '';
        const incomeLine = dayIncomeTotal > 0 ? `<div class="cal-amount income">+${formatMoney(dayIncomeTotal)}</div>` : '';

        cell.innerHTML = `
            <div class="cal-date">${day}</div>
            ${spendLine}${incomeLine}
        `;

        cell.onclick = () => {
            context.viewingDate = new Date(year, month, day);
            sounds.click();
            updateUI();
        };

        fragment.appendChild(cell);
    }

    // Single DOM update for the entire calendar grid
    grid.innerHTML = '';
    grid.appendChild(fragment);
}
