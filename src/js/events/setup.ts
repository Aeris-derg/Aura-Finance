import { state, context, resetState } from '../state.js';
import { sounds } from '../audio.js';
import { db, joinGroup } from '../db.js';
import { updateUI } from '../ui/index.js';
import { dom } from '../dom.js';

export function initSetupEvents(): void {
    // Setup Modal Tab Switching
    const tabLogin = dom.get<HTMLElement>('tab-login');
    if (tabLogin) {
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            const tabCreate = dom.get<HTMLElement>('tab-create');
            if (tabCreate) tabCreate.classList.remove('active');
            const loginFormEl = dom.get<HTMLElement>('login-form');
            if (loginFormEl) loginFormEl.classList.remove('hidden');
            const setupFormEl = dom.get<HTMLElement>('setup-form');
            if (setupFormEl) setupFormEl.classList.add('hidden');
            sounds.click();
        });
    }

    const tabCreate = dom.get<HTMLElement>('tab-create');
    if (tabCreate) {
        tabCreate.addEventListener('click', () => {
            tabCreate.classList.add('active');
            const tabLoginBtn = dom.get<HTMLElement>('tab-login');
            if (tabLoginBtn) tabLoginBtn.classList.remove('active');
            const setupFormEl = dom.get<HTMLElement>('setup-form');
            if (setupFormEl) setupFormEl.classList.remove('hidden');
            const loginFormEl = dom.get<HTMLElement>('login-form');
            if (loginFormEl) loginFormEl.classList.add('hidden');
            sounds.click();
        });
    }

    // Join Group / Login Submission
    const loginForm = dom.get<HTMLFormElement>('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const gIdInput = dom.get<HTMLInputElement>('login-group-id');
            const gPasswordInput = dom.get<HTMLInputElement>('login-password');
            if (!gIdInput || !gPasswordInput) return;
            
            const gId = gIdInput.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
            const password = gPasswordInput.value;
            if (!gId) {
                alert("Please enter a valid Group ID.");
                return;
            }

            db.ref('groups/' + gId).once('value')
                .then((snapshot: any) => {
                    const val = snapshot.val();
                    if (val) {
                        if (val.password && val.password !== password) {
                            alert("Incorrect Group Password.");
                            sounds.error();
                            return;
                        }
                        sounds.success();
                        joinGroup(gId);
                    } else {
                        alert(`Group "${gId}" was not found. Please check the ID or create a new group under the "New Group" tab.`);
                    }
                })
                .catch((error: Error) => {
                    console.error("Login once() check failed:", error);
                    alert("Database Connection Failed: " + error.message);
                });
        });
    }

    // Setup Budget Type Label Toggle
    const setupBudgetType = dom.get<HTMLSelectElement>('setup-budget-type');
    if (setupBudgetType) {
        setupBudgetType.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const label = dom.get<HTMLElement>('setup-budget-label');
            const monthLengthGroup = dom.get<HTMLElement>('setup-month-length-group');
            if (target.value === 'daily') {
                if (label) label.textContent = "Daily Budget (£)";
                if (monthLengthGroup) monthLengthGroup.classList.add('hidden');
            } else {
                if (label) label.textContent = "Monthly Budget (£)";
                if (monthLengthGroup) monthLengthGroup.classList.remove('hidden');
            }
        });
    }

    // Setup Form Submission (New Group)
    const setupForm = dom.get<HTMLFormElement>('setup-form');
    if (setupForm) {
        setupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const gIdInput = dom.get<HTMLInputElement>('group-id');
            if (!gIdInput) return;
            
            const gId = gIdInput.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
            if (!gId) {
                alert("Please enter a valid Group ID (letters, numbers, dashes, and underscores only).");
                return;
            }
            
            const setupPassword = dom.get<HTMLInputElement>('setup-password')?.value || '';
            const budgetType = (dom.get<HTMLSelectElement>('setup-budget-type')?.value || 'monthly') as 'monthly' | 'daily';
            const budgetAmount = parseFloat(dom.get<HTMLInputElement>('setup-budget-amount')?.value || '0');
            const payday = parseInt(dom.get<HTMLInputElement>('payday')?.value || '1');
            const customMonthLength = parseInt(dom.get<HTMLInputElement>('custom-month-length')?.value || '0') || 0;

            // Check if group already exists in Firebase
            db.ref('groups/' + gId).once('value')
                .then((snapshot: any) => {
                    const existingData = snapshot.val();
                    if (existingData) {
                        const enteredPass = prompt("The group already exists. Enter the password to proceed:");
                        if (existingData.password && existingData.password !== enteredPass) {
                            alert("Incorrect Password. Overwrite/Join aborted.");
                            sounds.error();
                            return;
                        }
                        const acceptExisting = confirm("Password correct! Do you want to join this existing group? If you click Cancel, you will OVERWRITE it with your new settings.");
                        if (acceptExisting) {
                            sounds.success();
                            joinGroup(gId);
                            return;
                        }
                    }

                    // Create new or overwrite existing
                    sounds.success();
                    const initialData = {
                        password: setupPassword,
                        budget: budgetType === 'monthly' ? budgetAmount : 0,
                        dailyBudget: budgetType === 'daily' ? budgetAmount : 0,
                        budgetType,
                        budgetTopUps: [],
                        debts: [],
                        subscriptions: [],
                        hideRemainingBudget: false,
                        payday,
                        customMonthLength,
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
                        savingsGoal: 0
                    };
                    joinGroup(gId, true, initialData);
                })
                .catch((error: Error) => {
                    console.error("Firebase database once() error:", error);
                    alert("Database Connection Failed.\n\nDetails: " + error.message);
                });
        });
    }

    // Reset app / Leave Group
    const resetAppBtn = dom.get<HTMLElement>('reset-app');
    if (resetAppBtn) {
        resetAppBtn.addEventListener('click', () => {
            if (confirm('Do you want to sign out and leave this group? (Your group\'s data on Firebase will NOT be deleted).')) {
                sounds.delete();
                localStorage.removeItem('aura_group_id');
                context.currentGroupId = null;
                if (context.dbRef) {
                    context.dbRef.off();
                    context.dbRef = null;
                }
                resetState();
                context.viewingDate = new Date();
                context.calendarViewingDate = new Date();
                updateUI();
            }
        });
    }
}
