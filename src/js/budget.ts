import { state, BudgetTopUp, Purchase, Income } from './state.js';

// Cache structures for O(1) daily lookups
let groupedPurchases: Map<string, Purchase[]> | null = null;
let groupedIncomes: Map<string, Income[]> | null = null;
let groupedTopUps: Map<string, BudgetTopUp[]> | null = null;
let lastStateVersion = '';

function getTransactionHash(): string {
    return `${state.purchases.length}-${(state.incomes || []).length}-${(state.budgetTopUps || []).length}`;
}

export function invalidateCache(): void {
    groupedPurchases = null;
    groupedIncomes = null;
    groupedTopUps = null;
}

function ensureGroupedCaches(): void {
    const currentHash = getTransactionHash();
    if (groupedPurchases && lastStateVersion === currentHash) {
        return;
    }
    
    groupedPurchases = new Map();
    state.purchases.forEach(p => {
        const dStr = new Date(p.date).toDateString();
        if (!groupedPurchases!.has(dStr)) groupedPurchases!.set(dStr, []);
        groupedPurchases!.get(dStr)!.push(p);
    });

    groupedIncomes = new Map();
    (state.incomes || []).forEach(inc => {
        const dStr = new Date(inc.date).toDateString();
        if (!groupedIncomes!.has(dStr)) groupedIncomes!.set(dStr, []);
        groupedIncomes!.get(dStr)!.push(inc);
    });

    groupedTopUps = new Map();
    (state.budgetTopUps || []).forEach(t => {
        const dStr = new Date(t.date).toDateString();
        if (!groupedTopUps!.has(dStr)) groupedTopUps!.set(dStr, []);
        groupedTopUps!.get(dStr)!.push(t);
    });

    lastStateVersion = currentHash;
}

export function getDailyPurchases(date: Date): Purchase[] {
    ensureGroupedCaches();
    return groupedPurchases!.get(date.toDateString()) || [];
}

export function getDailyIncomes(date: Date): Income[] {
    ensureGroupedCaches();
    return groupedIncomes!.get(date.toDateString()) || [];
}

export function getDailyTopUps(date: Date): BudgetTopUp[] {
    ensureGroupedCaches();
    return groupedTopUps!.get(date.toDateString()) || [];
}

export function getPayPeriodBounds(targetDate: Date): { startDate: Date; endDate: Date } {
    const d = new Date(targetDate);
    const payday = parseInt(state.payday.toString());
    const currentDay = d.getDate();
    
    let startDate: Date;
    if (currentDay >= payday) {
        startDate = new Date(d.getFullYear(), d.getMonth(), payday);
    } else {
        let prevMonth = d.getMonth() - 1;
        let year = d.getFullYear();
        if (prevMonth < 0) { prevMonth = 11; year--; }
        startDate = new Date(year, prevMonth, payday);
    }

    let endDate: Date;
    if (state.customMonthLength && state.customMonthLength > 0) {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + parseInt(state.customMonthLength.toString()));
    } else {
        let nextMonth = startDate.getMonth() + 1;
        let year = startDate.getFullYear();
        if (nextMonth > 11) { nextMonth = 0; year++; }
        endDate = new Date(year, nextMonth, payday);
    }

    return { startDate, endDate };
}

export function getDaysInPayPeriod(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 30;
}

export function getTopUpsForPeriod(targetDate: Date): BudgetTopUp[] {
    const bounds = getPayPeriodBounds(targetDate);
    return (state.budgetTopUps || []).filter(t => {
        const tDate = new Date(t.date);
        return tDate >= bounds.startDate && tDate < bounds.endDate;
    });
}

