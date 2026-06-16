import { state, context } from '../state.js';
import { sounds } from '../audio.js';
import { db, syncState } from '../db.js';
import { formatMoney } from './expenses.js';
import { dom } from '../dom.js';

export function renderDebts(): void {
    const list = dom.get<HTMLElement>('debt-list');
    if (!list) return;
    list.innerHTML = '';
    const activeDebts = (state.debts || []).filter(d => d.status === 'outstanding').reverse();

    if (activeDebts.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary); font-size: 0.85rem; padding: 6px;">No active debts.</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    activeDebts.forEach(d => {
        const li = document.createElement('li');
        const isOwedByMe = d.type === 'owed_by_me';
        const colorClass = isOwedByMe ? 'negative' : 'positive';
        const typeLabel = isOwedByMe ? `You owe ${d.person}` : `${d.person} owes you`;
        
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name" style="font-size: 0.95rem;">${typeLabel}</span>
                <span class="item-meta" style="font-size: 0.8rem;">${d.note} (${new Date(d.date).toLocaleDateString()})</span>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                <span class="item-amount ${colorClass}" style="font-size: 0.95rem;">
                    ${isOwedByMe ? '-' : '+'}${formatMoney(d.amount)}
                </span>
                <button class="btn icon-btn" style="padding: 4px; color: var(--success-color);" onclick="settleDebt('${d.id}')" title="Settle"><i class="ri-checkbox-circle-line"></i></button>
                <button class="btn icon-btn delete" style="padding: 4px;" onclick="deleteDebt('${d.id}')" title="Delete"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
}

// Global scope bindings for inline HTML handlers
window.settleDebt = (id: string): void => {
    const debt = (state.debts || []).find(d => d.id === id);
    if (!debt) return;

    if (debt.linkedGroupId) {
        db.ref('groups/' + debt.linkedGroupId).transaction((groupData: any) => {
            if (!groupData) return groupData;
            
            if (groupData.debts) {
                const targetDebt = groupData.debts.find((d: any) => d.id === id);
                if (targetDebt) {
                    targetDebt.status = 'settled';
                }
            }
            
            if (debt.type === 'owed_by_me') {
                if (!groupData.incomes) groupData.incomes = [];
                groupData.incomes.push({
                    id: Date.now().toString() + '-target-settle-in',
                    amount: debt.amount,
                    category: 'Debt',
                    comment: `[Debt Repayment Received] from Group: ${context.currentGroupId}`,
                    date: context.viewingDate.toISOString()
                });
            } else if (debt.type === 'owed_to_me') {
                if (!groupData.purchases) groupData.purchases = [];
                groupData.purchases.push({
                    id: Date.now().toString() + '-target-settle-out',
                    amount: debt.amount,
                    category: 'Debt',
                    comment: `[Debt Repaid] to Group: ${context.currentGroupId}`,
                    date: context.viewingDate.toISOString()
                });
            }
            
            return groupData;
        }, (error: Error | null, committed: boolean) => {
            if (error) {
                console.error("Linked settle transaction failed:", error);
                alert("Failed to settle linked debt on target group: " + error.message);
            } else if (committed) {
                if (debt.type === 'owed_to_me') {
                    if (!state.incomes) state.incomes = [];
                    state.incomes.push({
                        id: Date.now().toString() + '-local-settle-in',
                        amount: debt.amount,
                        note: `[Debt Repayment Received] from Group: ${debt.linkedGroupId}`,
                        date: context.viewingDate.toISOString()
                    });
                } else if (debt.type === 'owed_by_me') {
                    if (!state.purchases) state.purchases = [];
                    state.purchases.push({
                        id: Date.now().toString() + '-local-settle-out',
                        amount: debt.amount,
                        category: 'Debt',
                        comment: `[Debt Repaid] to Group: ${debt.linkedGroupId}`,
                        date: context.viewingDate.toISOString()
                    });
                }
                
                debt.status = 'settled';
                sounds.success();
                syncState();
            }
        });
    } else {
        let logToBudget = false;
        if (debt.type === 'owed_by_me') {
            logToBudget = confirm(`Do you want to log settling this debt of ${formatMoney(debt.amount)} to ${debt.person} as an Expense (Purchase) in your budget?`);
        } else {
            logToBudget = confirm(`Do you want to log receiving ${formatMoney(debt.amount)} from ${debt.person} as Income in your budget?`);
        }

        if (logToBudget) {
            if (debt.type === 'owed_by_me') {
                state.purchases.push({
                    id: Date.now().toString(),
                    amount: debt.amount,
                    category: 'Bills',
                    comment: `Settle debt to ${debt.person}: ${debt.note}`,
                    date: context.viewingDate.toISOString()
                });
            } else {
                if (!state.incomes) state.incomes = [];
                state.incomes.push({
                    id: Date.now().toString(),
                    amount: debt.amount,
                    note: `Settle loan to ${debt.person}: ${debt.note}`,
                    date: context.viewingDate.toISOString()
                });
            }
        }

        debt.status = 'settled';
        sounds.success();
        syncState();
    }
};

window.deleteDebt = (id: string): void => {
    state.debts = (state.debts || []).filter(d => d.id !== id);
    sounds.delete();
    syncState();
};
