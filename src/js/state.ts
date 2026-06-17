export interface BudgetTopUp {
    id: string;
    amount: number;
    note: string;
    date: string;
}

export interface Debt {
    id: string;
    type: 'owed_by_me' | 'owed_to_me';
    person: string;
    amount: number;
    note: string;
    status: 'outstanding' | 'settled';
    date: string;
    linkedGroupId?: string;
}

export interface Purchase {
    id: string;
    amount: number;
    category: string;
    comment: string;
    date: string;
    subscriptionId?: string;
}

export interface Income {
    id: string;
    amount: number;
    note: string;
    date: string;
}

export interface QuickAdd {
    id: string;
    name: string;
    amount: number;
}

export interface Grocery {
    id: string;
    name: string;
    qty: number;
    unit: string;
    checked: boolean;
    priority?: 'low' | 'medium' | 'high';
    price?: number;
}

export interface Subscription {
    id: string;
    name: string;
    amount: number;
    billingDay: number;
}

export interface AppState {
    budget: number;
    dailyBudget: number;
    budgetType: 'monthly' | 'daily';
    budgetTopUps: BudgetTopUp[];
    debts: Debt[];
    subscriptions: Subscription[];
    hideRemainingBudget: boolean;
    payday: number;
    customMonthLength: number;
    customCategories: string[];
    purchases: Purchase[];
    incomes: Income[];
    quickAdds: QuickAdd[];
    groceries: Grocery[];
    themeColor: string;
    isDarkMode: boolean;
    streakOptOverspending: boolean;
    streakStartOverspending: string | null;
    streakOptTakeout: boolean;
    streakStartTakeout: string | null;
    streakOptSaving: boolean;
    streakStartSaving: string | null;
    savingsBalance: number;
    savingsGoal: number;
    hideDailyQuota?: boolean;
    showCurrentMoney?: boolean;
    currentMoney?: number;
}

export function getDefaultState(): AppState {
    return {
        budget: 0,
        dailyBudget: 0,
        budgetType: 'monthly',
        budgetTopUps: [],
        debts: [],
        subscriptions: [],
        hideRemainingBudget: false,
        payday: 1,
        customMonthLength: 0,
        customCategories: [],
        purchases: [],
        incomes: [],
        quickAdds: [],
        groceries: [],
        themeColor: '#b5eadd',
        isDarkMode: false,
        streakOptOverspending: false,
        streakStartOverspending: null,
        streakOptTakeout: false,
        streakStartTakeout: null,
        streakOptSaving: false,
        streakStartSaving: null,
        savingsBalance: 0,
        savingsGoal: 0,
        hideDailyQuota: false,
        showCurrentMoney: false,
        currentMoney: 0
    };
}

export const defaultState: AppState = getDefaultState();

// Central synchronized state object (singleton reference)
export const state: AppState = getDefaultState();

export interface AppContext {
    viewingDate: Date;
    calendarViewingDate: Date;
    pieChartInstance: any | null; // Typed loosely as ChartInstance is loaded from CDN
    currentGroupId: string | null;
    dbRef: any | null; // Typed loosely as firebase RTDB is loaded from CDN
    activeTab: string;
}

// Transient context object for runtime variables
export const context: AppContext = {
    viewingDate: new Date(),
    calendarViewingDate: new Date(),
    pieChartInstance: null,
    currentGroupId: localStorage.getItem('aura_group_id'),
    dbRef: null,
    activeTab: 'expenses'
};

export function updateState(newData: Partial<AppState>): void {
    Object.assign(state, getDefaultState(), newData);
}

export function resetState(): void {
    // Delete all keys on the state singleton object
    const keys = Object.keys(state) as Array<keyof AppState>;
    for (const key of keys) {
        delete (state as any)[key];
    }
    // Re-assign default state values
    Object.assign(state, getDefaultState());
}