export function calculateQuotaForDate(targetDate: Date): { base: number; quota: number; carryover: number } {
    ensureGroupedCaches();
    const bounds = getPayPeriodBounds(targetDate);
    const daysInPeriod = getDaysInPayPeriod(bounds.startDate, bounds.endDate);
    
    const budgetType = state.budgetType || 'monthly';
    const baseDailyQuota = budgetType === 'daily'
        ? (state.dailyBudget || 0)
        : (state.budget || 0) / daysInPeriod;

    let carryover = 0;
    const targetStartOfDay = new Date(targetDate);
    targetStartOfDay.setHours(0, 0, 0, 0);
    const startOfPeriod = new Date(bounds.startDate);
    startOfPeriod.setHours(0, 0, 0, 0);

    let totalSpentPast = 0;
    let totalIncomePast = 0;
    let totalTopUpsPast = 0;

    const currentIter = new Date(startOfPeriod);
    while (currentIter < targetStartOfDay) {
        const dStr = currentIter.toDateString();
        
        const dayPurchases = (groupedPurchases!.get(dStr) || []).filter(p => !(p.category === 'Savings' && (p.comment || '').startsWith('Savings Spend:')));
        for (let i = 0; i < dayPurchases.length; i++) {
            totalSpentPast += parseFloat(dayPurchases[i].amount.toString());
        }

        const dayIncomes = (groupedIncomes!.get(dStr) || []).filter(inc => !(inc.note || '').startsWith('Savings Withdrawal'));
        for (let i = 0; i < dayIncomes.length; i++) {
            totalIncomePast += parseFloat(dayIncomes[i].amount.toString());
        }

        const dayTopUps = groupedTopUps!.get(dStr) || [];
        for (let i = 0; i < dayTopUps.length; i++) {
            totalTopUpsPast += parseFloat(dayTopUps[i].amount.toString());
        }

        currentIter.setDate(currentIter.getDate() + 1);
    }

    const diffTime = targetStartOfDay.getTime() - startOfPeriod.getTime();
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const accumulatedBudget = daysPassed * baseDailyQuota;
    
    carryover = accumulatedBudget - totalSpentPast + totalIncomePast + totalTopUpsPast;

    const targetDStr = targetStartOfDay.toDateString();
    
    const todaysPurchases = (groupedPurchases!.get(targetDStr) || []).filter(p => !(p.category === 'Savings' && (p.comment || '').startsWith('Savings Spend:')));
    const spentToday = todaysPurchases.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

    const todaysTopUps = groupedTopUps!.get(targetDStr) || [];
    const totalTopUpsToday = todaysTopUps.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const todaysIncomes = (groupedIncomes!.get(targetDStr) || []).filter(inc => !(inc.note || '').startsWith('Savings Withdrawal'));
    const totalIncomeToday = todaysIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0);

    const currentQuota = baseDailyQuota + carryover + totalTopUpsToday + totalIncomeToday - spentToday;
    
    return {
        base: baseDailyQuota,
        quota: currentQuota,
        carryover: carryover
    };
}

export function getRemainingBudgetForPeriod(targetDate: Date): number {
    ensureGroupedCaches();
    const bounds = getPayPeriodBounds(targetDate);
    const startOfPeriod = new Date(bounds.startDate);
    startOfPeriod.setHours(0, 0, 0, 0);
    const endOfPeriod = new Date(bounds.endDate);
    endOfPeriod.setHours(0, 0, 0, 0);

    let totalSpent = 0;
    let totalIncome = 0;
    let totalTopUps = 0;

    const currentIter = new Date(startOfPeriod);
    while (currentIter < endOfPeriod) {
        const dStr = currentIter.toDateString();
        
        const dayPurchases = (groupedPurchases!.get(dStr) || []).filter(p => !(p.category === 'Savings' && (p.comment || '').startsWith('Savings Spend:')));
        for (let i = 0; i < dayPurchases.length; i++) {
            totalSpent += parseFloat(dayPurchases[i].amount.toString());
        }

        const dayIncomes = (groupedIncomes!.get(dStr) || []).filter(inc => !(inc.note || '').startsWith('Savings Withdrawal'));
        for (let i = 0; i < dayIncomes.length; i++) {
            totalIncome += parseFloat(dayIncomes[i].amount.toString());
        }

        const dayTopUps = groupedTopUps!.get(dStr) || [];
        for (let i = 0; i < dayTopUps.length; i++) {
            totalTopUps += parseFloat(dayTopUps[i].amount.toString());
        }

        currentIter.setDate(currentIter.getDate() + 1);
    }
    
    const baseBudget = (state.budgetType || 'monthly') === 'daily'
        ? ((state.dailyBudget || 0) * getDaysInPayPeriod(bounds.startDate, bounds.endDate))
        : (state.budget || 0);
        
    return baseBudget + totalTopUps + totalIncome - totalSpent;
}

export function getPurchasesForPeriod(targetDate: Date): Purchase[] {
    ensureGroupedCaches();
    const bounds = getPayPeriodBounds(targetDate);
    const startOfPeriod = new Date(bounds.startDate);
    startOfPeriod.setHours(0, 0, 0, 0);
    const endOfPeriod = new Date(bounds.endDate);
    endOfPeriod.setHours(0, 0, 0, 0);

    const list: Purchase[] = [];
    const currentIter = new Date(startOfPeriod);
    while (currentIter < endOfPeriod) {
        const dayPurchases = groupedPurchases!.get(currentIter.toDateString()) || [];
        list.push(...dayPurchases);
        currentIter.setDate(currentIter.getDate() + 1);
    }
    return list;
}
