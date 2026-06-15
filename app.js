// ===============================
// AUDIO SYSTEM
// ===============================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol=0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    click: () => playTone(600, 'sine', 0.1, 0.05),
    success: () => { playTone(500, 'sine', 0.1); setTimeout(() => playTone(800, 'sine', 0.15), 100); },
    error: () => playTone(200, 'sawtooth', 0.2, 0.1),
    delete: () => playTone(300, 'square', 0.1, 0.05)
};

// ===============================
// FIREBASE CONFIGURATION & SYNC
// ===============================
const firebaseConfig = {
  apiKey: "PLACEHOLDER_FIREBASE_API",
  authDomain: "aura-finance-6b6b3.firebaseapp.com",
  projectId: "aura-finance-6b6b3",
  storageBucket: "aura-finance-6b6b3.firebasestorage.app",
  messagingSenderId: "535623897451",
  appId: "1:535623897451:web:23f202435008018519fc2e",
  databaseURL: "https://aura-finance-6b6b3-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Track connection status
db.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
        console.log("Connected to Firebase RTDB");
    } else {
        console.log("Disconnected from Firebase RTDB (or attempting to connect...)");
    }
});

let state = {
    budget: 0,
    dailyBudget: 0,
    budgetType: 'monthly', // 'monthly' or 'daily'
    budgetTopUps: [],
    debts: [],
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
    streakStartSaving: null
};

// Internal transient state
let viewingDate = new Date();
let calendarViewingDate = new Date();
let pieChartInstance = null;
let currentGroupId = localStorage.getItem('aura_group_id') || null;
let dbRef = null;
let activeTab = 'expenses';

function syncState() {
    if (dbRef) {
        dbRef.set(state);
    }
}

function joinGroup(groupId, isNewCreation = false, initialSetupData = null) {
    currentGroupId = groupId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''); // sanitize ID
    if (!currentGroupId) return;

    localStorage.setItem('aura_group_id', currentGroupId);
    document.getElementById('header-group-id').textContent = currentGroupId;

    if (dbRef) {
        dbRef.off(); // Detach previous listeners
    }

    dbRef = db.ref('groups/' + currentGroupId);

    // If it's a new creation, set the initial data first
    if (isNewCreation && initialSetupData) {
        state = { ...state, ...initialSetupData };
        dbRef.set(state).catch(err => {
            console.error("Firebase write error:", err);
            alert("Failed to initialize group settings in database: " + err.message + "\n\nPlease check your Firebase Realtime Database Rules.");
        });
    }

    // Attach real-time listener with error callback
    dbRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
            // Merge defaults in case new fields were added
            state = { ...state, ...val };
            applyTheme(state.themeColor);
            applyDarkMode(state.isDarkMode);
            updateUI();
        } else {
            // Group exists on client but not on DB (e.g. wiped or initialized without data)
            if (!isNewCreation) {
                // Prompt setup again
                localStorage.removeItem('aura_group_id');
                currentGroupId = null;
                dbRef = null;
                updateUI();
            }
        }
    }, (error) => {
        console.error("Firebase sync error:", error);
        alert("Permission denied or database connection failed.\n\nPlease ensure your Firebase Realtime Database rules allow Read/Write access.");
    });
}

// Check initial load state
if (currentGroupId) {
    joinGroup(currentGroupId);
} else {
    updateUI(); // This will show setup modal
}

function applyTheme(color) {
    document.documentElement.style.setProperty('--theme-color', color);
    document.getElementById('theme-color-picker').value = color;
    updateChart();
}

function applyDarkMode(isDark) {
    if (isDark) {
        document.body.classList.add('dark-theme');
        document.getElementById('dark-mode-toggle').innerHTML = '<i class="ri-sun-line"></i>';
    } else {
        document.body.classList.remove('dark-theme');
        document.getElementById('dark-mode-toggle').innerHTML = '<i class="ri-moon-line"></i>';
    }
    updateChart();
}

// ===============================
// CORE LOGIC
// ===============================

function getPayPeriodBounds(targetDate) {
    const d = new Date(targetDate);
    const payday = parseInt(state.payday);
    const currentDay = d.getDate();
    
    let startDate;
    if (currentDay >= payday) {
        startDate = new Date(d.getFullYear(), d.getMonth(), payday);
    } else {
        let prevMonth = d.getMonth() - 1;
        let year = d.getFullYear();
        if (prevMonth < 0) { prevMonth = 11; year--; }
        startDate = new Date(year, prevMonth, payday);
    }

    let endDate;
    if (state.customMonthLength && state.customMonthLength > 0) {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + parseInt(state.customMonthLength));
    } else {
        let nextMonth = startDate.getMonth() + 1;
        let year = startDate.getFullYear();
        if (nextMonth > 11) { nextMonth = 0; year++; }
        endDate = new Date(year, nextMonth, payday);
    }

    return { startDate, endDate };
}

function getDaysInPayPeriod(startDate, endDate) {
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 30;
}

function getTopUpsForPeriod(targetDate) {
    const bounds = getPayPeriodBounds(targetDate);
    return (state.budgetTopUps || []).filter(t => {
        const tDate = new Date(t.date);
        return tDate >= bounds.startDate && tDate < bounds.endDate;
    });
}

