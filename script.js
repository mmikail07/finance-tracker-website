document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication Check ---
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // --- DOM Elements ---
    const bodyEl = document.body;
    const rightSidebar = document.getElementById('right-sidebar');
    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    const welcomeElement = document.getElementById('welcome-message');
    const incomeAmountInput = document.getElementById('income-amount');
    const addIncomeBtn = document.getElementById('add-income-btn');
    const expenseAmountInput = document.getElementById('expense-amount');
    const expenseCategorySelect = document.getElementById('expense-category');
    const addExpenseBtn = document.getElementById('add-expense-btn');
    const totalIncomeEl = document.getElementById('total-income');
    const totalExpensesEl = document.getElementById('total-expenses');
    const balanceEl = document.getElementById('balance');
    const activityList = document.getElementById('activity-list');
    const statsList = document.getElementById('stats-list');
    const resetDataBtn = document.getElementById('reset-data-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const pieChartCanvas = document.getElementById('expensePieChart');
    const noChartDataMsg = document.getElementById('no-chart-data');
    const saveGoalBtn = document.getElementById('save-settings-btn');
    const monthlyGoalInput = document.getElementById('monthly-goal');
    const notificationEl = document.getElementById('notification');

    // Load and save monthly goal
    if (saveGoalBtn && monthlyGoalInput) {
        const savedGoal = localStorage.getItem('monthlyGoal');
        if (savedGoal) monthlyGoalInput.value = savedGoal;

        saveGoalBtn.addEventListener('click', () => {
            const goalValue = +monthlyGoalInput.value;
            if (isNaN(goalValue) || goalValue <= 0) {
                alert('Please enter a valid saving goal.');
                return;
            }
            localStorage.setItem('monthlyGoal', goalValue);
            alert('Saving goal updated!');
            updateSummary(); // Re-check goal after saving
        });
    }
    
    let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    let expensePieChartInstance = null;

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
    }

    function updateSummary() {
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const balance = income - expenses;

        if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(income);
        if (totalExpensesEl) totalExpensesEl.textContent = formatCurrency(expenses);
        if (balanceEl) {
            balanceEl.textContent = formatCurrency(balance);
            balanceEl.style.color = balance >= 0 ? '#27ae60' : '#c0392b';
            const balanceBox = balanceEl.closest('.summary-box');
            if (balanceBox) balanceBox.style.borderColor = balance >= 0 ? '#C2F5C6' : '#FFD2D2';
        }

        // --- Notification System ---
        const monthlyGoal = +localStorage.getItem('monthlyGoal') || 0;
        if (notificationEl) {
            if (monthlyGoal > 0) {
                const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
                if (balance >= monthlyGoal) {
                    notificationEl.textContent = `🎉 Great! You've met your monthly saving goal of £${monthlyGoal}.`;
                    notificationEl.className = 'notification-message success';
                    notificationEl.style.display = 'block';
                } else if (totalExpenses >= monthlyGoal) {
                    notificationEl.textContent = `⚠️ Warning: Your expenses have reached or exceeded your monthly saving goal of £${monthlyGoal}. Consider reviewing your spending.`;
                    notificationEl.className = 'notification-message warning';
                    notificationEl.style.display = 'block';
                } else if (balance >= monthlyGoal * 0.75) {
                    notificationEl.textContent = `You're 75% of the way to your monthly saving goal of £${monthlyGoal}. Keep going!`;
                    notificationEl.className = 'notification-message';
                    notificationEl.style.display = 'block';
                } else if (balance > 0 && balance < monthlyGoal * 0.25) {
                    notificationEl.textContent = `⚠️ You're close to finishing your savings goal. Current balance: £${balance.toFixed(2)}.`;
                    notificationEl.className = 'notification-message warning';
                    notificationEl.style.display = 'block';
                } else if (balance < 0) {
                    notificationEl.textContent = `⚠️ Warning: You've spent more than you've earned this month.`;
                    notificationEl.className = 'notification-message warning';
                    notificationEl.style.display = 'block';
                } else {
                    notificationEl.style.display = 'none';
                }
            } else {
                notificationEl.style.display = 'none';
            }
        }
    }

    function addTransactionToDOM(transaction) {
        if (!activityList) return;
        const item = document.createElement('li');
        item.classList.add(transaction.type);

        const descriptionSpan = document.createElement('span');
        descriptionSpan.classList.add('description');
        descriptionSpan.textContent = transaction.type === 'income' ? 'Income' : transaction.category;

        const amountSpan = document.createElement('span');
        amountSpan.classList.add('amount');
        amountSpan.textContent = `${transaction.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(transaction.amount))}`;

        item.appendChild(descriptionSpan);
        item.appendChild(amountSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = () => removeTransaction(transaction.id);
        item.appendChild(deleteBtn);

        activityList.insertBefore(item, activityList.firstChild);

        const placeholder = activityList.querySelector('li:only-child');
        if (placeholder && placeholder.textContent.includes('No transactions yet')) placeholder.remove();
    }

    function calculateExpensesByCategory() {
        return transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
            const cat = t.category || 'Other';
            acc[cat] = (acc[cat] || 0) + t.amount;
            return acc;
        }, {});
    }

    function renderPieChart() {
        if (!pieChartCanvas) return;
        const ctx = pieChartCanvas.getContext('2d');
        const data = calculateExpensesByCategory();
        const categories = Object.keys(data);
        const amounts = Object.values(data);

        if (expensePieChartInstance) expensePieChartInstance.destroy();

        if (categories.length === 0) {
            pieChartCanvas.style.display = 'none';
            if (noChartDataMsg) noChartDataMsg.style.display = 'block';
            return;
        }

        pieChartCanvas.style.display = 'block';
        if (noChartDataMsg) noChartDataMsg.style.display = 'none';

        expensePieChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: categories,
                datasets: [{
                    data: amounts,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}`
                        }
                    }
                }
            }
        });
    }

    function addTransaction(type, amount, category = null) {
        const amt = +amount;
        if (isNaN(amt) || amt <= 0 || (type === 'expense' && !category)) return alert('Invalid input.');
        const tx = { id: Date.now().toString(), type, amount: amt, category, timestamp: new Date().toISOString() };
        transactions.push(tx);
        saveTransactions();
        init();
    }

    function removeTransaction(id) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        init();
    }

    function saveTransactions() {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }

    function clearInputs(type) {
        if (type === 'income' && incomeAmountInput) incomeAmountInput.value = '';
        if (type === 'expense') {
            if (expenseAmountInput) expenseAmountInput.value = '';
            if (expenseCategorySelect) expenseCategorySelect.selectedIndex = 0;
        }
    }

    function toggleRightSidebar(show) {
        const shouldShow = show && window.innerWidth > 1200;
        if (rightSidebar) rightSidebar.classList.toggle('hidden', !shouldShow);
        bodyEl.style.paddingRight = shouldShow ? '280px' : '0px';
    }

    function init() {
        activityList.innerHTML = '';
        transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(addTransactionToDOM);
        if (transactions.length === 0) activityList.innerHTML = '<li>No transactions yet.</li>';
        updateSummary();
        renderPieChart();
        toggleRightSidebar(document.querySelector('.content-section.active')?.id === 'dashboard');
    }

    // Event Listeners
    if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => addTransaction('income', incomeAmountInput.value));
    if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => addTransaction('expense', expenseAmountInput.value, expenseCategorySelect.value));
    if (resetDataBtn) resetDataBtn.addEventListener('click', () => {
        if (confirm('Reset all data?')) {
            transactions = [];
            localStorage.removeItem('transactions');
            init();
        }
    });
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
    navLinks.forEach(link => link.addEventListener('click', (e) => {
        const targetId = link.dataset.target;
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        contentSections.forEach(sec => sec.classList.remove('active'));
        link.classList.add('active');
        document.getElementById(targetId)?.classList.add('active');
        toggleRightSidebar(targetId === 'dashboard');
    }));
    window.addEventListener('resize', () => {
        toggleRightSidebar(document.querySelector('.content-section.active')?.id === 'dashboard');
    });

    const userFirstName = localStorage.getItem('userFirstName');
    if (welcomeElement && userFirstName) {
        welcomeElement.textContent = `Welcome, ${userFirstName}!`;
    }

    init();
});
