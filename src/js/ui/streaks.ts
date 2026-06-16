import { state, context } from '../state.js';
import { calculateQuotaForDate } from '../budget.js';
import { dom } from '../dom.js';

export function calculateStreakForType(type: 'overspending' | 'takeout' | 'saving'): number {
    let startStr: string | null = null;
    if (type === 'overspending') startStr = state.streakStartOverspending;
    else if (type === 'takeout') startStr = state.streakStartTakeout;
    else if (type === 'saving') startStr = state.streakStartSaving;

    if (!startStr) return 0;

    const startDate = new Date(startStr);
    startDate.setHours(0, 0, 0, 0);

    const startFromDate = new Date(context.viewingDate || new Date());
    startFromDate.setHours(0, 0, 0, 0);

    if (startFromDate < startDate) return 0;

    let streak = 0;
    const target = new Date(startFromDate);

    while (target >= startDate) {
        const dateStr = target.toDateString();
        const purchasesOnDay = (state.purchases || []).filter(p => {
            const pDate = new Date(p.date);
            return pDate.toDateString() === dateStr;
        });

        const { base, quota } = calculateQuotaForDate(target);

        let conditionMet = false;
        if (type === 'overspending') {
            conditionMet = base > 0 && quota >= 0;
        } else if (type === 'takeout') {
            conditionMet = !purchasesOnDay.some(p => 
                (p.category || '').toLowerCase() === 'takeout' || 
                (p.comment || '').toLowerCase().includes('takeout')
            );
        } else if (type === 'saving') {
            conditionMet = base > 0 && quota > 0;
        }

        if (conditionMet) {
            streak++;
        } else {
            break;
        }

        target.setDate(target.getDate() - 1);
    }

    return streak;
}

export function renderStreaks(): void {
    const showOverspending = !!state.streakOptOverspending;
    const showTakeout = !!state.streakOptTakeout;
    const showSaving = !!state.streakOptSaving;
    const showSavingsGoal = (state.savingsGoal || 0) > 0;

    const buildHTML = (containerId: string, activeTitleId: string) => {
        const container = dom.get<HTMLElement>(containerId);
        const activeTitle = dom.get<HTMLElement>(activeTitleId);
        if (!container) return;

        if (!showOverspending && !showTakeout && !showSaving && !showSavingsGoal) {
            if (activeTitle) activeTitle.style.display = 'none';
            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size: 0.95rem; margin-top: 10px;">No streaks or goals enabled. Check options above to begin tracking.</div>';
            return;
        }

        if (activeTitle) activeTitle.style.display = 'flex';
        container.innerHTML = '';

        const fragment = document.createDocumentFragment();
        const renderItem = (title: string, streakCount: number, startDateStr: string, color: string) => {
            const formattedDate = new Date(startDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const div = document.createElement('div');
            div.className = 'streak-item';
            div.innerHTML = `
                <div class="streak-info">
                    <span class="streak-name">${title}</span>
                    <span class="streak-start-date">Since ${formattedDate}</span>
                </div>
                <div class="streak-count-container">
                    <span class="streak-count" style="color: ${color};">${streakCount} ${streakCount === 1 ? 'day' : 'days'}</span>
                    <i class="ri-fire-fill streak-flame" style="color: #ff9f43; font-size: 1.3rem;"></i>
                </div>
            `;
            fragment.appendChild(div);
        };

        if (showOverspending && state.streakStartOverspending) {
            const count = calculateStreakForType('overspending');
            renderItem('No Overspending', count, state.streakStartOverspending, 'var(--success-color)');
        }
        if (showTakeout && state.streakStartTakeout) {
            const count = calculateStreakForType('takeout');
            renderItem('No Takeout', count, state.streakStartTakeout, '#38ef7d');
        }
        if (showSaving && state.streakStartSaving) {
            const count = calculateStreakForType('saving');
            renderItem('Surplus / Savings', count, state.streakStartSaving, '#54a0ff');
        }

        if (showSavingsGoal) {
            const balance = Number(state.savingsBalance) || 0;
            const goal = Number(state.savingsGoal) || 0;
            const percent = goal > 0 ? Math.min(100, Math.max(0, (balance / goal) * 100)) : 0;
            const div = document.createElement('div');
            div.className = 'streak-item';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'stretch';
            div.style.gap = '8px';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="streak-name" style="font-weight:600;"><i class="ri-bank-line" style="color:var(--success-color);"></i> Savings Goal</span>
                    <span style="font-size:0.9rem; font-weight:700; color:var(--success-color);">£${balance.toFixed(2)} / £${goal.toFixed(2)}</span>
                </div>
                <div class="progress-container" style="margin-top: 5px; height: 8px;">
                    <div class="progress-bar" style="width: ${percent}%; background: linear-gradient(135deg, #38ef7d, #11998e);"></div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">${percent.toFixed(0)}% Completed</div>
            `;
            fragment.appendChild(div);
        }

        container.appendChild(fragment);
    };

    buildHTML('streaks-container', 'active-streaks-title');
    buildHTML('dashboard-streaks-container', 'dashboard-active-streaks-title');
}