function calculateQuotaForDate(targetDate) {
    const bounds = getPayPeriodBounds(targetDate);
    const daysInPeriod = getDaysInPayPeriod(bounds.startDate, bounds.endDate);
    
    const budgetType = state.budgetType || 'monthly';
    const baseDailyQuota = budgetType === 'daily'
        ? (state.dailyBudget || 0)
        : (state.budget || 0) / daysInPeriod;

    let carryover = 0;
    const targetStartOfDay = new Date(targetDate);
    targetStartOfDay.setHours(0,0,0,0);
    const startOfPeriod = new Date(bounds.startDate);
    startOfPeriod.setHours(0,0,0,0);

    const diffTime = targetStartOfDay - startOfPeriod;
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const accumulatedBudget = daysPassed * baseDailyQuota;
    
    // Past top-ups in this period
    const pastTopUps = (state.budgetTopUps || []).filter(t => {
        const tDate = new Date(t.date);
        tDate.setHours(0,0,0,0);
        return tDate >= startOfPeriod && tDate < targetStartOfDay;
    });
    const totalTopUpsPast = pastTopUps.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const pastPurchases = state.purchases.filter(p => {
        const pDate = new Date(p.date);
        pDate.setHours(0,0,0,0);
        return pDate >= startOfPeriod && pDate < targetStartOfDay;
    });
    const pastIncomes = (state.incomes || []).filter(inc => {
        const iDate = new Date(inc.date);
        iDate.setHours(0,0,0,0);
        return iDate >= startOfPeriod && iDate < targetStartOfDay;
    });
    const totalIncomePast = pastIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
    const totalSpentPast = pastPurchases.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    carryover = accumulatedBudget - totalSpentPast + totalIncomePast + totalTopUpsPast;

    const todaysPurchases = state.purchases.filter(p => {
        const pDate = new Date(p.date);
        pDate.setHours(0,0,0,0);
        return pDate.getTime() === targetStartOfDay.getTime();
    });
    const spentToday = todaysPurchases.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const todaysTopUps = (state.budgetTopUps || []).filter(t => {
        const tDate = new Date(t.date);
        tDate.setHours(0,0,0,0);
        return tDate.getTime() === targetStartOfDay.getTime();
    });
    const totalTopUpsToday = todaysTopUps.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const todaysIncomes = (state.incomes || []).filter(inc => {
        const iDate = new Date(inc.date);
        iDate.setHours(0,0,0,0);
        return iDate.getTime() === targetStartOfDay.getTime();
    });
    const totalIncomeToday = todaysIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);

    const currentQuota = baseDailyQuota + carryover + totalTopUpsToday + totalIncomeToday - spentToday;
    
    return {
        base: baseDailyQuota,
        quota: currentQuota,
        carryover: carryover
    };
}

function getRemainingBudgetForPeriod(targetDate) {
    const bounds = getPayPeriodBounds(targetDate);
    const periodPurchases = state.purchases.filter(p => {
        const pDate = new Date(p.date);
        return pDate >= bounds.startDate && pDate < bounds.endDate;
    });
    const periodIncomes = (state.incomes || []).filter(inc => {
        const iDate = new Date(inc.date);
        return iDate >= bounds.startDate && iDate < bounds.endDate;
    });
    const periodTopUps = getTopUpsForPeriod(targetDate);
    
    const totalSpent = periodPurchases.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalIncome = periodIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
    const totalTopUps = periodTopUps.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const baseBudget = (state.budgetType || 'monthly') === 'daily'
        ? ((state.dailyBudget || 0) * getDaysInPayPeriod(bounds.startDate, bounds.endDate))
        : (state.budget || 0);
        
    return baseBudget + totalTopUps + totalIncome - totalSpent;
}

function getPurchasesForPeriod(targetDate) {
    const bounds = getPayPeriodBounds(targetDate);
    return state.purchases.filter(p => {
        const pDate = new Date(p.date);
        return pDate >= bounds.startDate && pDate < bounds.endDate;
    });
}

// ===============================
// VISUALIZATIONS
// ===============================

function hexToRgbA(hex, alpha) {
    var c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return `rgba(16, 185, 129, ${alpha})`;
}

function updateChart() {
    const ctx = document.getElementById('category-chart');
    if (!ctx) return;

    const periodPurchases = getPurchasesForPeriod(viewingDate);
    const categoryTotals = {};
    periodPurchases.forEach(p => {
        if (!categoryTotals[p.category]) categoryTotals[p.category] = 0;
        categoryTotals[p.category] += parseFloat(p.amount);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    
    const baseColor = state.themeColor || '#b5eadd';
    const bgColors = labels.map((_, i) => hexToRgbA(baseColor, Math.max(0.3, 1 - (i * 0.15))));
    const borderColors = labels.map(() => state.isDarkMode ? '#0f172a' : '#ffffff');
    const textColor = state.isDarkMode ? '#f8fafc' : '#374151';

    if (pieChartInstance) {
        pieChartInstance.data.labels = labels;
        pieChartInstance.data.datasets[0].data = data;
        pieChartInstance.data.datasets[0].backgroundColor = bgColors;
        pieChartInstance.data.datasets[0].borderColor = borderColors;
        pieChartInstance.options.plugins.legend.labels.color = textColor;
        pieChartInstance.update();
    } else {
        pieChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: textColor, font: { family: 'Outfit' } }
                    }
                }
            }
        });
    }
}

function updateCalendar() {
    const monthDisplay = document.getElementById('cal-month-display');
    const grid = document.getElementById('calendar-grid');
    if (!monthDisplay || !grid) return;

    const year = calendarViewingDate.getFullYear();
    const month = calendarViewingDate.getMonth();
    
    monthDisplay.textContent = calendarViewingDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const headers = grid.querySelectorAll('.cal-day-header');
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-cell empty';
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        
        if (cellDate.toDateString() === viewingDate.toDateString()) {
            cell.classList.add('selected');
        }

        const dayPurchases = state.purchases.filter(p => new Date(p.date).toDateString() === cellDate.toDateString());
        const dayTotal = dayPurchases.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const dayIncomes = (state.incomes || []).filter(inc => new Date(inc.date).toDateString() === cellDate.toDateString());
        const dayIncomeTotal = dayIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);

        if (dayTotal > 0) cell.classList.add('has-spending');
        if (dayIncomeTotal > 0) cell.classList.add('has-income');

        const spendLine = dayTotal > 0 ? `<div class="cal-amount spent">-${formatMoney(dayTotal)}</div>` : '';
        const incomeLine = dayIncomeTotal > 0 ? `<div class="cal-amount income">+${formatMoney(dayIncomeTotal)}</div>` : '';

        cell.innerHTML = `
            <div class="cal-date">${day}</div>
            ${spendLine}${incomeLine}
        `;

        cell.onclick = () => {
            viewingDate = new Date(year, month, day);
            sounds.click();
            updateUI();
        };

        grid.appendChild(cell);
    }
}

