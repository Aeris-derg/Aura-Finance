import { state, context } from '../state.js';
import { sounds } from '../audio.js';
import { db, syncState } from '../db.js';
import { dom } from '../dom.js';

export function initDebtsEvents(): void {
    // Debt Link Option Change
    const debtIsLinked = dom.get<HTMLInputElement>('debt-is-linked');
    if (debtIsLinked) {
        debtIsLinked.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const container = dom.get<HTMLElement>('debt-link-group-id-container');
            const input = dom.get<HTMLInputElement>('debt-link-group-id');
            if (!container) return;
            
            if (target.checked) {
                container.classList.remove('hidden');
                if (input) input.required = true;
            } else {
                container.classList.add('hidden');
                if (input) input.required = false;
            }
        });
    }

    // Debt Form Submit
    const debtForm = dom.get<HTMLFormElement>('debt-form');
    if (debtForm) {
        debtForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const typeSelect = dom.get<HTMLSelectElement>('debt-type');
            const personInput = dom.get<HTMLInputElement>('debt-person');
            const amtInput = dom.get<HTMLInputElement>('debt-amount');
            const noteInput = dom.get<HTMLInputElement>('debt-note');
            const linkedCheckbox = dom.get<HTMLInputElement>('debt-is-linked');
            const linkedIdInput = dom.get<HTMLInputElement>('debt-link-group-id');
            if (!typeSelect || !personInput || !amtInput) return;
            
            const type = typeSelect.value as 'owed_by_me' | 'owed_to_me';
            const person = personInput.value.trim();
            const amount = parseFloat(amtInput.value);
            const note = noteInput ? (noteInput.value.trim() || 'Debt') : 'Debt';
            const isLinked = linkedCheckbox ? linkedCheckbox.checked : false;
            const targetGroupId = linkedIdInput ? linkedIdInput.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') : '';

            if (!person || !amount || amount <= 0) return;

            if (isLinked) {
                if (!targetGroupId) {
                    alert("Please enter a valid Target Group ID.");
                    return;
                }
                if (targetGroupId === context.currentGroupId) {
                    alert("You cannot link a debt to your own Group ID.");
                    return;
                }
                
                db.ref('groups/' + targetGroupId).once('value')
                    .then((snapshot: any) => {
                        const targetData = snapshot.val();
                        if (!targetData) {
                            alert(`Target Group ID "${targetGroupId}" does not exist in the database.`);
                            sounds.error();
                            return;
                        }
                        
                        const debtId = Date.now().toString();
                        
                        db.ref('groups/' + targetGroupId).transaction((groupData: any) => {
                            if (!groupData) return groupData;
                            
                            if (type === 'owed_by_me') {
                                if (!groupData.purchases) groupData.purchases = [];
                                groupData.purchases.push({
                                    id: Date.now().toString() + '-target-debt-out',
                                    amount: amount,
                                    category: 'Debt',
                                    comment: `[Debt Lent] to Group: ${context.currentGroupId}`,
                                    date: context.viewingDate.toISOString()
                                });
                            } else if (type === 'owed_to_me') {
                                if (!groupData.incomes) groupData.incomes = [];
                                groupData.incomes.push({
                                    id: Date.now().toString() + '-target-debt-in',
                                    amount: amount,
                                    category: 'Debt',
                                    comment: `[Debt Borrowed] from Group: ${context.currentGroupId}`,
                                    date: context.viewingDate.toISOString()
                                });
                            }
                            
                            if (!groupData.debts) groupData.debts = [];
                            groupData.debts.push({
                                id: debtId,
                                type: type === 'owed_by_me' ? 'owed_to_me' : 'owed_by_me',
                                person: context.currentGroupId,
                                amount: amount,
                                note: `Linked Debt: ${note}`,
                                linkedGroupId: context.currentGroupId,
                                status: 'outstanding',
                                date: context.viewingDate.toISOString()
                            });
                            
                            return groupData;
                        }, (error: Error | null, committed: boolean) => {
                            if (error) {
                                console.error("Linked transaction failed:", error);
                                alert("Failed to link debt to target group: " + error.message);
                            } else if (committed) {
                                if (type === 'owed_by_me') {
                                    if (!state.incomes) state.incomes = [];
                                    state.incomes.push({
                                        id: debtId + '-local-debt-in',
                                        amount: amount,
                                        note: `[Debt Borrowed] from Group: ${targetGroupId}`,
                                        date: context.viewingDate.toISOString()
                                    });
                                } else if (type === 'owed_to_me') {
                                    if (!state.purchases) state.purchases = [];
                                    state.purchases.push({
                                        id: debtId + '-local-debt-out',
                                        amount: amount,
                                        category: 'Debt',
                                        comment: `[Debt Lent] to Group: ${targetGroupId}`,
                                        date: context.viewingDate.toISOString()
                                    });
                                }
                                
                                if (!state.debts) state.debts = [];
                                state.debts.push({
                                    id: debtId,
                                    type,
                                    person: `${person} (Group: ${targetGroupId})`,
                                    amount,
                                    note,
                                    linkedGroupId: targetGroupId,
                                    status: 'outstanding',
                                    date: context.viewingDate.toISOString()
                                });
                                
                                sounds.success();
                                debtForm.reset();
                                const linkContainer = dom.get<HTMLElement>('debt-link-group-id-container');
                                if (linkContainer) linkContainer.classList.add('hidden');
                                if (linkedIdInput) linkedIdInput.required = false;
                                syncState();
                            }
                        });
                    })
                    .catch((err: Error) => {
                        console.error("Checking target group failed:", err);
                        alert("Database Connection Failed: " + err.message);
                    });
            } else {
                if (!state.debts) state.debts = [];
                state.debts.push({
                    id: Date.now().toString(),
                    type,
                    person,
                    amount,
                    note,
                    status: 'outstanding',
                    date: context.viewingDate.toISOString()
                });

                sounds.success();
                debtForm.reset();
                syncState();
            }
        });
    }
}
