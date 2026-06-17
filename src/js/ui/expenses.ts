import { state, context, QuickAdd } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { dom } from '../dom.js';

export function formatMoney(amount: number): string {
    return '£' + (typeof amount === 'number' ? amount : parseFloat(amount)).toFixed(2);
}

export function renderPurchases(): void {
    const list = dom.get<HTMLElement>('purchase-list');
    if (!list) return;
    list.innerHTML = '';
    const viewStr = context.viewingDate.toDateString();
    const viewedPurchases = state.purchases.filter(p => new Date(p.date).toDateString() === viewStr).reverse();
    
    if (viewedPurchases.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary)">No purchases on this date.</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    viewedPurchases.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name">${p.category}</span>
                <span class="item-meta">${p.comment || 'No comment'}</span>
            </div>
            <div style="display:flex; align-items:center; gap: 10px;">
                <span class="item-amount">-${formatMoney(p.amount)}</span>
                <button class="btn icon-btn delete" onclick="deletePurchase('${p.id}')"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
}

export function renderQuickAdds(): void {
    const grid = dom.get<HTMLElement>('quick-add-buttons');
    if (!grid) return;
    grid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.quickAdds.forEach(qa => {
        const btn = document.createElement('div');
        btn.className = 'quick-add-item';
        btn.innerHTML = `
            <span class="qa-title">${qa.name}</span>
            <span class="qa-amount">${formatMoney(qa.amount)}</span>
            <button class="qa-delete" onclick="event.stopPropagation(); deleteQuickAdd('${qa.id}')"><i class="ri-close-line"></i></button>
        `;
        btn.onclick = () => window.doQuickAdd(qa);
        fragment.appendChild(btn);
    });
    grid.appendChild(fragment);
}

export function renderGroceries(): void {
    const list = dom.get<HTMLElement>('grocery-list');
    if (!list) return;
    list.innerHTML = '';

    if (!state.groceries) {
        state.groceries = [];
    }

    const sorted = [...state.groceries].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        const priorityVal = { high: 3, medium: 2, low: 1 };
        const valA = priorityVal[a.priority || 'medium'];
        const valB = priorityVal[b.priority || 'medium'];
        return valB - valA;
    });

    const fragment = document.createDocumentFragment();
    sorted.forEach(g => {
        const li = document.createElement('li');
        if (g.checked) li.classList.add('checked');
        
        let unitStr = g.unit ? ` ${g.unit}` : '';
        const qtyStr = g.qty ? `${g.qty}${unitStr} ` : '';
        
        const priorityColors = g.priority === 'high' 
            ? { bg: 'rgba(235, 94, 85, 0.15)', fg: '#eb5e55' } 
            : g.priority === 'low' 
            ? { bg: 'rgba(74, 201, 151, 0.15)', fg: '#4ac997' } 
            : { bg: 'rgba(244, 208, 111, 0.15)', fg: '#f4d06f' };

        const priorityBadge = `
            <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; font-weight: 600; text-transform: uppercase; margin-right: 8px; background: ${priorityColors.bg}; color: ${priorityColors.fg}; display: inline-block; vertical-align: middle;">
                ${g.priority || 'medium'}
            </span>
        `;

        const effectiveUnitPrice = g.price || (g.totalPrice ? g.totalPrice / g.qty : 0);
        const effectiveTotalPrice = g.totalPrice || (g.price ? g.price * g.qty : 0);

        const priceText = effectiveUnitPrice > 0 
            ? `<span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 10px; font-weight: 500;">(${formatMoney(effectiveUnitPrice)}${g.qty > 1 ? ` x ${g.qty} = ${formatMoney(effectiveTotalPrice)}` : ''})</span>` 
            : '';

        li.innerHTML = `
            <span class="item-name" style="display: flex; align-items: center; flex: 1;">
                ${priorityBadge}
                <span>${qtyStr}${g.name}</span>
                ${priceText}
            </span>
            <div style="display:flex; align-items:center; gap: 10px;">
                <button class="btn icon-btn delete" onclick="event.stopPropagation(); deleteGrocery('${g.id}')"><i class="ri-close-line"></i></button>
            </div>
        `;
        li.onclick = () => window.toggleGrocery(g.id);
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
}

// Global scope bindings for inline HTML handlers
window.doQuickAdd = (qa: QuickAdd): void => {
    state.purchases.push({
        id: Date.now().toString(),
        amount: qa.amount,
        category: qa.name,
        comment: 'Quick Add',
        date: context.viewingDate.toISOString() 
    });
    sounds.success();
    syncState();
};

window.deleteQuickAdd = (id: string): void => {
    state.quickAdds = state.quickAdds.filter(q => q.id !== id);
    sounds.delete();
    syncState();
};

window.deletePurchase = (id: string): void => {
    state.purchases = state.purchases.filter(p => p.id !== id);
    sounds.delete();
    syncState();
};

window.deleteGrocery = (id: string): void => {
    if (!state.groceries) {
        state.groceries = [];
    }
    state.groceries = state.groceries.filter(g => g.id !== id);
    sounds.delete();
    syncState();
};

window.toggleGrocery = (id: string): void => {
    if (!state.groceries) {
        state.groceries = [];
    }
    const item = state.groceries.find(g => g.id === id);
    if (item) {
        const wasChecked = item.checked;
        item.checked = !item.checked;
        
        if (!wasChecked && item.checked) {
            // Just checked it off: if it has a price, log it as a purchase
            const totalCost = item.totalPrice || (item.price ? item.price * (item.qty || 1) : 0);
            if (totalCost > 0) {
                const unitStr = item.unit ? ` ${item.unit}` : '';
                const commentStr = `${item.qty ? item.qty + unitStr + ' ' : ''}${item.name} (from Grocery List)`;
                
                state.purchases.push({
                    id: Date.now().toString(),
                    amount: totalCost,
                    category: 'Groceries',
                    comment: commentStr,
                    date: context.viewingDate.toISOString()
                });
                sounds.success();
            } else {
                sounds.click();
            }
        } else {
            sounds.click();
        }
        syncState();
    }
};

window.clearCheckedGroceries = (): void => {
    if (!state.groceries) {
        state.groceries = [];
    }
    state.groceries = state.groceries.filter(g => !g.checked);
    sounds.delete();
    syncState();
};

export function renderSavings(): void {
    const el = dom.get<HTMLElement>('savings-balance');
    if (el) {
        el.textContent = formatMoney(state.savingsBalance || 0);
    }
}