// ===============================
// UI UPDATES
// ===============================

function formatMoney(amount) {
    return '£' + parseFloat(amount).toFixed(2);
}

function updateUI() {
    if (!currentGroupId) {
        document.getElementById('setup-modal').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        return;
    } else {
        document.getElementById('setup-modal').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    }

    const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    const todayStr = new Date().toDateString();
    const viewingStr = viewingDate.toDateString();
    
    if (todayStr === viewingStr) {
        document.getElementById('current-date-display').textContent = "Today";
        document.getElementById('quota-title').textContent = "Today's Quota";
        document.getElementById('purchases-title').textContent = "Recent Purchases";
    } else {
        document.getElementById('current-date-display').textContent = viewingDate.toLocaleDateString(undefined, dateOptions);
        document.getElementById('quota-title').textContent = "Daily Quota";
        document.getElementById('purchases-title').textContent = "Purchases on this date";
    }

    const { base, quota, carryover } = calculateQuotaForDate(viewingDate);
    
    const quotaEl = document.getElementById('daily-quota');
    quotaEl.textContent = formatMoney(quota);
    quotaEl.style.color = quota < 0 ? 'var(--danger-color)' : 'var(--text-primary)';

    document.getElementById('base-amount').textContent = formatMoney(base);

    const carryoverEl = document.getElementById('carryover-amount');
    carryoverEl.textContent = formatMoney(carryover);
    carryoverEl.className = carryover < 0 ? 'negative' : (carryover > 0 ? 'positive' : '');

    const remaining = getRemainingBudgetForPeriod(viewingDate);
    document.getElementById('remaining-budget').textContent = formatMoney(remaining);
    
    const bounds = getPayPeriodBounds(viewingDate);
    const daysInPeriod = getDaysInPayPeriod(bounds.startDate, bounds.endDate);
    const baseBudget = (state.budgetType || 'monthly') === 'daily'
        ? ((state.dailyBudget || 0) * daysInPeriod)
        : (state.budget || 0);
    const periodTopUps = getTopUpsForPeriod(viewingDate);
    const totalTopUps = periodTopUps.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalBudget = baseBudget + totalTopUps;
    
    const progressPercent = totalBudget > 0 ? Math.max(0, Math.min(100, (remaining / totalBudget) * 100)) : 0;
    const progressBar = document.getElementById('budget-progress');
    progressBar.style.width = `${progressPercent}%`;
    progressBar.style.background = progressPercent < 20 ? 'var(--danger-color)' : 'var(--accent-color)';

    // Update adjust budget form fields if visible
    const adjType = document.getElementById('adjust-budget-type');
    const adjAmt = document.getElementById('adjust-budget-amount');
    if (adjType && adjAmt) {
        adjType.value = state.budgetType || 'monthly';
        adjAmt.value = (state.budgetType || 'monthly') === 'daily' ? (state.dailyBudget || 0) : (state.budget || 0);
        const label = document.getElementById('adjust-budget-label');
        if (label) {
            label.textContent = (state.budgetType || 'monthly') === 'daily' ? "Daily Budget (£)" : "Monthly Budget (£)";
        }
    }

    // Toggle Remaining Budget visibility
    // Daily budget always hides it; monthly respects the manual toggle
    const isDaily = (state.budgetType || 'monthly') === 'daily';

    const hideRemaining = isDaily || !!state.hideRemainingBudget;
    const remainingCard = document.getElementById('remaining-budget-card');
    const dashboardSection = document.getElementById('dashboard-section');
    const hideCheckbox = document.getElementById('hide-remaining-budget');
    
    const showRemaining = !hideRemaining;

    if (remainingCard) {
        if (showRemaining) {
            remainingCard.classList.remove('hidden');
        } else {
            remainingCard.classList.add('hidden');
        }
    }

    const dbStreaksCard = document.getElementById('dashboard-streaks-card');
    if (dbStreaksCard) {
        dbStreaksCard.classList.remove('hidden');
    }

    const dbRightCol = document.getElementById('dashboard-right-col');
    if (dbRightCol) {
        dbRightCol.style.display = 'flex';
    }

    if (dashboardSection) {
        dashboardSection.classList.remove('full-width');
        dashboardSection.style.gridTemplateColumns = '2fr 1.2fr';
    }
    // Only show checkbox for monthly mode; hide it when daily (it's automatic)
    const checkboxWrapper = hideCheckbox ? hideCheckbox.closest('div') : null;
    if (checkboxWrapper) {
        checkboxWrapper.style.display = isDaily ? 'none' : 'flex';
    }
    if (hideCheckbox) {
        hideCheckbox.checked = hideRemaining;
    }

    const optOverspending = document.getElementById('streak-opt-overspending');
    const optTakeout = document.getElementById('streak-opt-takeout');
    const optSaving = document.getElementById('streak-opt-saving');
    if (optOverspending) optOverspending.checked = !!state.streakOptOverspending;
    if (optTakeout) optTakeout.checked = !!state.streakOptTakeout;
    if (optSaving) optSaving.checked = !!state.streakOptSaving;

    const catSelect = document.getElementById('purchase-category');
    Array.from(catSelect.options).forEach(opt => {
        if (!['Groceries', 'Transport', 'Entertainment', 'Takeout', 'Bills', 'Other', 'custom'].includes(opt.value)) {
            opt.remove();
        }
    });
    state.customCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        catSelect.insertBefore(option, catSelect.lastElementChild);
    });

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
    switchTab(activeTab);
}

