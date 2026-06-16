import { state, context } from '../state.js';
import { updateChart } from '../chart.js';
import { updateCalendar } from '../calendar.js';
import {
    getPayPeriodBounds,
    getDaysInPayPeriod,
    getTopUpsForPeriod,
    calculateQuotaForDate,
    getRemainingBudgetForPeriod
} from '../budget.js';
import { applyTheme, applyDarkMode } from './theme.js';
import { formatMoney, renderPurchases, renderQuickAdds, renderGroceries } from './expenses.js';
import { renderIncomes, renderTopUps } from './income.js';
import { renderDebts } from './debts.js';
import { renderSubscriptions, checkAndApplySubscriptions } from './subscriptions.js';
import { renderStreaks } from './streaks.js';
import { switchTab } from './navigation.js';
import { dom } from '../dom.js';

export function updateUI(): void {
    const modal = dom.get<HTMLElement>('setup-modal');
    const appContainer = dom.get<HTMLElement>('app-container');

    if (!context.currentGroupId) {
        if (modal) modal.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');
        return;
    } else {
        if (modal) modal.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
    }

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    const todayStr = new Date().toDateString();
    const viewingStr = context.viewingDate.toDateString();
    
    const dateDisplay = dom.get<HTMLElement>('current-date-display');
    const quotaTitle = dom.get<HTMLElement>('quota-title');
    const purchasesTitle = dom.get<HTMLElement>('purchases-title');

    if (todayStr === viewingStr) {
        if (dateDisplay) dateDisplay.textContent = "Today";
        if (quotaTitle) quotaTitle.textContent = "Today's Quota";
        if (purchasesTitle) purchasesTitle.textContent = "Recent Purchases";
    } else {
        if (dateDisplay) dateDisplay.textContent = context.viewingDate.toLocaleDateString(undefined, dateOptions);
        if (quotaTitle) quotaTitle.textContent = "Daily Quota";
        if (purchasesTitle) purchasesTitle.textContent = "Purchases on this date";
    }

    const { base, quota, carryover } = calculateQuotaForDate(context.viewingDate);
    
    const quotaEl = dom.get<HTMLElement>('daily-quota');
    if (quotaEl) {
        quotaEl.textContent = formatMoney(quota);
        quotaEl.style.color = quota < 0 ? 'var(--danger-color)' : 'var(--text-primary)';
    }

    const baseAmountEl = dom.get<HTMLElement>('base-amount');
    if (baseAmountEl) baseAmountEl.textContent = formatMoney(base);

    const carryoverEl = dom.get<HTMLElement>('carryover-amount');
    if (carryoverEl) {
        carryoverEl.textContent = formatMoney(carryover);
        carryoverEl.className = carryover < 0 ? 'negative' : (carryover > 0 ? 'positive' : '');
    }

    const remaining = getRemainingBudgetForPeriod(context.viewingDate);
    const remainingBudgetEl = dom.get<HTMLElement>('remaining-budget');
    if (remainingBudgetEl) remainingBudgetEl.textContent = formatMoney(remaining);
    
    const bounds = getPayPeriodBounds(context.viewingDate);
    const daysInPeriod = getDaysInPayPeriod(bounds.startDate, bounds.endDate);
    const baseBudget = (state.budgetType || 'monthly') === 'daily'
        ? ((state.dailyBudget || 0) * daysInPeriod)
        : (state.budget || 0);
    const periodTopUps = getTopUpsForPeriod(context.viewingDate);
    const totalTopUps = periodTopUps.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalBudget = baseBudget + totalTopUps;
    
    const progressPercent = totalBudget > 0 ? Math.max(0, Math.min(100, (remaining / totalBudget) * 100)) : 0;
    const progressBar = dom.get<HTMLElement>('budget-progress');
    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
        progressBar.style.background = progressPercent < 20 ? 'var(--danger-color)' : 'var(--accent-color)';
    }

    // Update adjust budget form fields if visible
    const adjType = dom.get<HTMLSelectElement>('adjust-budget-type');
    const adjAmt = dom.get<HTMLInputElement>('adjust-budget-amount');
    if (adjType && adjAmt) {
        adjType.value = state.budgetType || 'monthly';
        adjAmt.value = ((state.budgetType || 'monthly') === 'daily' ? (state.dailyBudget || 0) : (state.budget || 0)).toString();
        const label = dom.get<HTMLElement>('adjust-budget-label');
        if (label) {
            label.textContent = (state.budgetType || 'monthly') === 'daily' ? "Daily Budget (£)" : "Monthly Budget (£)";
        }
    }

    // Toggle Remaining Budget visibility
    const isDaily = (state.budgetType || 'monthly') === 'daily';

    const hideRemaining = isDaily || !!state.hideRemainingBudget;
    const remainingCard = dom.get<HTMLElement>('remaining-budget-card');
    const dashboardSection = dom.get<HTMLElement>('dashboard-section');
    const hideCheckbox = dom.get<HTMLInputElement>('hide-remaining-budget');
    
    const showRemaining = !hideRemaining;

    if (remainingCard) {
        if (showRemaining) {
            remainingCard.classList.remove('hidden');
        } else {
            remainingCard.classList.add('hidden');
        }
    }

    const anyStreakActive = !!state.streakOptOverspending || !!state.streakOptTakeout || !!state.streakOptSaving;
    
    const dbStreaksCard = dom.get<HTMLElement>('dashboard-streaks-card');
    if (dbStreaksCard) {
        if (anyStreakActive) {
            dbStreaksCard.classList.remove('hidden');
        } else {
            dbStreaksCard.classList.add('hidden');
        }
    }

    const showRightCol = showRemaining || anyStreakActive;
    const dbRightCol = dom.get<HTMLElement>('dashboard-right-col');
    if (dbRightCol) {
        dbRightCol.style.display = showRightCol ? 'flex' : 'none';
    }

    if (dashboardSection) {
        if (showRightCol) {
            dashboardSection.classList.remove('full-width');
            dashboardSection.style.gridTemplateColumns = '2fr 1.2fr';
        } else {
            dashboardSection.classList.add('full-width');
            dashboardSection.style.gridTemplateColumns = '1fr';
        }
    }
    // Only show checkbox for monthly mode; hide it when daily
    const checkboxWrapper = hideCheckbox ? hideCheckbox.closest('div') : null;
    if (checkboxWrapper) {
        checkboxWrapper.style.display = isDaily ? 'none' : 'flex';
    }
    if (hideCheckbox) {
        hideCheckbox.checked = hideRemaining;
    }

    const optOverspending = dom.get<HTMLInputElement>('streak-opt-overspending');
    const optTakeout = dom.get<HTMLInputElement>('streak-opt-takeout');
    const optSaving = dom.get<HTMLInputElement>('streak-opt-saving');
    if (optOverspending) optOverspending.checked = !!state.streakOptOverspending;
    if (optTakeout) optTakeout.checked = !!state.streakOptTakeout;
    if (optSaving) optSaving.checked = !!state.streakOptSaving;

    const catSelect = dom.get<HTMLSelectElement>('purchase-category');
    if (catSelect) {
        Array.from(catSelect.options).forEach(opt => {
            if (!['Groceries', 'Transport', 'Entertainment', 'Takeout', 'Bills', 'Other', 'custom'].includes(opt.value)) {
                opt.remove();
            }
        });
        const fragment = document.createDocumentFragment();
        state.customCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            fragment.appendChild(option);
        });
        catSelect.insertBefore(fragment, catSelect.lastElementChild);
    }

    checkAndApplySubscriptions();
    renderPurchases();
    renderQuickAdds();
    renderGroceries();
    renderIncomes();
    renderTopUps();
    renderDebts();
    renderSubscriptions();
    renderStreaks();
    updateChart();
    updateCalendar();
    switchTab(context.activeTab);
}
