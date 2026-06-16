import { state, context } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { getPayPeriodBounds } from '../budget.js';
import { formatMoney } from './expenses.js';
import { dom } from '../dom.js';

export function renderIncomes(): void {
    const list = dom.get<HTMLElement>('income-list');
    if (!list) return;
    list.innerHTML = '';
    const viewStr = context.viewingDate.toDateString();
    const viewedIncomes = (state.incomes || []).filter(inc => new Date(inc.date).toDateString() === viewStr).reverse();

    if (viewedIncomes.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary)">No income logged on this date.</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    viewedIncomes.forEach(inc => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name">${inc.note || 'Income'}</span>
            </div>
            <div style="display:flex; align-items:center; gap: 10px;">
                <span class="item-amount income">+${formatMoney(inc.amount)}</span>
                <button class="btn icon-btn delete" onclick="deleteIncome('${inc.id}')"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
}

export function renderTopUps(): void {
    const list = dom.get<HTMLElement>('topup-list');
    if (!list) return;
    list.innerHTML = '';
    const bounds = getPayPeriodBounds(context.viewingDate);
    const periodTopUps = (state.budgetTopUps || []).filter(t => {
        const tDate = new Date(t.date);
        return tDate >= bounds.startDate && tDate < bounds.endDate;
    }).reverse();

    if (periodTopUps.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary); font-size: 0.85rem; padding: 6px;">No top-ups in this period.</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    periodTopUps.forEach(t => {
        const li = document.createElement('li');
        li.style.padding = '8px 12px';
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name" style="font-size: 0.9rem;">${t.note}</span>
                <span class="item-meta" style="font-size: 0.75rem;">${new Date(t.date).toLocaleDateString()}</span>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                <span class="item-amount" style="color: var(--success-color); font-size: 0.9rem;">+${formatMoney(t.amount)}</span>
                <button class="btn icon-btn delete" style="padding: 4px;" onclick="deleteTopUp('${t.id}')"><i class="ri-close-line"></i></button>
            </div>
        `;
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
}

// Global scope bindings for inline HTML handlers
window.deleteIncome = (id: string): void => {
    state.incomes = (state.incomes || []).filter(inc => inc.id !== id);
    sounds.delete();
    syncState();
};

window.deleteTopUp = (id: string): void => {
    state.budgetTopUps = (state.budgetTopUps || []).filter(t => t.id !== id);
    sounds.delete();
    syncState();
};