function renderPurchases() {
    const list = document.getElementById('purchase-list');
    list.innerHTML = '';
    const viewStr = viewingDate.toDateString();
    const viewedPurchases = state.purchases.filter(p => new Date(p.date).toDateString() === viewStr).reverse();
    
    if (viewedPurchases.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary)">No purchases on this date.</li>';
        return;
    }

    viewedPurchases.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name">${p.category}</span>
                <span class="item-meta">${p.comment || 'No comment'}</span>
            </div>
            <div style="display:flex; align-items:center; gap: 10px;">
                <span class="item-amount">-${formatMoney(p.amount)}</span>
                <button class="btn icon-btn delete" onclick="deletePurchase('${p.id}')"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

function renderQuickAdds() {
    const grid = document.getElementById('quick-add-buttons');
    grid.innerHTML = '';
    state.quickAdds.forEach(qa => {
        const btn = document.createElement('div');
        btn.className = 'quick-add-item';
        btn.innerHTML = `
            <span class="qa-title">${qa.name}</span>
            <span class="qa-amount">${formatMoney(qa.amount)}</span>
            <button class="qa-delete" onclick="event.stopPropagation(); deleteQuickAdd('${qa.id}')"><i class="ri-close-line"></i></button>
        `;
        btn.onclick = () => doQuickAdd(qa);
        grid.appendChild(btn);
    });
}

function renderGroceries() {
    const list = document.getElementById('grocery-list');
    list.innerHTML = '';
    state.groceries.forEach(g => {
        const li = document.createElement('li');
        if (g.checked) li.classList.add('checked');
        
        let unitStr = g.unit ? ` ${g.unit}` : '';
        const qtyStr = g.qty ? `${g.qty}${unitStr} ` : '';
        
        li.innerHTML = `
            <span class="item-name">${qtyStr}${g.name}</span>
            <div style="display:flex; align-items:center; gap: 10px;">
                <button class="btn icon-btn delete" onclick="event.stopPropagation(); deleteGrocery('${g.id}')"><i class="ri-close-line"></i></button>
            </div>
        `;
        li.onclick = () => toggleGrocery(g.id);
        list.appendChild(li);
    });
}

function renderIncomes() {
    const list = document.getElementById('income-list');
    if (!list) return;
    list.innerHTML = '';
    const viewStr = viewingDate.toDateString();
    const viewedIncomes = (state.incomes || []).filter(inc => new Date(inc.date).toDateString() === viewStr).reverse();

    if (viewedIncomes.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary)">No income logged on this date.</li>';
        return;
    }

    viewedIncomes.forEach(inc => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name">${inc.note || 'Income'}</span>
            </div>
            <div style="display:flex; align-items:center; gap: 10px;">
                <span class="item-amount income">+${formatMoney(inc.amount)}</span>
                <button class="btn icon-btn delete" onclick="deleteIncome('${inc.id}')"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

// ===============================
// EVENT LISTENERS & ACTIONS
// ===============================

// Theme Toggle
document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    state.isDarkMode = !state.isDarkMode;
    sounds.click();
    syncState();
});

// Date Navigation
document.getElementById('prev-day').addEventListener('click', () => {
    viewingDate.setDate(viewingDate.getDate() - 1);
    if(viewingDate.getMonth() !== calendarViewingDate.getMonth()) {
        calendarViewingDate = new Date(viewingDate);
    }
    sounds.click();
    updateUI();
});

document.getElementById('next-day').addEventListener('click', () => {
    viewingDate.setDate(viewingDate.getDate() + 1);
    if(viewingDate.getMonth() !== calendarViewingDate.getMonth()) {
        calendarViewingDate = new Date(viewingDate);
    }
    sounds.click();
    updateUI();
});

// Calendar Navigation
document.getElementById('cal-prev-month').addEventListener('click', () => {
    calendarViewingDate.setMonth(calendarViewingDate.getMonth() - 1);
    sounds.click();
    updateUI();
});
document.getElementById('cal-next-month').addEventListener('click', () => {
    calendarViewingDate.setMonth(calendarViewingDate.getMonth() + 1);
    sounds.click();
    updateUI();
});

// Theme Picker
document.getElementById('theme-color-picker').addEventListener('input', (e) => {
    applyTheme(e.target.value);
});
document.getElementById('theme-color-picker').addEventListener('change', (e) => {
    state.themeColor = e.target.value;
    syncState();
});

// Tab Switching
document.getElementById('tab-login').addEventListener('click', () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-create').classList.remove('active');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('setup-form').classList.add('hidden');
    sounds.click();
});

document.getElementById('tab-create').addEventListener('click', () => {
    document.getElementById('tab-create').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('setup-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
    sounds.click();
});

// Join Group / Login Submission
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const gId = document.getElementById('login-group-id').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const password = document.getElementById('login-password').value;
    if (!gId) {
        alert("Please enter a valid Group ID.");
        return;
    }

    db.ref('groups/' + gId).once('value')
        .then((snapshot) => {
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
        .catch((error) => {
            console.error("Login once() check failed:", error);
            alert("Database Connection Failed: " + error.message);
        });
});

// Setup Budget Type Label Toggle
document.getElementById('setup-budget-type').addEventListener('change', (e) => {
    const label = document.getElementById('setup-budget-label');
    const monthLengthGroup = document.getElementById('setup-month-length-group');
    if (e.target.value === 'daily') {
        label.textContent = "Daily Budget (£)";
        if (monthLengthGroup) monthLengthGroup.classList.add('hidden');
    } else {
        label.textContent = "Monthly Budget (£)";
        if (monthLengthGroup) monthLengthGroup.classList.remove('hidden');
    }
});

// Setup Form Submission (New Group)
document.getElementById('setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const gId = document.getElementById('group-id').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!gId) {
        alert("Please enter a valid Group ID (letters, numbers, dashes, and underscores only).");
        return;
    }
    const setupPassword = document.getElementById('setup-password').value;
    const budgetType = document.getElementById('setup-budget-type').value;
    const budgetAmount = parseFloat(document.getElementById('setup-budget-amount').value);
    const payday = parseInt(document.getElementById('payday').value);
    const customMonthLength = parseInt(document.getElementById('custom-month-length').value) || 0;

    // Check if group already exists in Firebase using promise-based once() to capture errors
    db.ref('groups/' + gId).once('value')
        .then((snapshot) => {
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
                isDarkMode: false
            };
            joinGroup(gId, true, initialData);
        })
        .catch((error) => {
            console.error("Firebase database once() error:", error);
            alert("Database Connection Failed.\n\nDetails: " + error.message);
        });
});

