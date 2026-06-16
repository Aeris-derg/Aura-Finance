import { state } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { checkAndApplySubscriptions } from '../ui/index.js';
import { dom } from '../dom.js';

export function initSubscriptionsEvents(): void {
    // Subscription Form Submit
    const subscriptionForm = dom.get<HTMLFormElement>('subscription-form');
    if (subscriptionForm) {
        subscriptionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = dom.get<HTMLInputElement>('sub-name');
            const amtInput = dom.get<HTMLInputElement>('sub-amount');
            const dayInput = dom.get<HTMLInputElement>('sub-day');
            if (!nameInput || !amtInput || !dayInput) return;
            
            const name = nameInput.value.trim();
            const amount = parseFloat(amtInput.value);
            const day = parseInt(dayInput.value);
            
            if (!name || !amount || amount <= 0 || !day || day < 1 || day > 31) return;
            
            if (!state.subscriptions) state.subscriptions = [];
            
            state.subscriptions.push({
                id: Date.now().toString(),
                name,
                amount,
                billingDay: day
            });
            
            sounds.success();
            subscriptionForm.reset();
            
            checkAndApplySubscriptions();
            syncState();
        });
    }
}
