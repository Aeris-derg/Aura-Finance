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

    const fragment = document.createDocumentFragment();
    state.groceries.forEach(g => {
        const li = document.createElement('li');
        if (g.checked) li.classList.add('checked');
        
        let unitStr = g.unit ? ` ${g.unit}` : '';
        const qtyStr = g.qty ? `${g.qty}${unitStr} ` : '';
        
        li.innerHTML = `
            <span class="item-name">${qtyStr}${g.name}</span>
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
    state.groceries = state.groceries.filter(g => g.id !== id);
    sounds.delete();
    syncState();
};

window.toggleGrocery = (id: string): void => {
    const item = state.groceries.find(g => g.id === id);
    if (item) {
        item.checked = !item.checked;
        sounds.click();
        syncState();
    }
};
