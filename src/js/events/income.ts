import { state, context } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { dom } from '../dom.js';

export function initIncomeEvents(): void {
    // Income Form Submit
    const incomeForm = dom.get<HTMLFormElement>('income-form');
    if (incomeForm) {
        incomeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amtInput = dom.get<HTMLInputElement>('income-amount');
            const noteInput = dom.get<HTMLInputElement>('income-note');
            if (!amtInput) return;
            
            const amount = parseFloat(amtInput.value);
            const note = noteInput ? (noteInput.value.trim() || 'Income') : 'Income';
            if (!amount || amount <= 0) return;

            if (!state.incomes) state.incomes = [];
            state.incomes.push({
                id: Date.now().toString(),
                amount,
                note,
                date: context.viewingDate.toISOString()
            });

            sounds.success();
            incomeForm.reset();
            syncState();
        });
    }

    // Adjust Budget Type Change
    const adjustBudgetType = dom.get<HTMLSelectElement>('adjust-budget-type');
    if (adjustBudgetType) {
        adjustBudgetType.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const label = dom.get<HTMLElement>('adjust-budget-label');
            const monthlyOnlySettings = dom.get<HTMLElement>('monthly-only-settings');
            if (label) {
                if (target.value === 'daily') {
                    label.textContent = "Daily Budget (£)";
                    if (monthlyOnlySettings) monthlyOnlySettings.style.display = 'none';
                } else {
                    label.textContent = "Monthly Budget (£)";
                    if (monthlyOnlySettings) monthlyOnlySettings.style.display = 'flex';
                }
            }
        });
    }

    const showCurrentMoneyChk = dom.get<HTMLInputElement>('show-current-money');
    if (showCurrentMoneyChk) {
        showCurrentMoneyChk.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const currentMoneyGroup = dom.get<HTMLElement>('current-money-group');
            if (currentMoneyGroup) {
                if (target.checked) {
                    currentMoneyGroup.classList.remove('hidden');
                } else {
                    currentMoneyGroup.classList.add('hidden');
                }
            }
        });
    }

    // Adjust Budget Form Submit
    const adjustBudgetForm = dom.get<HTMLFormElement>('adjust-budget-form');
    if (adjustBudgetForm) {
        adjustBudgetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const typeSelect = dom.get<HTMLSelectElement>('adjust-budget-type');
            const amtInput = dom.get<HTMLInputElement>('adjust-budget-amount');
            if (!typeSelect || !amtInput) return;
            
            const type = typeSelect.value as 'monthly' | 'daily';
            const amount = parseFloat(amtInput.value);
            
            state.budgetType = type;
            if (type === 'daily') {
                state.dailyBudget = amount;
            } else {
                state.budget = amount;
                
                // Save monthly options
                state.hideDailyQuota = dom.get<HTMLInputElement>('hide-daily-quota')?.checked || false;
                state.showCurrentMoney = dom.get<HTMLInputElement>('show-current-money')?.checked || false;
                state.currentMoney = parseFloat(dom.get<HTMLInputElement>('current-money-input')?.value || '0') || 0;
            }
            
            sounds.success();
            syncState();
            alert("Base budget updated successfully!");
        });
    }

    // Top-up Budget Form Submit
    const topupForm = dom.get<HTMLFormElement>('topup-budget-form');
    if (topupForm) {
        topupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amtInput = dom.get<HTMLInputElement>('topup-amount');
            const noteInput = dom.get<HTMLInputElement>('topup-note');
            if (!amtInput) return;
            
            const amount = parseFloat(amtInput.value);
            const note = noteInput ? (noteInput.value.trim() || 'Budget Top-up') : 'Budget Top-up';
            if (!amount || amount <= 0) return;

            if (!state.budgetTopUps) state.budgetTopUps = [];
            state.budgetTopUps.push({
                id: Date.now().toString(),
                amount,
                note,
                date: context.viewingDate.toISOString()
            });

            sounds.success();
            topupForm.reset();
            syncState();
        });
    }
}
