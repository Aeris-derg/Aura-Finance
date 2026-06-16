import { state, context } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { dom } from '../dom.js';

export function initExpensesEvents(): void {
    // Purchase Category Change
    const purchaseCategory = dom.get<HTMLSelectElement>('purchase-category');
    if (purchaseCategory) {
        purchaseCategory.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const customGroup = dom.get<HTMLElement>('custom-category-group');
            const customInput = dom.get<HTMLInputElement>('custom-category-input');
            if (!customGroup) return;
            
            if (target.value === 'custom') {
                customGroup.classList.remove('hidden');
                if (customInput) customInput.required = true;
            } else {
                customGroup.classList.add('hidden');
                if (customInput) customInput.required = false;
            }
        });
    }

    // Purchase Form Submit
    const purchaseForm = dom.get<HTMLFormElement>('purchase-form');
    if (purchaseForm) {
        purchaseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amtInput = dom.get<HTMLInputElement>('purchase-amount');
            const catSelect = dom.get<HTMLSelectElement>('purchase-category');
            const customInput = dom.get<HTMLInputElement>('custom-category-input');
            const commentInput = dom.get<HTMLInputElement>('purchase-comment');
            if (!amtInput || !catSelect) return;
            
            const amount = parseFloat(amtInput.value);
            let category = catSelect.value;
            
            if (category === 'custom') {
                if (customInput) {
                    category = customInput.value.trim();
                    if (!state.customCategories.includes(category)) {
                        state.customCategories.push(category);
                    }
                }
            }

            const comment = commentInput ? commentInput.value : '';

            state.purchases.push({
                id: Date.now().toString(),
                amount,
                category,
                comment,
                date: context.viewingDate.toISOString()
            });

            sounds.success();
            purchaseForm.reset();
            const customGroup = dom.get<HTMLElement>('custom-category-group');
            if (customGroup) customGroup.classList.add('hidden');
            syncState();
        });
    }

    // Quick Add Form Submit
    const quickAddForm = dom.get<HTMLFormElement>('quick-add-form');
    if (quickAddForm) {
        quickAddForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = dom.get<HTMLInputElement>('qa-name');
            const amtInput = dom.get<HTMLInputElement>('qa-amount');
            if (!nameInput || !amtInput) return;
            
            state.quickAdds.push({
                id: Date.now().toString(),
                name: nameInput.value,
                amount: parseFloat(amtInput.value)
            });
            sounds.click();
            quickAddForm.reset();
            syncState();
        });
    }

    // Grocery Form Submit
    const groceryForm = dom.get<HTMLFormElement>('grocery-form');
    if (groceryForm) {
        groceryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = dom.get<HTMLInputElement>('grocery-name');
            const qtyInput = dom.get<HTMLInputElement>('grocery-qty');
            const unitSelect = dom.get<HTMLSelectElement>('grocery-unit');
            const prioritySelect = dom.get<HTMLSelectElement>('grocery-priority');
            const priceInput = dom.get<HTMLInputElement>('grocery-price');
            if (!nameInput) return;
            
            const priority = (prioritySelect ? prioritySelect.value : 'medium') as 'low' | 'medium' | 'high';
            const price = priceInput && priceInput.value ? parseFloat(priceInput.value) : undefined;

            state.groceries.push({
                id: Date.now().toString(),
                name: nameInput.value,
                qty: qtyInput ? (parseInt(qtyInput.value) || 1) : 1,
                unit: unitSelect ? unitSelect.value : '',
                checked: false,
                priority,
                price
            });
            sounds.click();
            groceryForm.reset();
            if (qtyInput) qtyInput.value = '1';
            if (unitSelect) unitSelect.value = '';
            if (prioritySelect) prioritySelect.value = 'medium';
            if (priceInput) priceInput.value = '';
            syncState();
        });
    }

    // Clear Checked Groceries
    const clearCheckedBtn = dom.get<HTMLButtonElement>('clear-checked-groceries');
    if (clearCheckedBtn) {
        clearCheckedBtn.addEventListener('click', () => {
            window.clearCheckedGroceries();
        });
    }
}
