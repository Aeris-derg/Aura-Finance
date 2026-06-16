import { context } from '../state.js';
import { dom } from '../dom.js';

export function switchTab(tabName: string): void {
    context.activeTab = tabName;
    
    // Update active tab button classes
    document.querySelectorAll('.app-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Hide all main cards
    const cardIds = [
        'card-log-purchase',
        'card-quick-add',
        'card-saving',
        'card-groceries',
        'card-add-income',
        'card-manage-budget',
        'card-debts-tracker',
        'card-subscriptions',
        'card-streaks'
    ];
    cardIds.forEach(id => {
        const el = dom.get<HTMLElement>(id);
        if (el) {
            el.classList.add('hidden');
            el.style.maxWidth = '';
            el.style.margin = '';
        }
    });

    // Display appropriate card(s)
    const gridLayout = dom.get<HTMLElement>('grid-layout');
    if (!gridLayout) return;

    if (tabName === 'expenses') {
        gridLayout.classList.remove('two-cols');
        gridLayout.style.display = 'grid';
        ['card-log-purchase', 'card-quick-add', 'card-saving'].forEach(id => {
            const el = dom.get<HTMLElement>(id);
            if (el) el.classList.remove('hidden');
        });
    } else if (tabName === 'groceries') {
        gridLayout.classList.remove('two-cols');
        gridLayout.style.display = 'block';
        const el = dom.get<HTMLElement>('card-groceries');
        if (el) {
            el.classList.remove('hidden');
            el.style.maxWidth = '600px';
            el.style.margin = '0 auto';
        }
    } else if (tabName === 'budget') {
        gridLayout.classList.add('two-cols');
        gridLayout.style.display = 'grid';
        ['card-streaks', 'card-manage-budget'].forEach(id => {
            const el = dom.get<HTMLElement>(id);
            if (el) el.classList.remove('hidden');
        });
    } else {
        gridLayout.classList.remove('two-cols');
        gridLayout.style.display = 'block';
        let targetId = '';
        if (tabName === 'income') targetId = 'card-add-income';
        else if (tabName === 'debts') targetId = 'card-debts-tracker';
        else if (tabName === 'subscriptions') targetId = 'card-subscriptions';

        if (targetId) {
            const el = dom.get<HTMLElement>(targetId);
            if (el) {
                el.classList.remove('hidden');
                el.style.maxWidth = '600px';
                el.style.margin = '0 auto';
            }
        }
    }
}