// Reset app / Leave Group
document.getElementById('reset-app').addEventListener('click', () => {
    if (confirm('Do you want to sign out and leave this group? (Your group\'s data on Firebase will NOT be deleted).')) {
        sounds.delete();
        localStorage.removeItem('aura_group_id');
        currentGroupId = null;
        if (dbRef) {
            dbRef.off();
            dbRef = null;
        }
        state = {
            budget: 0, payday: 1, customMonthLength: 0, customCategories: [], purchases: [],
            quickAdds: [], groceries: [], themeColor: '#b5eadd', isDarkMode: false,
            streakOptOverspending: false, streakStartOverspending: null,
            streakOptTakeout: false, streakStartTakeout: null,
            streakOptSaving: false, streakStartSaving: null
        };
        viewingDate = new Date();
        calendarViewingDate = new Date();
        updateUI();
    }
});

document.getElementById('purchase-category').addEventListener('change', (e) => {
    const customGroup = document.getElementById('custom-category-group');
    if (e.target.value === 'custom') {
        customGroup.classList.remove('hidden');
        document.getElementById('custom-category-input').required = true;
    } else {
        customGroup.classList.add('hidden');
        document.getElementById('custom-category-input').required = false;
    }
});

document.getElementById('purchase-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('purchase-amount').value);
    let category = document.getElementById('purchase-category').value;
    
    if (category === 'custom') {
        category = document.getElementById('custom-category-input').value.trim();
        if (!state.customCategories.includes(category)) {
            state.customCategories.push(category);
        }
    }

    const comment = document.getElementById('purchase-comment').value;

    state.purchases.push({
        id: Date.now().toString(),
        amount,
        category,
        comment,
        date: viewingDate.toISOString()
    });

    sounds.success();
    e.target.reset();
    document.getElementById('custom-category-group').classList.add('hidden');
    syncState();
});

document.getElementById('quick-add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.quickAdds.push({
        id: Date.now().toString(),
        name: document.getElementById('qa-name').value,
        amount: parseFloat(document.getElementById('qa-amount').value)
    });
    sounds.click();
    e.target.reset();
    syncState();
});

document.getElementById('grocery-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.groceries.push({
        id: Date.now().toString(),
        name: document.getElementById('grocery-name').value,
        qty: parseInt(document.getElementById('grocery-qty').value) || 1,
        unit: document.getElementById('grocery-unit').value,
        checked: false
    });
    sounds.click();
    e.target.reset();
    document.getElementById('grocery-qty').value = 1;
    document.getElementById('grocery-unit').value = '';
    syncState();
});

// Globals
window.doQuickAdd = (qa) => {
    state.purchases.push({
        id: Date.now().toString(),
        amount: qa.amount,
        category: qa.name,
        comment: 'Quick Add',
        date: viewingDate.toISOString() 
    });
    sounds.success();
    syncState();
};

window.deleteQuickAdd = (id) => {
    state.quickAdds = state.quickAdds.filter(q => q.id !== id);
    sounds.delete();
    syncState();
};

window.deletePurchase = (id) => {
    state.purchases = state.purchases.filter(p => p.id !== id);
    sounds.delete();
    syncState();
};

window.deleteGrocery = (id) => {
    state.groceries = state.groceries.filter(g => g.id !== id);
    sounds.delete();
    syncState();
};

window.toggleGrocery = (id) => {
    const item = state.groceries.find(g => g.id === id);
    if (item) {
        item.checked = !item.checked;
        sounds.click();
        syncState();
    }
};

// Income Form
document.getElementById('income-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('income-amount').value);
    const note = document.getElementById('income-note').value.trim() || 'Income';
    if (!amount || amount <= 0) return;

    if (!state.incomes) state.incomes = [];
    state.incomes.push({
        id: Date.now().toString(),
        amount,
        note,
        date: viewingDate.toISOString()
    });

    sounds.success();
    e.target.reset();
    syncState();
});

window.deleteIncome = (id) => {
    state.incomes = (state.incomes || []).filter(inc => inc.id !== id);
    sounds.delete();
    syncState();
};

// Adjust budget form event listener
document.getElementById('adjust-budget-type').addEventListener('change', (e) => {
    const label = document.getElementById('adjust-budget-label');
    if (e.target.value === 'daily') {
        label.textContent = "Daily Budget (£)";
    } else {
        label.textContent = "Monthly Budget (£)";
    }
});

document.getElementById('adjust-budget-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('adjust-budget-type').value;
    const amount = parseFloat(document.getElementById('adjust-budget-amount').value);
    
    state.budgetType = type;
    if (type === 'daily') {
        state.dailyBudget = amount;
    } else {
        state.budget = amount;
    }
    
    sounds.success();
    syncState();
    alert("Base budget updated successfully!");
});

// Top-up budget form event listener (conditional since form is removed)
const topupForm = document.getElementById('topup-budget-form');
if (topupForm) {
    topupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('topup-amount').value);
        const note = document.getElementById('topup-note').value.trim() || 'Budget Top-up';
        if (!amount || amount <= 0) return;

        if (!state.budgetTopUps) state.budgetTopUps = [];
        state.budgetTopUps.push({
            id: Date.now().toString(),
            amount,
            note,
            date: viewingDate.toISOString()
        });

        sounds.success();
        e.target.reset();
        syncState();
    });
}

window.deleteTopUp = (id) => {
    state.budgetTopUps = (state.budgetTopUps || []).filter(t => t.id !== id);
    sounds.delete();
    syncState();
};

