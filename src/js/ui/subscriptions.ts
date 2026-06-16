import { state, context } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { getPayPeriodBounds } from '../budget.js';
import { formatMoney } from './expenses.js';
import { dom } from '../dom.js';

export function renderSubscriptions(): void {
    const list = dom.get<HTMLElement>('subscription-list');
    if (!list) return;
    list.innerHTML = '';
    
    const subs = state.subscriptions || [];
    const totalCostEl = dom.get<HTMLElement>('sub-total-cost');
    
    if (subs.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary); font-size: 0.85rem; padding: 6px;">No active subscriptions.</li>';
        if (totalCostEl) totalCostEl.textContent = formatMoney(0);
        return;
    }
    
    let totalCost = 0;
    const fragment = document.createDocumentFragment();
    subs.forEach(s => {
        totalCost += (s.amount || 0);
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name" style="font-size: 0.95rem;">${s.name}</span>
                <span class="item-meta" style="font-size: 0.8rem;">Billed on day ${s.billingDay} of month</span>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                <span class="item-amount negative" style="font-size: 0.95rem;">-${formatMoney(s.amount)}</span>
                <button class="btn icon-btn delete" style="padding: 4px;" onclick="deleteSubscription('${s.id}')" title="Delete"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
    
    if (totalCostEl) totalCostEl.textContent = formatMoney(totalCost);
}

export function checkAndApplySubscriptions(): void {
    if (!state.subscriptions || !context.currentGroupId) return;
    
    let needsSync = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limitDate = new Date(Math.max(today.getTime(), context.calendarViewingDate.getTime()));
    limitDate.setHours(23, 59, 59, 999);

    state.subscriptions.forEach(sub => {
        const createdTime = parseInt(sub.id);
        const createdDate = isNaN(createdTime) ? new Date() : new Date(createdTime);
        createdDate.setHours(0, 0, 0, 0);

        let currentPeriodDate = new Date(createdDate);

        // Loop through pay periods starting from when the subscription was created up to the limit date
        while (true) {
            const bounds = getPayPeriodBounds(currentPeriodDate);
            const start = bounds.startDate;
            const end = bounds.endDate;
            
            const billDate = new Date(start.getFullYear(), start.getMonth(), sub.billingDay);
            billDate.setHours(0, 0, 0, 0);
            
            if (billDate.getTime() < start.getTime()) {
                billDate.setMonth(billDate.getMonth() + 1);
            }
            
            // Log purchase if the billing day has occurred, is not before creation, and is within the limit date
            if (billDate.getTime() >= createdDate.getTime() && billDate.getTime() <= limitDate.getTime()) {
                const alreadyLogged = (state.purchases || []).some(p => {
                    const pDate = new Date(p.date);
                    pDate.setHours(0, 0, 0, 0);
                    return p.subscriptionId === sub.id && pDate.getTime() === billDate.getTime();
                });
                
                if (!alreadyLogged) {
                    if (!state.purchases) state.purchases = [];
                    state.purchases.push({
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                        amount: parseFloat(sub.amount.toString()),
                        category: 'Bills',
                        comment: `[Subscription] ${sub.name}`,
                        date: billDate.toISOString(),
                        subscriptionId: sub.id
                    });
                    needsSync = true;
                }
            }

            // Move to the next pay period
            const nextPeriodDate = new Date(end.getTime() + 5 * 24 * 60 * 60 * 1000);
            if (nextPeriodDate > limitDate && getPayPeriodBounds(nextPeriodDate).startDate > limitDate) {
                break;
            }
            currentPeriodDate = nextPeriodDate;
        }
    });
    
    if (needsSync) {
        syncState();
    }
}

// Global scope bindings for inline HTML handlers
window.deleteSubscription = (id: string): void => {
    state.subscriptions = (state.subscriptions || []).filter(s => s.id !== id);
    sounds.delete();
    syncState();
};
