import { initThemeEvents } from './theme.js';
import { initNavigationEvents } from './navigation.js';
import { initExpensesEvents } from './expenses.js';
import { initIncomeEvents } from './income.js';
import { initDebtsEvents } from './debts.js';
import { initSubscriptionsEvents } from './subscriptions.js';
import { initStreaksEvents } from './streaks.js';
import { initSetupEvents } from './setup.js';
import { initDashboardEvents } from './dashboard.js';

export function initAllEvents(): void {
    initThemeEvents();
    initNavigationEvents();
    initExpensesEvents();
    initIncomeEvents();
    initDebtsEvents();
    initSubscriptionsEvents();
    initStreaksEvents();
    initSetupEvents();
    initDashboardEvents();
}