function renderTopUps() {
    const list = document.getElementById('topup-list');
    if (!list) return;
    list.innerHTML = '';
    const bounds = getPayPeriodBounds(viewingDate);
    const periodTopUps = (state.budgetTopUps || []).filter(t => {
        const tDate = new Date(t.date);
        return tDate >= bounds.startDate && tDate < bounds.endDate;
    }).reverse();

    if (periodTopUps.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary); font-size: 0.85rem; padding: 6px;">No top-ups in this period.</li>';
        return;
    }

    periodTopUps.forEach(t => {
        const li = document.createElement('li');
        li.style.padding = '8px 12px';
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name" style="font-size: 0.9rem;">${t.note}</span>
                <span class="item-meta" style="font-size: 0.75rem;">${new Date(t.date).toLocaleDateString()}</span>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                <span class="item-amount" style="color: var(--success-color); font-size: 0.9rem;">+${formatMoney(t.amount)}</span>
                <button class="btn icon-btn delete" style="padding: 4px;" onclick="deleteTopUp('${t.id}')"><i class="ri-close-line"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

// Toggle link to group container in debt form
document.getElementById('debt-is-linked').addEventListener('change', (e) => {
    const container = document.getElementById('debt-link-group-id-container');
    const input = document.getElementById('debt-link-group-id');
    if (e.target.checked) {
        container.classList.remove('hidden');
        input.required = true;
    } else {
        container.classList.add('hidden');
        input.required = false;
    }
});

// Debt Form event listener
document.getElementById('debt-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('debt-type').value;
    const person = document.getElementById('debt-person').value.trim();
    const amount = parseFloat(document.getElementById('debt-amount').value);
    const note = document.getElementById('debt-note').value.trim() || 'Debt';
    const isLinked = document.getElementById('debt-is-linked').checked;
    const targetGroupId = document.getElementById('debt-link-group-id').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');

    if (!person || !amount || amount <= 0) return;

    if (isLinked) {
        if (!targetGroupId) {
            alert("Please enter a valid Target Group ID.");
            return;
        }
        if (targetGroupId === currentGroupId) {
            alert("You cannot link a debt to your own Group ID.");
            return;
        }
        
        db.ref('groups/' + targetGroupId).once('value')
            .then((snapshot) => {
                const targetData = snapshot.val();
                if (!targetData) {
                    alert(`Target Group ID "${targetGroupId}" does not exist in the database.`);
                    sounds.error();
                    return;
                }
                
                const debtId = Date.now().toString();
                
                db.ref('groups/' + targetGroupId).transaction((groupData) => {
                    if (!groupData) return groupData;
                    
                    if (type === 'owed_by_me') {
                        if (!groupData.purchases) groupData.purchases = [];
                        groupData.purchases.push({
                            id: Date.now().toString() + '-target-debt-out',
                            amount: amount,
                            category: 'Debt',
                            comment: `[Debt Lent] to Group: ${currentGroupId}`,
                            date: viewingDate.toISOString()
                        });
                    } else if (type === 'owed_to_me') {
                        if (!groupData.incomes) groupData.incomes = [];
                        groupData.incomes.push({
                            id: Date.now().toString() + '-target-debt-in',
                            amount: amount,
                            category: 'Debt',
                            comment: `[Debt Borrowed] from Group: ${currentGroupId}`,
                            date: viewingDate.toISOString()
                        });
                    }
                    
                    if (!groupData.debts) groupData.debts = [];
                    groupData.debts.push({
                        id: debtId,
                        type: type === 'owed_by_me' ? 'owed_to_me' : 'owed_by_me',
                        person: currentGroupId,
                        amount: amount,
                        note: `Linked Debt: ${note}`,
                        linkedGroupId: currentGroupId,
                        status: 'outstanding',
                        date: viewingDate.toISOString()
                    });
                    
                    return groupData;
                }, (error, committed) => {
                    if (error) {
                        console.error("Linked transaction failed:", error);
                        alert("Failed to link debt to target group: " + error.message);
                    } else if (committed) {
                        if (type === 'owed_by_me') {
                            if (!state.incomes) state.incomes = [];
                            state.incomes.push({
                                id: debtId + '-local-debt-in',
                                amount: amount,
                                category: 'Debt',
                                comment: `[Debt Borrowed] from Group: ${targetGroupId}`,
                                date: viewingDate.toISOString()
                            });
                        } else if (type === 'owed_to_me') {
                            if (!state.purchases) state.purchases = [];
                            state.purchases.push({
                                id: debtId + '-local-debt-out',
                                amount: amount,
                                category: 'Debt',
                                comment: `[Debt Lent] to Group: ${targetGroupId}`,
                                date: viewingDate.toISOString()
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
                            date: viewingDate.toISOString()
                        });
                        
                        sounds.success();
                        e.target.reset();
                        document.getElementById('debt-link-group-id-container').classList.add('hidden');
                        document.getElementById('debt-link-group-id').required = false;
                        syncState();
                    }
                });
            })
            .catch(err => {
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
            date: viewingDate.toISOString()
        });

        sounds.success();
        e.target.reset();
        syncState();
    }
});

window.settleDebt = (id) => {
    const debt = (state.debts || []).find(d => d.id === id);
    if (!debt) return;

    if (debt.linkedGroupId) {
        db.ref('groups/' + debt.linkedGroupId).transaction((groupData) => {
            if (!groupData) return groupData;
            
            if (groupData.debts) {
                const targetDebt = groupData.debts.find(d => d.id === id);
                if (targetDebt) {
                    targetDebt.status = 'settled';
                }
            }
            
            if (debt.type === 'owed_by_me') {
                if (!groupData.incomes) groupData.incomes = [];
                groupData.incomes.push({
                    id: Date.now().toString() + '-target-settle-in',
                    amount: debt.amount,
                    category: 'Debt',
                    comment: `[Debt Repayment Received] from Group: ${currentGroupId}`,
                    date: viewingDate.toISOString()
                });
            } else if (debt.type === 'owed_to_me') {
                if (!groupData.purchases) groupData.purchases = [];
                groupData.purchases.push({
                    id: Date.now().toString() + '-target-settle-out',
                    amount: debt.amount,
                    category: 'Debt',
                    comment: `[Debt Repaid] to Group: ${currentGroupId}`,
                    date: viewingDate.toISOString()
                });
            }
            
            return groupData;
        }, (error, committed) => {
            if (error) {
                console.error("Linked settle transaction failed:", error);
                alert("Failed to settle linked debt on target group: " + error.message);
            } else if (committed) {
                if (debt.type === 'owed_to_me') {
                    if (!state.incomes) state.incomes = [];
                    state.incomes.push({
                        id: Date.now().toString() + '-local-settle-in',
                        amount: debt.amount,
                        category: 'Debt',
                        comment: `[Debt Repayment Received] from Group: ${debt.linkedGroupId}`,
                        date: viewingDate.toISOString()
                    });
                } else if (debt.type === 'owed_by_me') {
                    if (!state.purchases) state.purchases = [];
                    state.purchases.push({
                        id: Date.now().toString() + '-local-settle-out',
                        amount: debt.amount,
                        category: 'Debt',
                        comment: `[Debt Repaid] to Group: ${debt.linkedGroupId}`,
                        date: viewingDate.toISOString()
                    });
                }
                
                debt.status = 'settled';
                sounds.success();
                syncState();
            }
        });
    } else {
        let logToBudget = false;
        if (debt.type === 'owed_by_me') {
            logToBudget = confirm(`Do you want to log settling this debt of ${formatMoney(debt.amount)} to ${debt.person} as an Expense (Purchase) in your budget?`);
        } else {
            logToBudget = confirm(`Do you want to log receiving ${formatMoney(debt.amount)} from ${debt.person} as Income in your budget?`);
        }

        if (logToBudget) {
            if (debt.type === 'owed_by_me') {
                state.purchases.push({
                    id: Date.now().toString(),
                    amount: debt.amount,
                    category: 'Bills',
                    comment: `Settle debt to ${debt.person}: ${debt.note}`,
                    date: viewingDate.toISOString()
                });
            } else {
                if (!state.incomes) state.incomes = [];
                state.incomes.push({
                    id: Date.now().toString(),
                    amount: debt.amount,
                    note: `Settle loan to ${debt.person}: ${debt.note}`,
                    date: viewingDate.toISOString()
                });
            }
        }

        debt.status = 'settled';
        sounds.success();
        syncState();
    }
};

window.deleteDebt = (id) => {
    state.debts = (state.debts || []).filter(d => d.id !== id);
    sounds.delete();
    syncState();
};

function renderDebts() {
    const list = document.getElementById('debt-list');
    if (!list) return;
    list.innerHTML = '';
    const activeDebts = (state.debts || []).filter(d => d.status === 'outstanding').reverse();

    if (activeDebts.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary); font-size: 0.85rem; padding: 6px;">No active debts.</li>';
        return;
    }

    activeDebts.forEach(d => {
        const li = document.createElement('li');
        const isOwedByMe = d.type === 'owed_by_me';
        const colorClass = isOwedByMe ? 'negative' : 'positive';
        const typeLabel = isOwedByMe ? `You owe ${d.person}` : `${d.person} owes you`;
        
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name" style="font-size: 0.95rem;">${typeLabel}</span>
                <span class="item-meta" style="font-size: 0.8rem;">${d.note} (${new Date(d.date).toLocaleDateString()})</span>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                <span class="item-amount ${colorClass}" style="font-size: 0.95rem;">
                    ${isOwedByMe ? '-' : '+'}${formatMoney(d.amount)}
                </span>
                <button class="btn icon-btn" style="padding: 4px; color: var(--success-color);" onclick="settleDebt('${d.id}')" title="Settle"><i class="ri-checkbox-circle-line"></i></button>
                <button class="btn icon-btn delete" style="padding: 4px;" onclick="deleteDebt('${d.id}')" title="Delete"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

// Hide remaining budget toggle listener
document.getElementById('hide-remaining-budget').addEventListener('change', (e) => {
    state.hideRemainingBudget = e.target.checked;
    sounds.click();
    syncState();
});

// Streaks settings toggle listeners
document.getElementById('streak-opt-overspending').addEventListener('change', (e) => {
    state.streakOptOverspending = e.target.checked;
    if (e.target.checked) {
        if (!state.streakStartOverspending) {
            state.streakStartOverspending = new Date().toISOString();
        }
    } else {
        state.streakStartOverspending = null;
    }
    sounds.click();
    syncState();
});

document.getElementById('streak-opt-takeout').addEventListener('change', (e) => {
    state.streakOptTakeout = e.target.checked;
    if (e.target.checked) {
        if (!state.streakStartTakeout) {
            state.streakStartTakeout = new Date().toISOString();
        }
    } else {
        state.streakStartTakeout = null;
    }
    sounds.click();
    syncState();
});

document.getElementById('streak-opt-saving').addEventListener('change', (e) => {
    state.streakOptSaving = e.target.checked;
    if (e.target.checked) {
        if (!state.streakStartSaving) {
            state.streakStartSaving = new Date().toISOString();
        }
    } else {
        state.streakStartSaving = null;
    }
    sounds.click();
    syncState();
});

// Global click sound
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('delete') && !e.target.classList.contains('qa-delete')) {
        if(e.target.type !== 'submit') sounds.click();
    }
});

function switchTab(tabName) {
    activeTab = tabName;
    
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
        'card-groceries',
        'card-add-income',
        'card-manage-budget',
        'card-debts-tracker',
        'card-subscriptions',
        'card-streaks'
    ];
    cardIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.maxWidth = '';
            el.style.margin = '';
        }
    });

    // Display appropriate card(s)
    const gridLayout = document.querySelector('.grid-layout');
    if (!gridLayout) return;

    const isDaily = (state.budgetType || 'monthly') === 'daily';

    if (tabName === 'expenses') {
        gridLayout.classList.remove('two-cols');
        gridLayout.style.display = 'grid';
        ['card-log-purchase', 'card-quick-add', 'card-groceries'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
    } else if (tabName === 'budget') {
        gridLayout.classList.add('two-cols');
        gridLayout.style.display = 'grid';
        ['card-streaks', 'card-manage-budget'].forEach(id => {
            const el = document.getElementById(id);
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
            const el = document.getElementById(targetId);
            if (el) {
                el.classList.remove('hidden');
                el.style.maxWidth = '600px';
                el.style.margin = '0 auto';
            }
        }
    }
}

// Attach app tab button listeners
document.querySelectorAll('.app-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        switchTab(tab);
    });
});

