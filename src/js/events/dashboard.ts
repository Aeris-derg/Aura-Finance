import { state, context } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { updateUI } from '../ui/index.js';
import { dom } from '../dom.js';

export function initDashboardEvents(): void {
    // Date Navigation
    const prevDay = dom.get<HTMLElement>('prev-day');
    if (prevDay) {
        prevDay.addEventListener('click', () => {
            context.viewingDate.setDate(context.viewingDate.getDate() - 1);
            if (context.viewingDate.getMonth() !== context.calendarViewingDate.getMonth()) {
                context.calendarViewingDate = new Date(context.viewingDate);
            }
            sounds.click();
            updateUI();
        });
    }

    const nextDay = dom.get<HTMLElement>('next-day');
    if (nextDay) {
        nextDay.addEventListener('click', () => {
            context.viewingDate.setDate(context.viewingDate.getDate() + 1);
            if (context.viewingDate.getMonth() !== context.calendarViewingDate.getMonth()) {
                context.calendarViewingDate = new Date(context.viewingDate);
            }
            sounds.click();
            updateUI();
        });
    }

    // Calendar Navigation
    const calPrevMonth = dom.get<HTMLElement>('cal-prev-month');
    if (calPrevMonth) {
        calPrevMonth.addEventListener('click', () => {
            context.calendarViewingDate.setMonth(context.calendarViewingDate.getMonth() - 1);
            sounds.click();
            updateUI();
        });
    }

    const calNextMonth = dom.get<HTMLElement>('cal-next-month');
    if (calNextMonth) {
        calNextMonth.addEventListener('click', () => {
            context.calendarViewingDate.setMonth(context.calendarViewingDate.getMonth() + 1);
            sounds.click();
            updateUI();
        });
    }

    // Hide Remaining Budget Toggle Listener
    const hideRemainingBudget = dom.get<HTMLInputElement>('hide-remaining-budget');
    if (hideRemainingBudget) {
        hideRemainingBudget.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            state.hideRemainingBudget = target.checked;
            sounds.click();
            syncState();
        });
    }

    // Hide Daily Quota Toggle Listener
    const hideDailyQuota = dom.get<HTMLInputElement>('hide-daily-quota');
    if (hideDailyQuota) {
        hideDailyQuota.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            state.hideDailyQuota = target.checked;
            sounds.click();
            syncState();
        });
    }


    // Global Click Sound for buttons
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === 'BUTTON' && !target.classList.contains('delete') && !target.classList.contains('qa-delete')) {
            const button = target as HTMLButtonElement;
            if (button.type !== 'submit') sounds.click();
        }
    });
}