// Subscription Form listener
document.getElementById('subscription-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('sub-name').value.trim();
    const amount = parseFloat(document.getElementById('sub-amount').value);
    const day = parseInt(document.getElementById('sub-day').value);
    
    if (!name || !amount || amount <= 0 || !day || day < 1 || day > 31) return;
    
    if (!state.subscriptions) state.subscriptions = [];
    
    state.subscriptions.push({
        id: Date.now().toString(),
        name,
        amount,
        billingDay: day
    });
    
    sounds.success();
    e.target.reset();
    
    checkAndApplySubscriptions();
    syncState();
});

function renderSubscriptions() {
    const list = document.getElementById('subscription-list');
    if (!list) return;
    list.innerHTML = '';
    
    const subs = state.subscriptions || [];
    const totalCostEl = document.getElementById('sub-total-cost');
    
    if (subs.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color: var(--text-secondary); font-size: 0.85rem; padding: 6px;">No active subscriptions.</li>';
        if (totalCostEl) totalCostEl.textContent = formatMoney(0);
        return;
    }
    
    let totalCost = 0;
    subs.forEach(s => {
        totalCost += parseFloat(s.amount) || 0;
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-details">
                <span class="item-name" style="font-size: 0.95rem;">${s.name}</span>
                <span class="item-meta" style="font-size: 0.8rem;">Billed on day ${s.billingDay} of month</span>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                <span class="item-amount negative" style="font-size: 0.95rem;">-${formatMoney(s.amount)}</span>
                <button class="btn icon-btn delete" style="padding: 4px;" onclick="deleteSubscription('${s.id}')" title="Delete"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
    
    if (totalCostEl) totalCostEl.textContent = formatMoney(totalCost);
}

window.deleteSubscription = (id) => {
    state.subscriptions = (state.subscriptions || []).filter(s => s.id !== id);
    sounds.delete();
    syncState();
};

function checkAndApplySubscriptions() {
    if (!state.subscriptions || !currentGroupId) return;
    
    const bounds = getPayPeriodBounds(new Date());
    const start = bounds.startDate;
    const end = bounds.endDate;
    
    let needsSync = false;
    
    state.subscriptions.forEach(sub => {
        let billDate = new Date(start.getFullYear(), start.getMonth(), sub.billingDay);
        billDate.setHours(0, 0, 0, 0);
        
        if (billDate.getTime() < start.getTime()) {
            billDate.setMonth(billDate.getMonth() + 1);
        }
        
        if (billDate.getTime() >= start.getTime() && billDate.getTime() < end.getTime()) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (today.getTime() >= billDate.getTime()) {
                const alreadyLogged = (state.purchases || []).some(p => {
                    const pDate = new Date(p.date);
                    pDate.setHours(0, 0, 0, 0);
                    return p.subscriptionId === sub.id && pDate.getTime() === billDate.getTime();
                });
                
                if (!alreadyLogged) {
                    if (!state.purchases) state.purchases = [];
                    state.purchases.push({
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                        amount: parseFloat(sub.amount),
                        category: 'Bills',
                        comment: `[Subscription] ${sub.name}`,
                        date: billDate.toISOString(),
                        subscriptionId: sub.id
                    });
                    needsSync = true;
                }
            }
        }
    });
    
    if (needsSync) {
        syncState();
    }
}

function calculateStreakForType(type) {
    let startStr = null;
    if (type === 'overspending') startStr = state.streakStartOverspending;
    else if (type === 'takeout') startStr = state.streakStartTakeout;
    else if (type === 'saving') startStr = state.streakStartSaving;

    if (!startStr) return 0;

    const startDate = new Date(startStr);
    startDate.setHours(0,0,0,0);

    const startFromDate = new Date(viewingDate || new Date());
    startFromDate.setHours(0,0,0,0);

    if (startFromDate < startDate) return 0;

    let streak = 0;
    let target = new Date(startFromDate);

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

function renderStreaks() {
    const showOverspending = !!state.streakOptOverspending;
    const showTakeout = !!state.streakOptTakeout;
    const showSaving = !!state.streakOptSaving;

    const buildHTML = (containerId, activeTitleId) => {
        const container = document.getElementById(containerId);
        const activeTitle = document.getElementById(activeTitleId);
        if (!container) return;

        if (!showOverspending && !showTakeout && !showSaving) {
            if (activeTitle) activeTitle.style.display = 'none';
            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size: 0.95rem; margin-top: 10px;">No streaks enabled. Check options above to begin tracking.</div>';
            return;
        }

        if (activeTitle) activeTitle.style.display = 'flex';
        container.innerHTML = '';

        const renderItem = (title, streakCount, startDateStr, color) => {
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
            container.appendChild(div);
        };

        if (showOverspending) {
            const count = calculateStreakForType('overspending');
            renderItem('No Overspending', count, state.streakStartOverspending, 'var(--success-color)');
        }
        if (showTakeout) {
            const count = calculateStreakForType('takeout');
            renderItem('No Takeout', count, state.streakStartTakeout, '#38ef7d');
        }
        if (showSaving) {
            const count = calculateStreakForType('saving');
            renderItem('Surplus / Savings', count, state.streakStartSaving, '#54a0ff');
        }
    };

    buildHTML('streaks-container', 'active-streaks-title');
    buildHTML('dashboard-streaks-container', 'dashboard-active-streaks-title');
}
