        /*
         * =================================================================================================
         * 중요: Firestore 보안 규칙 안내 (Important: Firestore Security Rules Guide)
         * =================================================================================================
         *
         * 앱 기능이 "Missing or insufficient permissions" 오류와 함께 실패하는 경우,
         * 이는 Firebase의 보안 규칙이 데이터 조회를 차단하고 있기 때문입니다.
         * 아래 규칙 전체를 복사하여 Firebase 프로젝트의 [Firestore Database > 규칙] 탭에 붙여넣어 주세요.
         *
         */
        // --- COPY FROM HERE ---
        
        // rules_version = '2';
        // service cloud.firestore {
        //  match /databases/{database}/documents {
        //
        //    function isTeacher() {
        //      return request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
        //    }
        //
        //    match /users/{userId} {
        //      allow get: if request.auth.uid == userId || isTeacher();
        //      allow update: if request.auth.uid == userId || isTeacher();
        //      allow delete: if isTeacher();
        //      
        //      // Allow user creation (registration)
        //      allow create: if true; 
        //      
        //      // Allow LIST operations ONLY for teachers.
        //      allow list: if isTeacher();
        //      
        //      match /assignedHomework/{homeworkId} {
        //        allow read, write: if request.auth.uid == userId || isTeacher();
        //      }
        //      
        //      match /assignedLifeRules/{ruleId} {
        //          allow read, write: if request.auth.uid == userId || isTeacher();
        //      }
        //    }
        //
        //    match /stocks/{stockId} {
        //        allow read: if true;
        //        allow write: if isTeacher();
        //    }
        //
        //    match /shopItems/{itemId} {
        //        allow read: if true;
        //        allow write: if isTeacher();
        //    }
        //    
        //    match /learningProblems/{problemId} {
        //        allow read: if true;
        //        allow write: if isTeacher();
        //    }
        //    
        //    match /lifeRules/{ruleId} {
        //        allow read: if request.auth != null;
        //        allow write: if isTeacher();
        //    }
        //
        //    match /metadata/{docId} {
        //      // Allow anyone to read/write the counters doc for registration.
        //      // Only teachers can access other metadata docs.
        //      allow read, write: if docId == 'counters' || isTeacher();
        //    }
        //
        //    match /purchaseLog/{logId} {
        //        allow create: if request.auth != null; // Allow any authenticated user to create a log (i.e., make a purchase)
        //        allow read, list: if isTeacher(); // Only teachers can read the logs
        //    }
        //
        //    match /signupLog/{logId} {
        //        allow create: if request.auth != null; // Log new sign-ups
        //        allow read, list: if isTeacher();
        //    }
        //  }
        // }
        
        // --- END COPY ---

        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, runTransaction, updateDoc, increment, deleteField, serverTimestamp, Timestamp, orderBy, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

        // IMPORTANT: Replace with your actual Firebase config
        const firebaseConfig = {
            apiKey: "AIzaSyDCeJPDQUNi-KmJ9DhkTRIu-9t2PGZCpt0",
            authDomain: "mansungcoin-c6e06.firebaseapp.com",
            projectId: "mansungcoin-c6e06",
            storageBucket: "mansungcoin-c6e06.appspot.com",
            messagingSenderId: "704809284946",
            appId: "1:704809284946:web:3e71d98f38810577e1768b"
        };
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const functions = getFunctions(app, 'asia-northeast3');

        // --- Global State ---
        let currentAuthUser = null;
        let currentUserData = null; // Currently logged-in user
        let viewedUserData = null; // For admin viewing a student's dashboard
        let isAdminViewing = false; // Flag for admin view mode
        let stockDataCache = {};
        let stockUpdateInterval = null;
        let assetChartInstance = null;
        const stockChartInstances = {};
        const MAX_HISTORY_LENGTH = 200;
        let currentProblemSet = null; // For AI problem creation
        let currentAssignmentId = null; // For student homework completion
        let currentAssignmentItemId = null; // For teacher assignment (homework or life rule)
        let currentAssignmentType = null; // 'math', 'dictation', or 'lifeRule'
        let currentDictationTemplate = null; // For student dictation homework

        // --- DOM Elements ---
        const views = {
            login: document.getElementById('login-view'),
            studentRegister: document.getElementById('student-register-view'),
            dashboard: document.getElementById('dashboard-container'),
            admin: document.getElementById('admin-view'),
        };
        let modal = document.getElementById('modal');
        let modalTitle = document.getElementById('modal-title');
        let modalMessage = document.getElementById('modal-message');
        let modalCloseBtn = document.getElementById('modal-close-btn');
        let modalConfirmBtn = document.getElementById('modal-confirm-btn');
        const aiContentModal = document.getElementById('aiContentModal');
        const aiModalTitle = document.getElementById('aiModalTitle');
        const aiModalMessage = document.getElementById('aiModalMessage');
        const aiLoadingSpinner = document.getElementById('aiLoadingSpinner');
        const closeAiModalBtn = document.getElementById('closeAiModalBtn');
        let adjustStudentModal = document.getElementById('adjust-student-modal');
        const shopItemModal = document.getElementById('shop-item-modal');
        const lifeRuleModal = document.getElementById('life-rule-modal');
        const homeworkModal = document.getElementById('homework-modal');
        const problemCreationModal = document.getElementById('problem-creation-modal');
        const assignmentModal = document.getElementById('assignment-modal');
        const assignCodeModal = document.getElementById('assign-code-modal');
        const dictationCreationModal = document.getElementById('dictation-creation-modal');
        const dictationModal = document.getElementById('dictation-modal');
        const manualProblemCreationModal = document.getElementById('manual-problem-creation-modal');
        const manualProblemModal = document.getElementById('manual-problem-modal');
        const draftModal = document.getElementById('draft-modal');
        let studentToAdjustId = null;


        // --- Utility & Modal Functions ---
        const formatCurrency = (amount) => new Intl.NumberFormat('ko-KR').format(amount) + ' 원';
        
        function showModal(title, message, onConfirm = null) {
            modalTitle.textContent = title;
            modalMessage.innerHTML = message;
            
            // Clone and replace the button to remove old event listeners
            const newConfirmBtn = modalConfirmBtn.cloneNode(true);
            modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
            modalConfirmBtn = document.getElementById('modal-confirm-btn'); // Re-assign the global variable

            if (onConfirm && typeof onConfirm === 'function') {
                modalConfirmBtn.style.display = 'inline-block';
                modalConfirmBtn.onclick = () => {
                    onConfirm();
                };
            } else {
                modalConfirmBtn.onclick = () => modal.style.display = 'none';
            }
            modal.style.display = 'flex';
        }

        modalCloseBtn.addEventListener('click', () => modal.style.display = 'none');
        
        function showAiModal(title) {
            aiModalTitle.textContent = title;
            aiModalMessage.textContent = '';
            aiLoadingSpinner.classList.remove('hidden');
            aiContentModal.style.display = 'flex';
        }
        function updateAiModalContent(content) {
            aiModalMessage.textContent = content;
            aiLoadingSpinner.classList.add('hidden');
        }
        closeAiModalBtn.addEventListener('click', () => aiContentModal.style.display = 'none');


        function switchView(viewName) {
            Object.values(views).forEach(view => view.classList.remove('active'));
            if (views[viewName]) {
                views[viewName].classList.add('active');
            }
        }
        
        function switchLoginTab(tabName) {
            document.querySelectorAll('.login-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('#login-view .tab-content').forEach(content => content.classList.remove('active'));
            
            document.getElementById(`${tabName}-login-tab`).classList.add('active');
            document.getElementById(`${tabName}-login-content`).classList.add('active');
        }
        
        document.getElementById('student-login-tab').addEventListener('click', () => switchLoginTab('student'));
        document.getElementById('teacher-login-tab').addEventListener('click', () => switchLoginTab('teacher'));


        function switchTab(tabGroup, selectedTab) {
            document.querySelectorAll(`.${tabGroup}-tab`).forEach(tab => {
                tab.classList.remove('active');
                const content = document.getElementById(`${tab.dataset.tab}-tab-content`);
                if(content) content.classList.remove('active');
            });
            const selectedTabEl = document.querySelector(`.${tabGroup}-tab[data-tab="${selectedTab}"]`);
            if(selectedTabEl) selectedTabEl.classList.add('active');
            const selectedContent = document.getElementById(`${selectedTab}-tab-content`);
            if(selectedContent) selectedContent.classList.add('active');
        }

        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab('dashboard', tab.dataset.tab));
        });
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab('admin', tab.dataset.tab));
        });


        // --- Authentication Logic ---
        onAuthStateChanged(auth, async (user) => {
            currentAuthUser = user;
            isAdminViewing = false; // Reset admin view on auth change
            document.getElementById('back-to-admin-btn').classList.add('hidden');

            if (user && !user.isAnonymous) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    currentUserData = { id: user.uid, ...userDoc.data() };
                    viewedUserData = currentUserData; // By default, you view your own data
                    showDashboard(currentUserData.role);
                } else {
                    currentUserData = null;
                    viewedUserData = null;
                    switchView('login');
                }
            } else { 
                if (!isAdminViewing) {
                    currentUserData = null;
                    viewedUserData = null;
                    switchView('login');
                    switchLoginTab('student');
                }
            }
            document.getElementById('loading-overlay').style.display = 'none';
        });

        async function initializeAuthentication() {
            // Kept for potential future use
        }

        // --- Dashboard Logic ---
        function showDashboard(role) {
            const dataToShow = viewedUserData; // Use the currently viewed user's data
            if (!dataToShow) return;

            const titleEl = document.getElementById('dashboard-title');
            const codeEl = document.getElementById('dashboard-code');
            const studentPanel = document.getElementById('student-info-panel');
            const teacherPanel = document.getElementById('teacher-admin-panel');
            const walletSection = document.getElementById('wallet-section');
            const marketSection = document.getElementById('market');
            const assetSection = document.getElementById('asset-allocation-section');

            const walletInfo = document.getElementById('wallet-financial-info');
            const walletTitle = document.getElementById('wallet-title');
            if (role === 'teacher') {
                walletSection.classList.remove('hidden');
                marketSection.classList.add('hidden');
                assetSection.classList.add('hidden');
                walletInfo.classList.add('hidden');
                walletTitle.textContent = '나만의 바로가기';
            } else {
                walletSection.classList.remove('hidden');
                marketSection.classList.remove('hidden');
                assetSection.classList.remove('hidden');
                walletInfo.classList.remove('hidden');
                walletTitle.textContent = '💰 내 지갑 현황';
            }
            
            // Show/hide tabs based on the *actual logged-in user's role*
            document.getElementById('homework-dashboard-tab').style.display = dataToShow.role === 'student' ? 'inline-block' : 'none';
            document.getElementById('learning-problems-dashboard-tab').style.display = currentUserData.role === 'teacher' ? 'inline-block' : 'none';
            document.getElementById('life-rules-management-dashboard-tab').style.display = currentUserData.role === 'teacher' ? 'inline-block' : 'none';
            document.getElementById('work-management-tab').style.display = currentUserData.role === 'teacher' ? 'inline-block' : 'none';
            document.getElementById('teacher-admin-panel').style.display = currentUserData.role === 'teacher' ? 'block' : 'none';
            
            // Disable interactive elements if admin is viewing
            const isReadOnly = isAdminViewing;
            document.querySelectorAll('.buy-item-btn, #main-dashboard-bottom-content button').forEach(el => el.disabled = isReadOnly);


            if (role === 'teacher') {
                titleEl.textContent = `${dataToShow.name || '교사'} 대시보드`;
                studentPanel.classList.add('hidden');
                teacherPanel.classList.remove('hidden');
            } else { // Student
                titleEl.textContent = `${dataToShow.name} 학생`;
                if(isAdminViewing) {
                    titleEl.textContent += ` (관리자 조회 모드)`;
                }
                codeEl.textContent = dataToShow.userCode || 'N/A';
                studentPanel.classList.remove('hidden');
                teacherPanel.classList.add('hidden');
            }
            switchView('dashboard');
            switchTab('dashboard', 'main');
            updateDashboardDisplay();
            loadAndRenderMarketTabs();
            loadAndRenderShopItems();
            renderDashboardMainContent(role);
            if (role === 'student') {
                renderHomework();
                renderLifeRulesForStudent();
            }
            if (currentUserData.role === 'teacher') {
                loadLearningProblems();
                loadLifeRules();
                loadWorkDocs();
            }
            startStockUpdates();
            document.getElementById('teacher-add-shop-item-btn').classList.toggle('hidden', currentUserData.role !== 'teacher');
        }
        
        function updateDashboardDisplay() {
            const dataToShow = viewedUserData;
            if (!dataToShow) return;
            const balance = dataToShow.balance || dataToShow.coins || 0;
            document.getElementById('currentBalance').textContent = formatCurrency(balance);
            let stockValue = 0;
            if (dataToShow.portfolio) {
                for (const stockId in dataToShow.portfolio) {
                    const portfolioItem = dataToShow.portfolio[stockId];
                    const quantity = portfolioItem?.quantity || 0;
                    const stockPrice = stockDataCache[stockId]?.price || 0;
                    stockValue += quantity * stockPrice;
                }
            }
            document.getElementById('totalAssetValue').textContent = formatCurrency(balance + stockValue);
            renderAssetAllocationChart();
        }

        function renderAssetAllocationChart() {
            const dataToShow = viewedUserData;
            if (!dataToShow || !stockDataCache) return;
            const ctx = document.getElementById('assetAllocationChart').getContext('2d');
            const balance = dataToShow.balance || dataToShow.coins || 0;
            const labels = ['현금'];
            const data = [balance];
            const backgroundColors = ['rgba(54, 162, 235, 0.7)'];

            if (dataToShow.portfolio) {
                for (const stockId in dataToShow.portfolio) {
                    const portfolioItem = dataToShow.portfolio[stockId];
                    const quantity = portfolioItem?.quantity || 0;
                    if (quantity > 0 && stockDataCache[stockId]) {
                        labels.push(stockDataCache[stockId].name);
                        data.push(quantity * stockDataCache[stockId].price);
                        backgroundColors.push(stockDataCache[stockId].color || '#CCCCCC');
                    }
                }
            }

            if (assetChartInstance) assetChartInstance.destroy();
            
            if (data.every(val => val === 0)) {
                assetChartInstance = new Chart(ctx, {type: 'doughnut', data: {labels: ['자산 없음'], datasets: [{ data: [1], backgroundColor: ['#E5E7EB'] }]}, options: {responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { enabled: false }}}});
            } else {
                assetChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: { labels, datasets: [{ label: '자산 구성', data, backgroundColor: backgroundColors }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.parsed)}` } } } }
                });
            }
        }


        // --- Stock Market Logic ---
        async function initializeStockData() {
            const initialStocks = {
                'hanul': { name: '한울반 주식', price: 1000, history: [1000], color: 'rgba(59, 130, 246, 0.7)', minFluctuation: -50, maxFluctuation: 100, type: 'normal' },
                'usan': { name: '우산 주식', price: 1000, history: [1000], color: 'rgba(16, 185, 129, 0.7)', minFluctuation: -50, maxFluctuation: 100, type: 'normal' },
                'haetsal': { name: '햇살 주식', price: 1000, history: [1000], color: 'rgba(245, 158, 11, 0.7)', minFluctuation: -50, maxFluctuation: 100, type: 'normal' },
                'edu': { name: '에이두 스쿨 주식', price: 1000, history: [1000], color: 'rgba(139, 92, 246, 0.7)', minFluctuation: -50, maxFluctuation: 100, type: 'normal' }
            };
            for (const stockId in initialStocks) {
                const stockDocRef = doc(db, "stocks", stockId);
                const docSnap = await getDoc(stockDocRef);
                if (!docSnap.exists()) {
                    await setDoc(stockDocRef, initialStocks[stockId]);
                }
            }
        }

        async function updateNormalStockPrices() {
            if (isAdminViewing) return; // Don't update prices when an admin is just viewing
            for (const stockId in stockDataCache) {
                const stock = stockDataCache[stockId];
                if (stock.type === 'normal') {
                    const minFluctuation = stock.minFluctuation || -50;
                    const maxFluctuation = stock.maxFluctuation || 100;
                    const change = Math.floor(Math.random() * (maxFluctuation - minFluctuation + 1)) + minFluctuation;
                    let newPrice = stock.price + change;
                    if (newPrice < 100) newPrice = 100;
                    const newHistory = [...(stock.history || [])];
                    newHistory.push(newPrice);
                    if (newHistory.length > MAX_HISTORY_LENGTH) newHistory.shift();
                    try {
                        await updateDoc(doc(db, "stocks", stockId), { price: newPrice, history: newHistory });
                    } catch (error) { console.error(`Error updating ${stock.name}:`, error); }
                }
            }
        }
        
        function startStockUpdates() {
            initializeStockData().then(() => {
                if (stockUpdateInterval) clearInterval(stockUpdateInterval);
                updateNormalStockPrices();
                stockUpdateInterval = setInterval(updateNormalStockPrices, 60000);
            });
        }

        async function loadAndRenderMarketTabs() {
            const container = document.getElementById('marketTabsContainer');
            container.innerHTML = '<p class="text-sm text-stone-500">주식 정보 로딩 중...</p>';
            
            try {
                const querySnapshot = await getDocs(query(collection(db, "stocks"), orderBy("name")));
                stockDataCache = {}; // Clear cache before loading
                querySnapshot.forEach((docSnap) => {
                    stockDataCache[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
                });
            } catch (error) {
                container.innerHTML = '<p class="text-sm text-red-500">주식 정보를 불러오는데 실패했습니다.</p>';
                return;
            }

            container.innerHTML = '';
            const stockIds = Object.keys(stockDataCache);
            if (stockIds.length === 0) {
                container.innerHTML = '<p class="text-sm text-stone-500">거래 가능한 주식이 없습니다.</p>';
                document.getElementById('marketContent').innerHTML = '';
                return;
            }

            stockIds.forEach((stockId, index) => {
                const stock = stockDataCache[stockId];
                const tabButton = document.createElement('button');
                tabButton.className = `tab-button py-3 px-4 border-b-2 border-transparent text-stone-500 hover:text-amber-600 hover:border-amber-600 whitespace-nowrap text-sm font-medium`;
                tabButton.textContent = stock.name;
                tabButton.onclick = () => {
                    document.querySelectorAll('#market .tab-button').forEach(btn => btn.classList.remove('active'));
                    tabButton.classList.add('active');
                    renderStockDetails(stockId);
                };
                container.appendChild(tabButton);
                if (index === 0) {
                    tabButton.classList.add('active');
                    renderStockDetails(stockId);
                }
            });
        }
        
        function renderStockDetails(stockId) {
            const dataToShow = viewedUserData;
             if (!dataToShow || !stockDataCache[stockId]) {
                document.getElementById('marketContent').innerHTML = '<p class="text-center text-stone-500">주식 정보를 불러올 수 없습니다.</p>';
                return;
            }
            const stock = stockDataCache[stockId];
            const portfolioItem = dataToShow.portfolio?.[stockId];
            const userHoldings = portfolioItem?.quantity || 0;
            const avgBuyPrice = portfolioItem?.avgBuyPrice || 0;
            const holdingValue = userHoldings * stock.price;
            let roiDisplay = 'N/A';
            if (userHoldings > 0 && avgBuyPrice > 0) {
                const roi = ((stock.price - avgBuyPrice) / avgBuyPrice) * 100;
                roiDisplay = `${roi.toFixed(2)}%`;
            }

            const isReadOnly = isAdminViewing;

            document.getElementById('marketContent').innerHTML = `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <div>
                        <h3 class="text-2xl font-bold" style="color: ${stock.color || '#000'}">${stock.name}</h3>
                        <p class="text-4xl font-bold">${formatCurrency(stock.price)}</p>
                    </div>
                    <div class="text-right mt-2 md:mt-0 text-sm">
                        <p>보유량: <span class="font-semibold">${userHoldings} 주</span></p>
                        <p>평가액: <span class="font-semibold">${formatCurrency(holdingValue)}</span></p>
                        <p>평균 매수가: <span class="font-semibold">${userHoldings > 0 ? formatCurrency(avgBuyPrice) : 'N/A'}</span></p>
                        <p>수익률: <span class="font-semibold ${roiDisplay.startsWith('-') ? 'text-red-600' : 'text-green-600'}">${roiDisplay}</span></p>
                        <button id="aiStockAnalysisBtn-${stockId}" data-stock-id="${stockId}" class="mt-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-1 px-2 rounded-lg text-xs" ${isReadOnly ? 'disabled' : ''}>✨ AI 종목 분석</button>
                    </div>
                </div>
                <div class="chart-container h-64 md:h-80 mb-6"><canvas id="stockChart-${stockId}"></canvas></div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-lg font-semibold text-emerald-600 mb-2">매수 (사기)</h4>
                        <form id="buyForm-${stockId}" class="space-y-3"><input type="hidden" name="stockId" value="${stockId}">
                            <input type="number" name="quantity" min="1" required placeholder="수량" class="w-full p-2 border rounded" ${isReadOnly ? 'disabled' : ''}>
                            <p class="text-sm">예상 금액: <span id="buyEstimate-${stockId}">0 원</span></p>
                            <button type="submit" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg" ${isReadOnly ? 'disabled' : ''}>매수</button>
                        </form>
                    </div>
                    <div>
                        <h4 class="text-lg font-semibold text-red-600 mb-2">매도 (팔기)</h4>
                        <form id="sellForm-${stockId}" class="space-y-3"><input type="hidden" name="stockId" value="${stockId}">
                            <input type="number" name="quantity" min="1" max="${userHoldings}" ${userHoldings === 0 || isReadOnly ? 'disabled' : ''} required placeholder="수량" class="w-full p-2 border rounded">
                            <p class="text-sm">예상 금액: <span id="sellEstimate-${stockId}">0 원</span></p>
                            <button type="submit" class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg" ${userHoldings === 0 || isReadOnly ? 'disabled' : ''}>매도</button>
                        </form>
                    </div>
                </div>
            `;
            renderStockChart(stockId, stock.history || [], stock.color || '#CCCCCC');
            
            const buyForm = document.getElementById(`buyForm-${stockId}`);
            buyForm.quantity.addEventListener('input', () => {
                document.getElementById(`buyEstimate-${stockId}`).textContent = formatCurrency((buyForm.quantity.value || 0) * stock.price);
            });
            buyForm.addEventListener('submit', handleBuySellStock);

            const sellForm = document.getElementById(`sellForm-${stockId}`);
            if(sellForm.quantity) {
                sellForm.quantity.addEventListener('input', () => {
                    document.getElementById(`sellEstimate-${stockId}`).textContent = formatCurrency((sellForm.quantity.value || 0) * stock.price);
                });
                sellForm.addEventListener('submit', handleBuySellStock);
            }
            
            document.getElementById(`aiStockAnalysisBtn-${stockId}`).addEventListener('click', handleAiStockAnalysis);
        }
        
        function renderStockChart(stockId, historyData, color) {
            const ctx = document.getElementById(`stockChart-${stockId}`).getContext('2d');
            if (stockChartInstances[stockId]) stockChartInstances[stockId].destroy();
            stockChartInstances[stockId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: historyData.map((_, i) => i + 1),
                    datasets: [{
                        label: `${stockDataCache[stockId].name} 가격`,
                        data: historyData,
                        borderColor: color.replace('0.7', '1'),
                        backgroundColor: color,
                        tension: 0.1,
                        fill: true,
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: (v) => formatCurrency(v) } } }, plugins: { legend: { display: false } } }
            });
        }

        async function handleBuySellStock(e) {
            e.preventDefault();
            if (isAdminViewing) return;
            const form = e.target;
            const isBuy = form.id.startsWith('buy');
            const stockId = form.stockId.value;
            const quantity = parseInt(form.quantity.value);
            const stock = stockDataCache[stockId];
            const cost = quantity * stock.price;
            
            const userRef = doc(db, "users", currentUserData.id);

            try {
                await runTransaction(db, async (transaction) => {
                    const userSnap = await transaction.get(userRef);
                    if (!userSnap.exists()) throw new Error("사용자 정보를 찾을 수 없습니다.");
                    
                    const userData = userSnap.data();
                    const balance = userData.balance || userData.coins || 0;
                    const currentPortfolio = userData.portfolio || {};
                    const currentStockInfo = currentPortfolio[stockId] || { quantity: 0, avgBuyPrice: 0, totalInvested: 0, totalShares: 0 };
                    
                    if (isBuy) {
                        if (balance < cost) throw new Error("잔액이 부족합니다.");
                        const newTotalShares = (currentStockInfo.totalShares || 0) + quantity;
                        const newTotalInvested = (currentStockInfo.totalInvested || 0) + cost;
                        const newAvgBuyPrice = newTotalShares > 0 ? parseFloat((newTotalInvested / newTotalShares).toFixed(2)) : 0;
                        const updatedStockData = {
                            quantity: (currentStockInfo.quantity || 0) + quantity,
                            avgBuyPrice: newAvgBuyPrice,
                            totalInvested: newTotalInvested,
                            totalShares: newTotalShares
                        };
                        transaction.update(userRef, { balance: increment(-cost), [`portfolio.${stockId}`]: updatedStockData });
                    } else { // isSell
                        if (currentStockInfo.quantity < quantity) throw new Error("보유 수량이 부족합니다.");
                        const newQuantity = currentStockInfo.quantity - quantity;
                        const updates = { balance: increment(cost) };
                        if (newQuantity === 0) {
                            updates[`portfolio.${stockId}`] = deleteField();
                        } else {
                            updates[`portfolio.${stockId}`] = { ...currentStockInfo, quantity: newQuantity };
                        }
                        transaction.update(userRef, updates);
                    }
                });
                showModal('성공', `${stock.name} ${quantity}주를 ${isBuy ? '매수' : '매도'}했습니다.`);
                form.reset();
                const userDoc = await getDoc(userRef);
                currentUserData = { id: userDoc.id, ...userDoc.data() };
                viewedUserData = currentUserData;
                updateDashboardDisplay();
                renderStockDetails(stockId);
            } catch (error) {
                showModal('오류', `거래 중 오류 발생: ${error.message}`);
            }
        }
        
        async function handleAiStockAnalysis(e) {
            const stockId = e.target.dataset.stockId;
            const stockName = stockDataCache[stockId].name;
            const prompt = `초등학생을 위한 ${stockName}에 대한 짧고 재미있는 이야기를 만들어줘. 예를 들어, ${stockName}이 왜 오르거나 내릴 수 있는지, 또는 ${stockName}과 관련된 재미있는 상상을 덧붙여서 이야기해줘. 긍정적이고 희망찬 내용으로 작성해줘. 100자 이내로 짧게 부탁해.`;
            showAiModal("✨ AI가 열심히 생각하고 있어요...");
            const apiKey = "AIzaSyC7_Gq4LIVVMv0hMD6qSwcTlGJcDSt-KgI";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
            try {
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error(`API 요청 실패 (상태 코드: ${response.status})`);
                const result = await response.json();
                updateAiModalContent(result.candidates?.[0]?.content?.parts?.[0]?.text || 'AI 응답 생성 실패');
            } catch (error) {
                updateAiModalContent(`AI 연결 오류: ${error.message}`);
            }
        }


        // --- Event Listeners ---
        document.getElementById('show-student-register-btn').addEventListener('click', () => switchView('studentRegister'));
        document.getElementById('back-to-login-btn').addEventListener('click', () => switchView('login'));
        document.getElementById('admin-page-btn').addEventListener('click', () => {
            switchView('admin');
            loadAdminData();
        });
        document.getElementById('assign-homework-start-btn').addEventListener('click', () => openBulkAssignment('homework'));
        document.getElementById('assign-life-rule-start-btn').addEventListener('click', () => openBulkAssignment('lifeRule'));
        document.getElementById('add-quick-link-btn').addEventListener('click', () => openQuickLinkModal());
        document.getElementById('open-share-space-btn').addEventListener('click', () => openShareSpace());
        document.getElementById('back-to-dashboard-btn').addEventListener('click', () => {
            isAdminViewing = false;
            viewedUserData = currentUserData;
            document.getElementById('back-to-admin-btn').classList.add('hidden');
            showDashboard(currentUserData.role);
        });
        document.getElementById('logout-btn').addEventListener('click', () => {
            if (auth.currentUser && !auth.currentUser.isAnonymous) {
                signOut(auth);
            }
            currentUserData = null;
            viewedUserData = null;
            isAdminViewing = false;
            switchView('login');
            if (stockUpdateInterval) clearInterval(stockUpdateInterval);
        });

        // Student Registration
        document.getElementById('student-register-btn').addEventListener('click', async () => {
            const name = document.getElementById('student-name').value.trim();
            if (!name) { showModal('오류', '이름을 입력해주세요.'); return; }

            try {
                const counterRef = doc(db, "metadata", "counters");
                const newCode = await runTransaction(db, async (transaction) => {
                    const counterDoc = await transaction.get(counterRef);
                    let nextCode = 1;
                    if (counterDoc.exists() && counterDoc.data().lastUserCode) {
                        nextCode = counterDoc.data().lastUserCode + 1;
                    }
                    transaction.set(counterRef, { lastUserCode: nextCode }, { merge: true });
                    return nextCode;
                });

                const email = `${newCode}@abc.com`;
                const password = `${newCode}qwerty`;

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    name: name,
                    email: email,
                    userCode: newCode,
                    role: 'student',
                    coins: 0,
                    balance: 0,
                    portfolio: {},
                    createdAt: serverTimestamp()
                });

                await addDoc(collection(db, 'signupLog'), {
                    name: name,
                    userCode: newCode,
                    role: 'student',
                    signedUpAt: serverTimestamp()
                });

                showModal('등록 완료!', `환영합니다, ${name} 학생!<br>당신의 고유 코드는 <strong class="text-2xl text-amber-600">${newCode}</strong> 입니다.<br>이 코드를 꼭 기억하고 로그인해주세요.`);
                switchView('login');
            } catch (e) {
                console.error("Error adding document: ", e);
                if (e.code === 'auth/email-already-in-use') {
                    showModal('오류', '이미 사용 중인 계정 정보입니다. 다른 코드를 시도해주세요.');
                } else {
                    showModal('오류', '학생 등록 중 문제가 발생했습니다.');
                }
            }
        });
        
        // Student Login
        document.getElementById('student-login-btn').addEventListener('click', async () => {
            const codeInput = document.getElementById('student-code').value.trim();
            
            const normalizedCode = codeInput.replace(/[\uFF10-\uFF19]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));

            if (!normalizedCode || !/^\d+$/.test(normalizedCode)) {
                showModal('오류', '유효한 숫자 코드를 입력해주세요.');
                return;
            }
            
            const codeAsInt = parseInt(normalizedCode, 10);
            const email = `${codeAsInt}@abc.com`;
            const password = `${codeAsInt}qwerty`;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // onAuthStateChanged will handle successful login
            } catch (error) {
                console.error("Student login error:", error);
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    showModal('로그인 실패', '고유 코드가 올바르지 않거나 해당 학생을 찾을 수 없습니다.');
                } else if (error.code === 'permission-denied') {
                    showModal('로그인 오류', '데이터베이스 접근 권한이 없습니다. 관리자에게 문의하여 Firestore 보안 규칙을 확인해주세요.');
                } else {
                    showModal('로그인 오류', `알 수 없는 오류가 발생했습니다: ${error.message}`);
                }
            }
        });

        // Teacher Login
        document.getElementById('teacher-login-btn').addEventListener('click', async () => {
            const email = document.getElementById('teacher-email').value;
            const password = document.getElementById('teacher-password').value;
            if (!email || !password) { showModal('오류', '이메일과 비밀번호를 모두 입력해주세요.'); return; }
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                showModal('로그인 실패', '이메일 또는 비밀번호가 올바르지 않습니다.');
            }
        });
        
        // Admin page logic
        document.getElementById('randomizePricesBtn').addEventListener('click', async () => {
            showModal("진행 중", "주가 변경 중...");
            await updateNormalStockPrices();
            showModal('알림', '주식 가격이 임의로 변경되었습니다.');
        });
        
        async function loadAdminData() {
            const listEl = document.getElementById('adminUserList');
            listEl.innerHTML = '<li>사용자 정보 로딩 중...</li>';
            try {
                const usersSnapshot = await getDocs(collection(db, "users"));

                listEl.innerHTML = '';
                
                const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                const teachers = users.filter(u => u.role === 'teacher');
                const students = users.filter(u => u.role === 'student');

                if (teachers.length > 0) {
                    const teacherHeader = document.createElement('h4');
                    teacherHeader.className = "text-lg font-semibold text-gray-700 mt-4 mb-2 border-b pb-1";
                    teacherHeader.textContent = "교사 목록";
                    listEl.appendChild(teacherHeader);

                    teachers.forEach(teacher => {
                        const li = document.createElement('li');
                        li.className = "flex justify-between items-center py-2 border-b";
                        li.innerHTML = `
                            <div>
                                <span class="font-medium">${teacher.name}</span> <span class="text-xs text-gray-500">(${teacher.email || '이메일 없음'})</span>
                                <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">교사</span>
                            </div>
                            <button data-userid="${teacher.id}" data-username="${teacher.name}" class="convert-to-student-btn btn bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 text-xs">학생으로 전환</button>
                        `;
                        listEl.appendChild(li);
                    });
                }

                if (students.length > 0) {
                    const studentHeader = document.createElement('h4');
                    studentHeader.className = "text-lg font-semibold text-gray-700 mt-6 mb-2 border-b pb-1";
                    studentHeader.textContent = "학생 목록";
                    listEl.appendChild(studentHeader);
                    
                    students.sort((a,b) => (a.userCode || 0) - (b.userCode || 0));

                    students.forEach(student => {
                        const li = document.createElement('li');
                        li.className = "flex justify-between items-center py-2 border-b";
                        li.innerHTML = `
                            <div>
                                <span class="font-medium">${student.name}</span> <span class="text-xs text-gray-500">(코드: ${student.userCode || '없음'})</span>
                                <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">학생</span>
                            </div>
                            <div class="space-x-1">
                                <button data-userid="${student.id}" class="view-student-dashboard-btn btn bg-sky-500 hover:bg-sky-600 text-white px-2 py-1 text-xs">조회</button>
                                <button data-userid="${student.id}" data-username="${student.name}" class="convert-to-teacher-btn btn bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 text-xs">교사로</button>
                                <button data-userid="${student.id}" data-username="${student.name}" class="assign-code-btn btn bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 text-xs">코드</button>
                                <button data-studentid="${student.id}" class="adjust-student-btn btn btn-secondary px-2 py-1 text-xs">조정</button>
                            </div>
                        `;
                        listEl.appendChild(li);
                    });
                }

                document.querySelectorAll('.view-student-dashboard-btn').forEach(btn => btn.addEventListener('click', (e) => viewStudentDashboard(e.target.dataset.userid)));
                document.querySelectorAll('.adjust-student-btn').forEach(btn => btn.addEventListener('click', (e) => openAdjustModal(e.target.dataset.studentid)));
                document.querySelectorAll('.convert-to-student-btn').forEach(btn => btn.addEventListener('click', (e) => handleRoleSwitch(e.target.dataset.userid, e.target.dataset.username, 'student')));
                document.querySelectorAll('.convert-to-teacher-btn').forEach(btn => btn.addEventListener('click', (e) => handleRoleSwitch(e.target.dataset.userid, e.target.dataset.username, 'teacher')));
                document.querySelectorAll('.assign-code-btn').forEach(btn => btn.addEventListener('click', (e) => openAssignCodeModal(e.target.dataset.userid, e.target.dataset.username)));

                document.getElementById('admin-user-search').addEventListener('input', (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const userItems = document.querySelectorAll('#adminUserList > li');
                    userItems.forEach(item => {
                        const itemText = item.textContent.toLowerCase();
                        if (itemText.includes(searchTerm)) {
                            item.style.display = 'flex';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });

            } catch (error) {
                console.error("Error loading admin data:", error);
                listEl.innerHTML = `<li>사용자 정보 로드 실패: ${error.message}</li>`;
            }
            loadPurchaseLog();
            loadSignupLog();
            loadAdminMarket();
        }
        
        async function handleRoleSwitch(userId, userName, toRole) {
            showModal(`${toRole === 'student' ? '학생' : '교사'}으로 전환 확인`, `정말로 '${userName}'님을 ${toRole === 'student' ? '학생' : '교사'}으로 전환하시겠습니까?`, async () => {
                modal.style.display = 'none';
                try {
                    const userRef = doc(db, "users", userId);
                    const updates = { role: toRole };
                    await updateDoc(userRef, updates);
                    showModal('전환 완료', `'${userName}'님의 역할이 성공적으로 변경되었습니다.`);
                    loadAdminData();
                } catch (e) {
                    console.error("Error switching role: ", e);
                    showModal('오류', '역할 전환 중 문제가 발생했습니다.');
                }
            });
        }

        function openAssignCodeModal(userId, userName) {
            assignCodeModal.style.display = 'flex';
            document.getElementById('assign-code-modal-title').textContent = `'${userName}' 학생 코드 부여/수정`;
            document.getElementById('assign-code-userid').value = userId;
            document.getElementById('new-user-code').value = '';
        }

        document.getElementById('close-assign-code-modal-btn').addEventListener('click', () => assignCodeModal.style.display = 'none');
        document.getElementById('save-new-code-btn').addEventListener('click', async () => {
            const userId = document.getElementById('assign-code-userid').value;
            const newCode = document.getElementById('new-user-code').value;

            if (!newCode || !/^\d+$/.test(newCode)) {
                showModal('오류', '유효한 숫자 코드를 입력해주세요.');
                return;
            }

            const newCodeInt = parseInt(newCode, 10);

            try {
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    userCode: newCodeInt,
                    email: `${newCodeInt}@abc.com`
                });
                
                assignCodeModal.style.display = 'none';
                showModal('코드 변경 완료', `고유 코드가 ${newCodeInt}(으)로 변경되었습니다.<br><strong class="text-red-500">매우 중요: Firebase Console의 Authentication 탭에서 해당 학생의 이메일을 '${newCodeInt}@abc.com'으로, 비밀번호를 '${newCodeInt}qwerty'(으)로 직접 변경해야만 새 코드로 로그인이 가능합니다.</strong>`);
                loadAdminData();
            } catch (error) {
                console.error("Error assigning new code:", error);
                showModal('오류', '코드 변경 중 오류가 발생했습니다.');
            }
        });
        
        // --- Shop Logic ---
        async function loadAndRenderShopItems() {
            const container = document.getElementById('shop-item-list');
            container.innerHTML = `<p class="col-span-full text-center text-gray-500">상점 물품을 불러오는 중입니다...</p>`;
            try {
                const querySnapshot = await getDocs(query(collection(db, "shopItems"), orderBy("name")));
                container.innerHTML = '';
                if(querySnapshot.empty) {
                    container.innerHTML = `<p class="col-span-full text-center text-gray-500">판매중인 물품이 없습니다.</p>`;
                    return;
                }
                querySnapshot.forEach(docSnap => {
                    const item = { id: docSnap.id, ...docSnap.data() };
                    const card = document.createElement('div');
                    card.className = "bg-white p-4 rounded-lg shadow flex flex-col";
                    
                    const imageHtml = item.imageUrl 
                        ? `<img src="${item.imageUrl}" alt="${item.name}" class="w-full h-32 object-cover rounded-md mb-3" onerror="this.onerror=null;this.src='https://placehold.co/400x300/F59E0B/FFFFFF?text=Image';">`
                        : `<div class="w-full h-32 bg-gray-200 rounded-md mb-3 flex items-center justify-center"><span class="text-gray-500 text-sm">No Image</span></div>`;

                    card.innerHTML = `
                        ${imageHtml}
                        <div class="flex flex-col flex-grow">
                            <h3 class="text-lg font-bold">${item.name}</h3>
                            <p class="text-sm text-gray-500 flex-grow my-2">${item.description || ''}</p>
                            <div class="flex justify-between items-center mt-4">
                                <span class="font-bold text-amber-600">${formatCurrency(item.price)}</span>
                                <button data-itemid="${item.id}" data-itemname="${item.name}" data-itemprice="${item.price}" class="buy-item-btn btn btn-primary px-3 py-1 text-sm" ${isAdminViewing ? 'disabled' : ''}>구매</button>
                            </div>
                            ${currentUserData.role === 'teacher' ? `
                            <div class="mt-2 flex justify-end space-x-2">
                                <button data-itemid="${item.id}" class="edit-item-btn btn bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1">수정</button>
                                <button data-itemid="${item.id}" class="delete-item-btn btn bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1">삭제</button>
                            </div>
                            ` : ''}
                        </div>
                    `;
                    container.appendChild(card);
                });
                document.querySelectorAll('.buy-item-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => handleBuyItem(e.target.dataset.itemid, e.target.dataset.itemname, e.target.dataset.itemprice));
                });
                if (currentUserData.role === 'teacher') {
                    container.querySelectorAll('.edit-item-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => openShopItemModal(e.target.dataset.itemid));
                    });
                    container.querySelectorAll('.delete-item-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => deleteShopItem(e.target.dataset.itemid));
                    });
                }
            } catch (error) {
                console.error("Error loading shop items: ", error);
                container.innerHTML = `<p class="col-span-full text-center text-red-500">상점 물품 로드 실패</p>`;
            }
        }

        async function handleBuyItem(itemId, itemName, itemPrice) {
            if (isAdminViewing) return;
            const price = Number(itemPrice);
            showModal('구매 확인', `'${itemName}'을(를) ${formatCurrency(price)}에 구매하시겠습니까?`, async () => {
                modal.style.display = 'none';
                const userRef = doc(db, "users", currentUserData.id);
                try {
                    await runTransaction(db, async (transaction) => {
                        const userSnap = await transaction.get(userRef);
                        const userData = userSnap.data();
                        const balance = userData.balance || userData.coins || 0;
                        if (balance < price) {
                            throw new Error('잔액이 부족합니다.');
                        }
                        transaction.update(userRef, { balance: increment(-price) });
                    });

                    await addDoc(collection(db, 'purchaseLog'), {
                        studentId: currentUserData.id,
                        studentName: currentUserData.name,
                        itemId: itemId,
                        itemName: itemName,
                        price: price,
                        purchasedAt: serverTimestamp()
                    });

                    showModal('구매 완료', `${itemName} 구매가 완료되었습니다.`);
                    const userDoc = await getDoc(userRef);
                    currentUserData = { id: userDoc.id, ...userDoc.data() };
                    viewedUserData = currentUserData;
                    updateDashboardDisplay();
                } catch (error) {
                    showModal('구매 실패', error.message);
                }
            });
        }

        async function deleteShopItem(itemId) {
            showModal('삭제 확인', '정말로 이 물품을 삭제하시겠습니까?', async () => {
                try {
                    await deleteDoc(doc(db, 'shopItems', itemId));
                    modal.style.display = 'none';
                    showModal('성공', '물품이 삭제되었습니다.');
                    loadAndRenderShopItems();
                } catch (error) {
                    showModal('삭제 실패', `오류: ${error.message}`);
                }
            });
        }

        // --- Admin Shop Management ---
        document.getElementById('teacher-add-shop-item-btn').addEventListener('click', () => openShopItemModal());

        async function openShopItemModal(itemId = null) {
            const form = document.getElementById('shop-item-form');
            form.reset();
            document.getElementById('shop-item-id').value = '';
            if (itemId) {
                const itemDoc = await getDoc(doc(db, "shopItems", itemId));
                if (itemDoc.exists()) {
                    const item = itemDoc.data();
                    document.getElementById('shop-item-id').value = itemId;
                    document.getElementById('shop-item-name').value = item.name;
                    document.getElementById('shop-item-price').value = item.price;
                    document.getElementById('shop-item-desc').value = item.description;
                    document.getElementById('shop-item-image-url').value = item.imageUrl || '';
                }
            }
            shopItemModal.style.display = 'flex';
        }
        document.getElementById('close-shop-item-modal-btn').addEventListener('click', () => shopItemModal.style.display = 'none');
        document.getElementById('shop-item-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const itemId = document.getElementById('shop-item-id').value;
            const data = {
                name: document.getElementById('shop-item-name').value,
                price: Number(document.getElementById('shop-item-price').value),
                description: document.getElementById('shop-item-desc').value,
                imageUrl: document.getElementById('shop-item-image-url').value
            };
            if (itemId) {
                await updateDoc(doc(db, "shopItems", itemId), data);
            } else {
                await addDoc(collection(db, "shopItems"), data);
            }
            shopItemModal.style.display = 'none';
            loadAndRenderShopItems();
        });
        
        // --- Admin Student Adjustment & Viewing ---
        async function viewStudentDashboard(studentId) {
            const studentDoc = await getDoc(doc(db, "users", studentId));
            if (!studentDoc.exists()) {
                showModal('오류', '학생 정보를 찾을 수 없습니다.');
                return;
            }
            isAdminViewing = true;
            viewedUserData = { id: studentDoc.id, ...studentDoc.data() };
            document.getElementById('back-to-admin-btn').classList.remove('hidden');
            showDashboard('student');
        }

        async function openAdjustModal(studentId) {
            studentToAdjustId = studentId;
            const studentDoc = await getDoc(doc(db, "users", studentId));
            if (!studentDoc.exists()) {
                showModal('오류', '학생 정보를 찾을 수 없습니다.');
                return;
            }
            const student = studentDoc.data();
            document.getElementById('adjust-modal-title').textContent = `${student.name} 학생 정보 조정`;
            
            // --- Render Portfolio ---
            const portfolioList = document.getElementById('student-portfolio-list');
            portfolioList.innerHTML = '';
            if (student.portfolio && Object.keys(student.portfolio).length > 0) {
                 for (const stockId in student.portfolio) {
                    const stockInfo = student.portfolio[stockId];
                    const stockName = stockDataCache[stockId]?.name || '알 수 없는 주식';
                    const div = document.createElement('div');
                    div.className = 'flex justify-between items-center bg-gray-100 p-2 rounded';
                    div.innerHTML = `
                        <span>${stockName}: ${stockInfo.quantity}주</span>
                        <button data-stockid="${stockId}" class="reset-stock-btn text-xs bg-red-500 text-white px-2 py-1 rounded">초기화</button>
                    `;
                    portfolioList.appendChild(div);
                }
            } else {
                portfolioList.innerHTML = '<p class="text-xs text-gray-500">보유 주식이 없습니다.</p>';
            }

            // --- Render Homework ---
            const homeworkList = document.getElementById('adjust-modal-homework');
            const hwSnapshot = await getDocs(collection(db, `users/${studentId}/assignedHomework`));
            homeworkList.innerHTML = '';
            if(!hwSnapshot.empty){
                hwSnapshot.forEach(hwDoc => {
                    const hw = {id: hwDoc.id, ...hwDoc.data()};
                    const div = document.createElement('div');
                    div.className = 'flex justify-between items-center bg-gray-100 p-2 rounded';
                    div.innerHTML = `
                        <div>
                           <p>${hw.title}</p>
                           <p class="text-xs ${hw.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}">${hw.status}</p>
                        </div>
                        <div class="space-x-2">
                            ${hw.status !== 'completed' ? `<button data-hwid="${hw.id}" data-reward="${hw.reward}" class="force-complete-hw-btn text-xs bg-blue-500 text-white px-2 py-1 rounded">강제 완료</button>` : ''}
                            <button data-hwid="${hw.id}" class="delete-hw-btn text-xs bg-red-500 text-white px-2 py-1 rounded">삭제</button>
                        </div>
                    `;
                    homeworkList.appendChild(div);
                });
            } else {
                 homeworkList.innerHTML = '<p class="text-xs text-gray-500">배부된 숙제가 없습니다.</p>';
            }

            // --- Render Life Rules ---
            const lifeRuleList = document.getElementById('adjust-modal-liferules');
            const lrSnapshot = await getDocs(collection(db, `users/${studentId}/assignedLifeRules`));
            lifeRuleList.innerHTML = '';
             if(!lrSnapshot.empty){
                lrSnapshot.forEach(lrDoc => {
                    const lr = {id: lrDoc.id, ...lrDoc.data()};
                    const div = document.createElement('div');
                    div.className = 'flex justify-between items-center bg-gray-100 p-2 rounded';
                    div.innerHTML = `
                        <span>${lr.text} (${lr.repeatType === 'daily' ? '매일' : '한 번'})</span>
                        <button data-lrid="${lr.id}" class="delete-lr-btn text-xs bg-red-500 text-white px-2 py-1 rounded">삭제</button>
                    `;
                    lifeRuleList.appendChild(div);
                });
            } else {
                 lifeRuleList.innerHTML = '<p class="text-xs text-gray-500">배부된 생활 규칙이 없습니다.</p>';
            }

            adjustStudentModal.style.display = 'flex';
            addAdjustModalEventListeners();
        }

        function addAdjustModalEventListeners() {
            // Remove previous listeners to avoid duplicates
            const newModal = adjustStudentModal.cloneNode(true);
            adjustStudentModal.parentNode.replaceChild(newModal, adjustStudentModal);
            adjustStudentModal = document.getElementById('adjust-student-modal');

            document.getElementById('close-adjust-modal-btn').addEventListener('click', () => adjustStudentModal.style.display = 'none');
            
            document.getElementById('adjust-won-btn').addEventListener('click', async () => {
                const amount = Number(document.getElementById('won-adjustment-amount').value);
                if (isNaN(amount) || amount === 0) {
                    showModal('오류', '정확한 금액을 입력하세요.'); return;
                }
                await updateDoc(doc(db, "users", studentToAdjustId), { balance: increment(amount) });
                showModal('성공', '금액 조정이 완료되었습니다.');
                document.getElementById('won-adjustment-amount').value = '';
            });

            document.querySelectorAll('.reset-stock-btn').forEach(btn => btn.addEventListener('click', async (e) => {
                const stockIdToReset = e.target.dataset.stockid;
                await updateDoc(doc(db, "users", studentToAdjustId), { [`portfolio.${stockIdToReset}`]: deleteField() });
                openAdjustModal(studentToAdjustId); // Refresh modal
            }));

            document.querySelectorAll('.force-complete-hw-btn').forEach(btn => btn.addEventListener('click', async (e) => {
                const hwId = e.target.dataset.hwid;
                const reward = Number(e.target.dataset.reward);
                await updateDoc(doc(db, `users/${studentToAdjustId}/assignedHomework`, hwId), { status: 'completed' });
                await updateDoc(doc(db, "users", studentToAdjustId), { balance: increment(reward) });
                openAdjustModal(studentToAdjustId); // Refresh modal
            }));

            document.querySelectorAll('.delete-hw-btn').forEach(btn => btn.addEventListener('click', async (e) => {
                const hwId = e.target.dataset.hwid;
                await deleteDoc(doc(db, `users/${studentToAdjustId}/assignedHomework`, hwId));
                openAdjustModal(studentToAdjustId); // Refresh modal
            }));

             document.querySelectorAll('.delete-lr-btn').forEach(btn => btn.addEventListener('click', async (e) => {
                const lrId = e.target.dataset.lrid;
                await deleteDoc(doc(db, `users/${studentToAdjustId}/assignedLifeRules`, lrId));
                openAdjustModal(studentToAdjustId); // Refresh modal
            }));
        }

        // --- Life Rules & Teacher Management Logic ---
        const isSameDay = (d1, d2) => {
            if (!d1 || !d2) return false;
            const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
            const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
            return date1.getTime() === date2.getTime();
        };

        function renderDashboardMainContent(role) {
            const lifeRules = document.getElementById('life-rules-container');
            const quickLinksSection = document.getElementById('teacher-quick-links');
            if (role === 'student') {
                lifeRules.classList.remove('hidden');
                quickLinksSection.classList.add('hidden');
                renderLifeRulesForStudent();
            } else if (role === 'teacher') {
                lifeRules.classList.add('hidden');
                quickLinksSection.classList.remove('hidden');
                loadQuickLinks();
            }
        }

        let editingQuickLinkIndex = null;
        let editingShared = false;
        const userKey = base => currentUserData ? `${base}_${currentUserData.id}` : base;

        function loadQuickLinks() {
            const container = document.getElementById('quick-links');
            if (!container) return;
            const links = JSON.parse(localStorage.getItem(userKey('teacherQuickLinks')) || '[]');
            container.innerHTML = '';
            links.forEach((link, idx) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative group';

                const btn = document.createElement('button');
                btn.className = 'flex flex-col items-center p-2 rounded-md text-white';
                btn.style.backgroundColor = link.color || '#3b82f6';
                btn.innerHTML = `<img src="${link.image}" class="w-16 h-16 object-cover rounded mb-1"><span class="text-sm">${link.name}</span>`;
                btn.addEventListener('click', () => window.open(link.url, '_blank'));
                wrapper.appendChild(btn);

                const editBtn = document.createElement('button');
                editBtn.className = 'hidden group-hover:block absolute -top-2 -right-2 bg-white p-1 rounded-full shadow';
                editBtn.innerHTML = '<i class="fas fa-pencil-alt text-gray-600"></i>';
                editBtn.addEventListener('click', (e) => { e.stopPropagation(); openQuickLinkModal(idx); });
                wrapper.appendChild(editBtn);

                container.appendChild(wrapper);
            });
        }

        function openQuickLinkModal(idx = null, shared = false) {
            editingQuickLinkIndex = idx;
            editingShared = shared;
            const title = document.querySelector('#quick-link-modal h3');
            const delBtn = document.getElementById('delete-quick-link-btn');
            const links = JSON.parse(localStorage.getItem(shared ? 'sharedQuickLinks' : userKey('teacherQuickLinks')) || '[]');

            if (idx !== null && links[idx]) {
                const link = links[idx];
                document.getElementById('quick-link-name').value = link.name || '';
                document.getElementById('quick-link-image').value = link.image || '';
                document.getElementById('quick-link-feature').value = link.feature || '';
                document.getElementById('quick-link-url').value = link.url || '';
                document.getElementById('quick-link-color').value = link.color || '#3b82f6';
                title.textContent = '바로가기 편집';
                delBtn.classList.remove('hidden');
            } else {
                document.getElementById('quick-link-name').value = '';
                document.getElementById('quick-link-image').value = '';
                document.getElementById('quick-link-feature').value = '';
                document.getElementById('quick-link-url').value = '';
                document.getElementById('quick-link-color').value = '#3b82f6';
                title.textContent = '바로가기 추가';
                delBtn.classList.add('hidden');
            }
            document.getElementById('quick-link-modal').style.display = 'flex';
        }

        document.getElementById('add-quick-link-confirm-btn').addEventListener('click', () => {
            const name = document.getElementById('quick-link-name').value.trim();
            const image = document.getElementById('quick-link-image').value.trim();
            const feature = document.getElementById('quick-link-feature').value.trim();
            const url = document.getElementById('quick-link-url').value.trim();
            const color = document.getElementById('quick-link-color').value;
            if (!name || !url) { showModal('오류', '이름과 링크를 입력해주세요.'); return; }
            const key = editingShared ? 'sharedQuickLinks' : userKey('teacherQuickLinks');
            const links = JSON.parse(localStorage.getItem(key) || '[]');
            if (editingQuickLinkIndex !== null) {
                const existing = links[editingQuickLinkIndex] || {};
                links[editingQuickLinkIndex] = editingShared
                    ? { ...existing, name, image, url, color, feature }
                    : { name, image, url, color, feature };
            } else {
                links.push(editingShared
                    ? { name, image, url, color, feature, author: currentUserData?.name || '익명', authorId: currentUserData?.id || '' }
                    : { name, image, url, color, feature });
            }
            localStorage.setItem(key, JSON.stringify(links));
            if (editingShared) {
                loadSharedLinks();
            } else {
                loadQuickLinks();
            }
            document.getElementById('quick-link-modal').style.display = 'none';
            editingQuickLinkIndex = null;
            editingShared = false;
        });

        document.getElementById('delete-quick-link-btn').addEventListener('click', () => {
            if (editingQuickLinkIndex === null) return;
            const key = editingShared ? 'sharedQuickLinks' : userKey('teacherQuickLinks');
            const links = JSON.parse(localStorage.getItem(key) || '[]');
            links.splice(editingQuickLinkIndex, 1);
            localStorage.setItem(key, JSON.stringify(links));
            if (editingShared) {
                loadSharedLinks();
            } else {
                loadQuickLinks();
            }
            document.getElementById('quick-link-modal').style.display = 'none';
            editingQuickLinkIndex = null;
            editingShared = false;
        });

        document.getElementById('close-quick-link-modal-btn').addEventListener('click', () => {
            document.getElementById('quick-link-modal').style.display = 'none';
            editingQuickLinkIndex = null;
            editingShared = false;
        });

        function openShareSpace() {
            loadSharedLinks();
            document.getElementById('quick-link-share-space-modal').style.display = 'flex';
        }

        function loadSharedLinks() {
            const container = document.getElementById('shared-quick-link-list');
            if (!container) return;
            const links = JSON.parse(localStorage.getItem('sharedQuickLinks') || '[]');
            container.innerHTML = '';
            links.forEach((link, idx) => {
                const btn = document.createElement('button');
                btn.className = 'flex flex-col items-center p-2 rounded-md text-white';
                btn.style.backgroundColor = link.color || '#3b82f6';
                btn.innerHTML = `<img src="${link.image}" class="w-16 h-16 object-cover rounded mb-1"><span class="text-sm">${link.name}</span>`;
                btn.addEventListener('click', () => openSharedLinkDetail(idx));
                container.appendChild(btn);
            });
        }

        let currentSharedIndex = null;
        function openSharedLinkDetail(idx) {
            currentSharedIndex = idx;
            const links = JSON.parse(localStorage.getItem('sharedQuickLinks') || '[]');
            const link = links[idx];
            if (!link) return;
            document.getElementById('shared-detail-title').textContent = link.name;
            document.getElementById('shared-detail-feature').textContent = link.feature || '';
            document.getElementById('shared-detail-author').textContent = `게시자: ${link.author || ''}`;
            document.getElementById('shared-detail-link').href = link.url;
            const isAuthor = link.authorId && currentUserData && link.authorId === currentUserData.id;
            document.getElementById('edit-shared-link-btn').classList.toggle('hidden', !isAuthor);
            document.getElementById('remove-shared-link-btn').classList.toggle('hidden', !isAuthor);
            document.getElementById('shared-link-detail-modal').style.display = 'flex';
        }

        function openShareOwnQuickLinkModal() {
            const container = document.getElementById('shareable-quick-links');
            const links = JSON.parse(localStorage.getItem(userKey('teacherQuickLinks')) || '[]');
            container.innerHTML = links.map((l,i)=>`<div class="flex justify-between items-center border p-2 rounded"><span>${l.name}</span><button class="share-q-btn btn btn-primary" data-idx="${i}">공유</button></div>`).join('');
            container.querySelectorAll('.share-q-btn').forEach(btn=>btn.addEventListener('click', e=>shareQuickLink(Number(e.target.dataset.idx))));
            document.getElementById('share-own-quick-link-modal').style.display = 'flex';
        }

        function shareQuickLink(idx) {
            const myLinks = JSON.parse(localStorage.getItem(userKey('teacherQuickLinks')) || '[]');
            const shared = JSON.parse(localStorage.getItem('sharedQuickLinks') || '[]');
            const link = { ...myLinks[idx], author: currentUserData?.name || '익명', authorId: currentUserData?.id || '' };
            shared.push(link);
            localStorage.setItem('sharedQuickLinks', JSON.stringify(shared));
            document.getElementById('share-own-quick-link-modal').style.display = 'none';
            loadSharedLinks();
        }

        document.getElementById('open-share-own-quick-link-modal-btn').addEventListener('click', () => openShareOwnQuickLinkModal());
        document.getElementById('close-share-own-quick-link-modal-btn').addEventListener('click', () => document.getElementById('share-own-quick-link-modal').style.display = 'none');
        document.getElementById('close-share-space-modal-btn').addEventListener('click', () => document.getElementById('quick-link-share-space-modal').style.display = 'none');
        document.getElementById('close-shared-link-detail-modal-btn').addEventListener('click', () => document.getElementById('shared-link-detail-modal').style.display = 'none');
        document.getElementById('save-shared-link-btn').addEventListener('click', () => {
            const shared = JSON.parse(localStorage.getItem('sharedQuickLinks') || '[]');
            const link = shared[currentSharedIndex];
            if (!link) return;
            const myLinks = JSON.parse(localStorage.getItem(userKey('teacherQuickLinks')) || '[]');
            myLinks.push({ name: link.name, image: link.image, url: link.url, color: link.color, feature: link.feature });
            localStorage.setItem(userKey('teacherQuickLinks'), JSON.stringify(myLinks));
            loadQuickLinks();
            document.getElementById('shared-link-detail-modal').style.display = 'none';
        });

        document.getElementById('edit-shared-link-btn').addEventListener('click', () => {
            openQuickLinkModal(currentSharedIndex, true);
            document.getElementById('shared-link-detail-modal').style.display = 'none';
        });

        document.getElementById('remove-shared-link-btn').addEventListener('click', () => {
            const links = JSON.parse(localStorage.getItem('sharedQuickLinks') || '[]');
            links.splice(currentSharedIndex, 1);
            localStorage.setItem('sharedQuickLinks', JSON.stringify(links));
            document.getElementById('shared-link-detail-modal').style.display = 'none';
            loadSharedLinks();
        });

        async function renderLifeRulesForStudent() {
            const dataToShow = viewedUserData;
            const container = document.getElementById('life-rules-container');
            if (!container) return;
            container.innerHTML = '<p class="text-sm text-gray-500">규칙을 불러오는 중...</p>';

            const q = query(collection(db, `users/${dataToShow.id}/assignedLifeRules`));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                container.innerHTML = '<p class="text-sm text-gray-500">오늘 지켜야 할 생활 규칙이 없습니다.</p>';
                return;
            }

            container.innerHTML = '';
            const today = new Date();
            let rulesToDisplay = 0;
            querySnapshot.forEach(docSnap => {
                const rule = { id: docSnap.id, ...docSnap.data() };
                const lastCompleted = rule.lastCompletedAt?.toDate();
                
                const isCompletedToday = lastCompleted && isSameDay(lastCompleted, today);
                let shouldShow = true;
                if (rule.repeatType === 'one-time' && lastCompleted) {
                    shouldShow = false; // Don't show one-time rules that are completed
                }

                if(shouldShow) {
                    rulesToDisplay++;
                    const div = document.createElement('div');
                    div.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-md';
                    div.innerHTML = `
                        <div class="flex-grow">
                            <span>${rule.text}</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button data-ruleid="${rule.id}" data-reward="${rule.reward}" data-repeat="${rule.repeatType}" class="complete-rule-btn ${isCompletedToday ? 'bg-gray-300' : 'bg-green-500 hover:bg-green-600'} text-white text-xs font-bold py-1 px-3 rounded-full" ${isCompletedToday || isAdminViewing ? 'disabled' : ''}>
                                ${isCompletedToday ? '완료됨' : '지켰어요'}
                            </button>
                            ${!isCompletedToday && !isAdminViewing ? `<button data-ruleid="${rule.id}" class="fail-rule-btn bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-3 rounded-full">못 지켰어요</button>` : ''}
                            ${isAdminViewing ? `<button data-ruleid="${rule.id}" class="delete-assigned-rule-btn btn bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1">삭제</button>` : ''}
                        </div>
                    `;
                    container.appendChild(div);
                }
            });
            
            if (rulesToDisplay === 0) {
                 container.innerHTML = '<p class="text-sm text-gray-500">오늘 지켜야 할 생활 규칙이 없습니다.</p>';
            }

            document.querySelectorAll('.complete-rule-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (isAdminViewing) return;
                    const ruleId = e.target.dataset.ruleid;
                    const reward = Number(e.target.dataset.reward);
                    const userRef = doc(db, "users", currentUserData.id);
                    const ruleRef = doc(db, `users/${currentUserData.id}/assignedLifeRules`, ruleId);

                    await updateDoc(userRef, { balance: increment(reward) });
                    await updateDoc(ruleRef, { lastCompletedAt: serverTimestamp() });

                    const userDoc = await getDoc(userRef);
                    currentUserData = { id: userDoc.id, ...userDoc.data() };
                    viewedUserData = currentUserData;
                    showModal('참 잘했어요!', `${formatCurrency(reward)}을(를) 획득했습니다!`);
                    updateDashboardDisplay();
                    renderLifeRulesForStudent();
                });
            });

            document.querySelectorAll('.fail-rule-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (isAdminViewing) return;
                    const ruleId = e.target.dataset.ruleid;
                    const ruleRef = doc(db, `users/${currentUserData.id}/assignedLifeRules`, ruleId);

                    await updateDoc(ruleRef, { lastCompletedAt: serverTimestamp() });

                    showModal('다음에는 더 잘해봐요!', '포인트를 받지 못했어요.');
                    renderLifeRulesForStudent();
                });
            });

            document.querySelectorAll('.delete-assigned-rule-btn').forEach(btn => {
                btn.addEventListener('click', (e) => deleteAssignedLifeRule(e.target.dataset.ruleid));
            });
        }
        
        // --- TTS ---
        function speak(text) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'ko-KR';
                utterance.rate = 0.9;
                window.speechSynthesis.cancel(); // Cancel any previous speech
                window.speechSynthesis.speak(utterance);
            } else {
                showModal('오류', '사용하시는 브라우저는 음성 읽어주기를 지원하지 않습니다.');
            }
        }

        // --- Learning Problems & Homework (NEW & UPDATED) ---

        // Teacher: Open AI Math Problem Creator
        document.getElementById('add-ai-math-problem-btn').addEventListener('click', () => openProblemCreationModal());
        // Teacher: Open AI Dictation Problem Creator
        document.getElementById('add-ai-dictation-problem-btn').addEventListener('click', () => openDictationCreationModal());
        // Teacher: Open Manual Problem Creator
        document.getElementById('add-manual-problem-btn').addEventListener('click', () => openManualProblemCreationModal());

        // Teacher: Open Math Problem Modal (new or for editing)
        function openProblemCreationModal(problemSet = null) {
            problemCreationModal.style.display = 'flex';
            document.getElementById('problem-creation-form-container').style.display = 'block';
            document.getElementById('problem-display-area').innerHTML = '';
            document.getElementById('problem-creation-footer').classList.add('hidden');
            
            const form = document.getElementById('problem-creation-form-container');
            form.querySelector('#problem-set-id').value = problemSet?.id || '';
            form.querySelector('#problem-set-title').value = problemSet?.title || '';
            form.querySelector('#problem-count').value = problemSet?.problems?.length || '';
            form.querySelector('#problem-topic').value = problemSet?.topic || '';
            form.querySelector('#problem-reward').value = problemSet?.reward || '';
            form.querySelector('#is-word-problem').checked = problemSet?.isWordProblem || false;

            if (problemSet && problemSet.problems) {
                currentProblemSet = problemSet;
                renderProblemDisplay(problemSet.problems);
                document.getElementById('problem-creation-footer').classList.remove('hidden');
            }
        }

        // Teacher: Generate Math problems with AI
        document.getElementById('generate-ai-problems-btn').addEventListener('click', async () => {
            const count = document.getElementById('problem-count').value;
            const topic = document.getElementById('problem-topic').value;
            const title = document.getElementById('problem-set-title').value;
            const reward = document.getElementById('problem-reward').value;
            const isWordProblem = document.getElementById('is-word-problem').checked;

            if (!count || !topic || !title || !reward) {
                showModal('입력 오류', '모든 필드를 채워주세요.');
                return;
            }

            const wordProblemText = isWordProblem ? '문장형' : '';
            const prompt = `초등학생을 위한 ${topic} 주제의 ${wordProblemText} 수학 문제 ${count}개를 만들어줘. 각 문제에는 질문과 정답이 모두 포함되어야 해. 응답은 반드시 JSON 형식으로 "problems"라는 키 아래에 배열로 제공해줘. 각 배열 요소는 "question"과 "answer" 키를 가진 객체여야 해. 예를 들어: {"problems": [{"question": "사과 3개와 바나나 2개를 합치면 총 몇 개일까요?", "answer": "5"}]}`;
            
            const displayArea = document.getElementById('problem-display-area');
            displayArea.innerHTML = `<div class="flex items-center justify-center p-4"><div class="loading-spinner"></div><p class="ml-2">AI가 문제를 만들고 있습니다...</p></div>`;

            const apiKey = "AIzaSyC7_Gq4LIVVMv0hMD6qSwcTlGJcDSt-KgI";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            };
            
            try {
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error(`API 요청 실패 (상태 코드: ${response.status})`);
                const result = await response.json();
                const jsonString = result.candidates[0].content.parts[0].text;
                const generatedData = JSON.parse(jsonString);
                
                if (!generatedData.problems || !Array.isArray(generatedData.problems)) {
                    throw new Error("AI가 유효한 형식의 문제를 생성하지 못했습니다.");
                }

                currentProblemSet = {
                    type: 'math', // Add type for math problems
                    title,
                    topic,
                    reward: Number(reward),
                    isWordProblem,
                    problems: generatedData.problems.map(p => ({
                        question: p.question,
                        answer: String(p.answer) // Ensure answer is a string for comparison
                    }))
                };

                renderProblemDisplay(currentProblemSet.problems);
                document.getElementById('problem-creation-footer').classList.remove('hidden');

            } catch (error) {
                displayArea.innerHTML = `<p class="text-red-500 text-center">문제 생성 실패: ${error.message}</p>`;
                console.error(error);
            }
        });

        // Teacher: Render generated math problems for review
        function renderProblemDisplay(problems) {
            const displayArea = document.getElementById('problem-display-area');
            displayArea.innerHTML = problems.map((p, index) => `
                <div class="problem-item border-b py-3">
                    <div class="flex items-center">
                        <span class="problem-number font-bold mr-2">${index + 1}.</span>
                        <p class="problem-text flex-grow">${p.question}</p>
                    </div>
                    <div class="flex items-center mt-2">
                        <span class="text-sm font-bold text-green-600 mr-2">정답:</span>
                        <p class="text-sm text-gray-700">${p.answer}</p>
                    </div>
                </div>
            `).join('');
        }

        // Teacher: Save the created math problem set to Firestore
        document.getElementById('save-problem-set-btn').addEventListener('click', async () => {
            if (!currentProblemSet) {
                showModal('오류', '저장할 문제가 없습니다.');
                return;
            }
            
            const problemSetId = document.getElementById('problem-set-id').value;
            const dataToSave = {
                ...currentProblemSet,
                teacherId: currentAuthUser.uid,
                createdAt: serverTimestamp()
            };

            try {
                if (problemSetId) { // Editing existing
                    await setDoc(doc(db, "learningProblems", problemSetId), dataToSave, { merge: true });
                    showModal('성공', '학습 문제가 성공적으로 수정되었습니다.');
                } else { // Creating new
                    await addDoc(collection(db, "learningProblems"), dataToSave);
                    showModal('성공', '학습 문제가 성공적으로 저장되었습니다.');
                }
                problemCreationModal.style.display = 'none';
                loadLearningProblems(); // Refresh the list
            } catch (error) {
                showModal('저장 실패', `오류가 발생했습니다: ${error.message}`);
                console.error(error);
            }
        });

        // Teacher: Load all created learning problems (math and dictation)
        async function loadLearningProblems() {
            const container = document.getElementById('learning-problem-list');
            container.innerHTML = `<p class="text-center text-gray-500">학습 문제 목록을 불러오는 중입니다...</p>`;
            try {
                const q = query(collection(db, "learningProblems"), where("teacherId", "==", currentUserData.id));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    container.innerHTML = `<p class="text-center text-gray-500">생성된 학습 문제가 없습니다.</p>`;
                    return;
                }
                
                const problemSets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                problemSets.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));


                container.innerHTML = `
                    <div class="divide-y divide-gray-200">
                        ${problemSets.map(problemSet => {
                            const isDictation = problemSet.type === 'dictation';
                            const isManual = problemSet.type === 'manual';
                            const icon = isDictation ? '🎤' : (isManual ? '📝' : '🤖');
                            const topicText = isDictation ?
                                `${problemSet.dictationType === 'word' ? '단어' : '문장'} ${problemSet.count}개` :
                                isManual ? '직접 문제' : `${problemSet.topic} (${problemSet.problems?.length || 0}문제)`;

                            return `
                                <div class="p-3 flex justify-between items-center">
                                    <div>
                                        <p class="font-bold">${icon} ${problemSet.title}</p>
                                        <p class="text-sm text-gray-500">${topicText}, ${formatCurrency(problemSet.reward)}</p>
                                    </div>
                                    <div class="space-x-2">
                                        <button data-id="${problemSet.id}" data-title="${problemSet.title}" class="assign-homework-btn btn bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1">배부</button>
                                        <button data-id="${problemSet.id}" data-type="${problemSet.type}" class="edit-problem-btn btn bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1">수정</button>
                                        <button data-id="${problemSet.id}" class="delete-problem-btn btn bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1">삭제</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;

                container.querySelectorAll('.assign-homework-btn').forEach(btn => btn.addEventListener('click', (e) => openAssignmentModal('homework', e.target.dataset.id, e.target.dataset.title)));
                container.querySelectorAll('.edit-problem-btn').forEach(btn => btn.addEventListener('click', async (e) => {
                    const problemId = e.target.dataset.id;
                    const problemType = e.target.dataset.type;
                    const problemDoc = await getDoc(doc(db, "learningProblems", problemId));
                    if(problemType === 'dictation') {
                        openDictationCreationModal({id: problemDoc.id, ...problemDoc.data()});
                    } else if(problemType === 'manual') {
                        openManualProblemCreationModal({id: problemDoc.id, ...problemDoc.data()});
                    } else {
                        openProblemCreationModal({id: problemDoc.id, ...problemDoc.data()});
                    }
                }));
                container.querySelectorAll('.delete-problem-btn').forEach(btn => btn.addEventListener('click', (e) => deleteLearningProblem(e.target.dataset.id)));

            } catch (error) {
                console.error("Error loading learning problems:", error);
                container.innerHTML = `<p class="text-center text-red-500">학습 문제 로드 실패. 콘솔을 확인해주세요.</p>`;
            }
        }

        // Teacher: Delete a learning problem
        async function deleteLearningProblem(problemId) {
            showModal('삭제 확인', '정말로 이 학습 문제를 삭제하시겠습니까? 배부된 숙제에는 영향을 주지 않습니다.', async () => {
                try {
                    await deleteDoc(doc(db, "learningProblems", problemId));
                    modal.style.display = 'none';
                    showModal('성공', '학습 문제가 삭제되었습니다.');
                    loadLearningProblems();
                } catch (error) {
                    showModal('삭제 실패', `오류: ${error.message}`);
                }
            });
        }

        // Teacher: Open assignment modal (for both homework and life rules)
        async function openAssignmentModal(type, itemId, itemTitle) {
            currentAssignmentType = type;
            currentAssignmentItemId = itemId;
            
            document.getElementById('assignment-modal-title').textContent = `${type === 'homework' ? '숙제' : '생활 규칙'} 배부하기`;
            document.getElementById('assignment-item-title').textContent = `"${itemTitle}"`;
            
            const assignmentOptions = document.getElementById('assignment-options');
            if (type === 'lifeRule') {
                assignmentOptions.classList.remove('hidden');
            } else {
                assignmentOptions.classList.add('hidden');
            }

            const studentListEl = document.getElementById('assignment-student-list');
            studentListEl.innerHTML = '학생 목록 로딩 중...';
            assignmentModal.style.display = 'flex';

            const usersSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
            if (usersSnapshot.empty) {
                studentListEl.innerHTML = '배부할 학생이 없습니다.';
                return;
            }
            studentListEl.innerHTML = usersSnapshot.docs.map(docSnap => {
                const student = {id: docSnap.id, ...docSnap.data()};
                return `
                    <label class="flex items-center space-x-3 p-2 rounded hover:bg-gray-100">
                        <input type="checkbox" data-studentid="${student.id}" class="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500">
                        <span>${student.name} (코드: ${student.userCode})</span>
                    </label>
                `;
            }).join('');
            
            document.getElementById('assignment-student-search').addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const studentLabels = document.querySelectorAll('#assignment-student-list label');
                studentLabels.forEach(label => {
                    const labelText = label.textContent.toLowerCase();
                    if (labelText.includes(searchTerm)) {
                        label.style.display = 'flex';
                    } else {
                        label.style.display = 'none';
                    }
                });
            });
        }

        // Teacher: Assign item to selected students
        document.getElementById('assign-item-btn').addEventListener('click', async () => {
            const selectedStudentIds = Array.from(document.querySelectorAll('#assignment-student-list input:checked'))
                .map(input => input.dataset.studentid);
            
            if (selectedStudentIds.length === 0) {
                showModal('오류', '한 명 이상의 학생을 선택해주세요.');
                return;
            }

            try {
                if (currentAssignmentType === 'homework') {
                    const problemDoc = await getDoc(doc(db, "learningProblems", currentAssignmentItemId));
                    const problemSet = problemDoc.data();
                    for (const studentId of selectedStudentIds) {
                        const assignmentData = {
                            problemId: currentAssignmentItemId, 
                            type: problemSet.type, 
                            title: problemSet.title,
                            reward: problemSet.reward,
                            status: 'assigned',
                            assignedAt: serverTimestamp()
                        };
                        await addDoc(collection(db, `users/${studentId}/assignedHomework`), assignmentData);
                    }
                } else if (currentAssignmentType === 'lifeRule') {
                    const repeatType = document.querySelector('input[name="repeatType"]:checked').value;
                    const ruleDoc = await getDoc(doc(db, "lifeRules", currentAssignmentItemId));
                    const rule = ruleDoc.data();
                    for (const studentId of selectedStudentIds) {
                        const assignmentData = {
                            ruleId: currentAssignmentItemId,
                            text: rule.text,
                            reward: rule.reward,
                            repeatType: repeatType, 
                            assignedAt: serverTimestamp(),
                            lastCompletedAt: null
                        };
                        await setDoc(doc(db, `users/${studentId}/assignedLifeRules`, currentAssignmentItemId), assignmentData);
                    }
                }
                assignmentModal.style.display = 'none';
                showModal('성공', `${selectedStudentIds.length}명의 학생에게 배부를 완료했습니다.`);
            } catch (error) {
                showModal('배부 실패', `오류: ${error.message}`);
                console.error(error);
            }
        });

        // Student: Render homework list
        async function renderHomework() {
            const dataToShow = viewedUserData;
            const tableBody = document.getElementById('homework-table-body');
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">숙제를 불러오는 중...</td></tr>`;
            
            try {
                const q = query(collection(db, `users/${dataToShow.id}/assignedHomework`), orderBy("assignedAt", "desc"));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">새로운 숙제가 없습니다.</td></tr>`;
                    return;
                }

                tableBody.innerHTML = '';
                querySnapshot.forEach(docSnap => {
                    const hw = { id: docSnap.id, ...docSnap.data() };
                    const icon = hw.type === 'dictation' ? '🎤' : (hw.type === 'manual' ? '📝' : '🤖');
                    const isCompleted = hw.status === 'completed';
                    const assignedDate = hw.assignedAt ? hw.assignedAt.toDate().toLocaleDateString('ko-KR') : '';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${icon} ${hw.title}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${assignedDate}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                                ${isCompleted ? '완료' : '미완료'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button data-hwid="${hw.id}" data-problemid="${hw.problemId}" data-type="${hw.type}" class="view-homework-btn text-amber-600 hover:text-amber-900">
                                ${isCompleted ? '결과 보기' : '숙제로 이동하기'}
                            </button>
                            ${isAdminViewing ? `<button data-hwid="${hw.id}" class="delete-assigned-hw-btn btn bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1">삭제</button>` : ''}
                        </td>
                    `;
                    tableBody.appendChild(tr);
                });

                tableBody.querySelectorAll('.view-homework-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        if (isAdminViewing && e.target.textContent.trim() === '숙제로 이동하기') {
                            showModal('알림', '관리자 조회 모드에서는 숙제를 풀 수 없습니다. 완료된 숙제의 결과만 볼 수 있습니다.');
                            return;
                        }
                        const hwType = e.target.dataset.type;
                        if (hwType === 'dictation') {
                            openDictationModal(e.target.dataset.hwid, e.target.dataset.problemid);
                        } else if (hwType === 'manual') {
                            openManualProblemModal(e.target.dataset.hwid, e.target.dataset.problemid);
                        } else {
                            openHomeworkModal(e.target.dataset.hwid, e.target.dataset.problemid);
                        }
                    });
                });

                tableBody.querySelectorAll('.delete-assigned-hw-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => deleteAssignedHomework(e.target.dataset.hwid));
                });

            } catch (error) {
                console.error("Error fetching homework:", error);
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">숙제 로드 실패</td></tr>`;
            }
        }
        
        // Student: Open and do Math homework
        async function openHomeworkModal(assignmentId, problemId) {
            currentAssignmentId = assignmentId;
            const dataToShow = viewedUserData;
            const assignmentDoc = await getDoc(doc(db, `users/${dataToShow.id}/assignedHomework`, assignmentId));
            const problemDoc = await getDoc(doc(db, "learningProblems", problemId));
            
            if (!problemDoc.exists() || !assignmentDoc.exists()) {
                showModal('오류', '숙제 문제를 불러올 수 없습니다.');
                return;
            }
            const problemSet = problemDoc.data();
            const assignmentData = assignmentDoc.data();
            const isCompleted = assignmentData.status === 'completed';

            document.getElementById('homework-modal-title').textContent = problemSet.title;
            const contentArea = document.getElementById('homework-modal-content');
            
            contentArea.innerHTML = problemSet.problems.map((p, index) => {
                const studentAnswer = assignmentData.studentAnswers?.[index] || '';
                const isCorrect = studentAnswer.trim() === p.answer.trim();
                return `
                <div class="problem-item border-b py-4" data-answer="${p.answer}">
                    <div class="flex items-center mb-2">
                        <span class="problem-status-icon text-lg mr-2">${isCompleted ? (isCorrect ? '⭕' : '⭐') : ''}</span>
                        <span class="problem-number font-bold mr-2">${index + 1}.</span>
                        <button class="speak-btn text-blue-500 hover:text-blue-700 mr-3" data-text="${p.question}"><i class="fas fa-play-circle"></i></button>
                        <p class="problem-text flex-grow">${p.question}</p>
                    </div>
                    <div class="flex items-center ml-10">
                        <input type="text" class="student-answer-input w-full p-2 border rounded-md form-input" placeholder="정답을 입력하세요" value="${studentAnswer}" ${isCompleted ? 'disabled' : ''}>
                        ${!isCompleted ? '<button class="grade-one-btn btn btn-secondary text-xs px-3 py-2 ml-2 whitespace-nowrap">채점</button>' : ''}
                    </div>
                    ${isCompleted ? `<p class="ml-10 mt-1 text-sm ${isCorrect ? 'text-green-600' : 'text-red-500'}">정답: ${p.answer}</p>` : ''}
                </div>
            `}).join('');

            document.getElementById('homework-modal-footer').style.display = isCompleted ? 'none' : 'flex';
            document.getElementById('homework-score-display').textContent = '';
            const completeBtn = document.getElementById('complete-homework-btn');
            completeBtn.classList.add('btn-disabled');
            completeBtn.disabled = true;

            contentArea.querySelectorAll('.speak-btn').forEach(btn => btn.addEventListener('click', (e) => speak(e.currentTarget.dataset.text)));
            contentArea.querySelectorAll('.grade-one-btn').forEach((btn, index) => {
                btn.addEventListener('click', () => gradeOneProblem(index));
            });

            homeworkModal.style.display = 'flex';
        }

        // Student: Grade a single math problem
        function gradeOneProblem(index) {
            const problemItem = document.querySelectorAll('#homework-modal-content .problem-item')[index];
            const correctAnswer = problemItem.dataset.answer.trim();
            const studentAnswer = problemItem.querySelector('.student-answer-input').value.trim();
            const iconEl = problemItem.querySelector('.problem-status-icon');
            
            if (studentAnswer === correctAnswer) {
                iconEl.innerHTML = '⭕';
                iconEl.classList.remove('text-yellow-400');
                iconEl.classList.add('text-red-500');
                return true;
            } else {
                iconEl.innerHTML = '⭐';
                iconEl.classList.remove('text-red-500');
                iconEl.classList.add('text-yellow-400');
                return false;
            }
        }

        // Student: Grade all math problems
        document.getElementById('grade-all-homework-btn').addEventListener('click', () => {
            const problems = document.querySelectorAll('#homework-modal-content .problem-item');
            let correctCount = 0;
            problems.forEach((_, index) => {
                if(gradeOneProblem(index)) {
                    correctCount++;
                }
            });

            const score = Math.round((correctCount / problems.length) * 100);
            document.getElementById('homework-score-display').textContent = `점수: ${score} / 100`;

            const completeBtn = document.getElementById('complete-homework-btn');
            if (score === 100) {
                completeBtn.classList.remove('btn-disabled');
                completeBtn.disabled = false;
            } else {
                completeBtn.classList.add('btn-disabled');
                completeBtn.disabled = true;
            }
        });

        // Student: Complete the math homework assignment
        document.getElementById('complete-homework-btn').addEventListener('click', async () => {
            const btn = document.getElementById('complete-homework-btn');
            if (!currentAssignmentId || isAdminViewing || btn.disabled) return;
            btn.disabled = true;
            btn.classList.add('btn-disabled');

            const userRef = doc(db, "users", currentUserData.id);
            const assignmentRef = doc(db, `users/${currentUserData.id}/assignedHomework`, currentAssignmentId);
            
            const studentAnswers = Array.from(document.querySelectorAll('#homework-modal-content .student-answer-input')).map(input => input.value);

            try {
                const assignmentDoc = await getDoc(assignmentRef);
                const reward = assignmentDoc.data().reward || 0;

                await updateDoc(assignmentRef, { 
                    status: 'completed',
                    studentAnswers: studentAnswers,
                    completedAt: serverTimestamp()
                });
                await updateDoc(userRef, { balance: increment(reward) });

                const userDoc = await getDoc(userRef);
                currentUserData = { id: userDoc.id, ...userDoc.data() };
                viewedUserData = currentUserData;
                
                homeworkModal.style.display = 'none';
                showModal('숙제 완료!', `참 잘했어요! ${formatCurrency(reward)}을(를) 획득했습니다!`);
                updateDashboardDisplay();
                renderHomework();

            } catch (error) {
                showModal('오류', `숙제 완료 처리 중 오류가 발생했습니다: ${error.message}`);
                console.error(error);
            }
        });

        // --- Teacher: Life Rule Management ---
        document.getElementById('add-life-rule-btn').addEventListener('click', () => openLifeRuleModal());

        async function loadLifeRules() {
            const container = document.getElementById('life-rule-list');
            container.innerHTML = `<p class="text-center text-gray-500">생활 규칙 목록을 불러오는 중입니다...</p>`;
            try {
                const q = query(collection(db, "lifeRules"), where("teacherId", "==", currentUserData.id));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    container.innerHTML = `<p class="text-center text-gray-500">생성된 생활 규칙이 없습니다.</p>`;
                    return;
                }
                
                const rules = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                rules.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

                container.innerHTML = `
                    <div class="divide-y divide-gray-200">
                        ${rules.map(rule => `
                            <div class="p-3 flex justify-between items-center">
                                <div>
                                    <p class="font-bold">${rule.text}</p>
                                    <p class="text-sm text-gray-500">보상: ${formatCurrency(rule.reward)}</p>
                                </div>
                                <div class="space-x-2">
                                    <button data-id="${rule.id}" data-title="${rule.text}" class="assign-rule-btn btn bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1">배부</button>
                                    <button data-id="${rule.id}" class="edit-rule-btn btn bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1">수정</button>
                                    <button data-id="${rule.id}" class="delete-rule-btn btn bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1">삭제</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;

                container.querySelectorAll('.assign-rule-btn').forEach(btn => btn.addEventListener('click', (e) => openAssignmentModal('lifeRule', e.target.dataset.id, e.target.dataset.title)));
                container.querySelectorAll('.edit-rule-btn').forEach(btn => btn.addEventListener('click', async (e) => {
                    const ruleDoc = await getDoc(doc(db, "lifeRules", e.target.dataset.id));
                    openLifeRuleModal({id: ruleDoc.id, ...ruleDoc.data()});
                }));
                container.querySelectorAll('.delete-rule-btn').forEach(btn => btn.addEventListener('click', (e) => deleteLifeRule(e.target.dataset.id)));

            } catch (error) {
                console.error("Error loading life rules:", error);
                container.innerHTML = `<p class="text-center text-red-500">생활 규칙 로드 실패.</p>`;
            }
        }

        function openLifeRuleModal(rule = null) {
            lifeRuleModal.style.display = 'flex';
            const form = document.getElementById('life-rule-form');
            form.reset();
            form.querySelector('#life-rule-id').value = rule?.id || '';
            form.querySelector('#life-rule-text').value = rule?.text || '';
            form.querySelector('#life-rule-reward').value = rule?.reward || '';
        }

        document.getElementById('life-rule-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const ruleId = document.getElementById('life-rule-id').value;
            const data = {
                text: document.getElementById('life-rule-text').value,
                reward: Number(document.getElementById('life-rule-reward').value),
                teacherId: currentAuthUser.uid,
                createdAt: serverTimestamp()
            };

            try {
                if (ruleId) {
                    await setDoc(doc(db, "lifeRules", ruleId), data, { merge: true });
                } else {
                    await addDoc(collection(db, "lifeRules"), data);
                }
                lifeRuleModal.style.display = 'none';
                loadLifeRules();
            } catch (error) {
                showModal('저장 실패', `오류: ${error.message}`);
            }
        });

        async function deleteLifeRule(ruleId) {
            showModal('삭제 확인', '정말로 이 생활 규칙을 삭제하시겠습니까? 학생에게 이미 배부된 규칙에는 영향을 주지 않습니다.', async () => {
                try {
                    await deleteDoc(doc(db, "lifeRules", ruleId));
                    modal.style.display = 'none';
                    showModal('성공', '생활 규칙이 삭제되었습니다.');
                    loadLifeRules();
                } catch (error) {
                    showModal('삭제 실패', `오류: ${error.message}`);
                }
            });
        }

        // --- Work Management ---
        let currentDraftIndex = null;
        document.getElementById('open-draft-modal-btn').addEventListener('click', () => openDraftModal());

        function openDraftModal(index = null) {
            currentDraftIndex = index;
            draftModal.style.display = 'flex';
            const form = document.getElementById('draft-form');
            form.reset();
            referenceContainer.innerHTML = '';
            attachmentContainer.innerHTML = '';
            draftResult.classList.add('hidden');
            document.querySelector('input[name="has-reference"][value="no"]').checked = true;
            document.querySelector('input[name="has-attachment"][value="no"]').checked = true;
            addReferenceBtn.classList.add('hidden');
            addAttachmentBtn.classList.add('hidden');
            referenceContainer.classList.add('hidden');
            attachmentContainer.classList.add('hidden');

            if(index !== null) {
                const docs = JSON.parse(localStorage.getItem(userKey('workDocs')) || '[]');
                const docData = docs[index];
                if(docData) {
                    document.getElementById('draft-subject').value = docData.subject;
                    document.getElementById('draft-notes').value = docData.notes;
                    if(docData.references && docData.references.length) {
                        document.querySelector('input[name="has-reference"][value="yes"]').checked = true;
                        referenceContainer.classList.remove('hidden');
                        addReferenceBtn.classList.remove('hidden');
                        docData.references.forEach(r => addReferenceField(r));
                    }
                    if(docData.attachments && docData.attachments.length) {
                        document.querySelector('input[name="has-attachment"][value="yes"]').checked = true;
                        attachmentContainer.classList.remove('hidden');
                        addAttachmentBtn.classList.remove('hidden');
                        docData.attachments.forEach(a => addAttachmentField(a));
                    }
                    generatedTitle.textContent = docData.title;
                    generatedBody.textContent = docData.body;
                    draftResult.classList.remove('hidden');
                }
            }
        }

        document.getElementById('close-draft-modal-btn').addEventListener('click', () => draftModal.style.display = 'none');

        const referenceContainer = document.getElementById('reference-container');
        const attachmentContainer = document.getElementById('attachment-container');
        const addReferenceBtn = document.getElementById('add-reference-btn');
        const addAttachmentBtn = document.getElementById('add-attachment-btn');
        const draftResult = document.getElementById('draft-result');
        const generatedTitle = document.getElementById('generated-title');
        const generatedBody = document.getElementById('generated-body');

        document.querySelectorAll('input[name="has-reference"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if(radio.value === 'yes' && radio.checked) {
                    referenceContainer.classList.remove('hidden');
                    addReferenceBtn.classList.remove('hidden');
                    if(referenceContainer.children.length === 0) addReferenceField();
                } else if(radio.value === 'no' && radio.checked) {
                    referenceContainer.innerHTML = '';
                    referenceContainer.classList.add('hidden');
                    addReferenceBtn.classList.add('hidden');
                }
            });
        });

        document.querySelectorAll('input[name="has-attachment"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if(radio.value === 'yes' && radio.checked) {
                    attachmentContainer.classList.remove('hidden');
                    addAttachmentBtn.classList.remove('hidden');
                    if(attachmentContainer.children.length === 0) addAttachmentField();
                } else if(radio.value === 'no' && radio.checked) {
                    attachmentContainer.innerHTML = '';
                    attachmentContainer.classList.add('hidden');
                    addAttachmentBtn.classList.add('hidden');
                }
            });
        });

        addReferenceBtn.addEventListener('click', () => addReferenceField());
        addAttachmentBtn.addEventListener('click', () => addAttachmentField());

        function addReferenceField(data = {}) {
            const div = document.createElement('div');
            div.className = 'grid grid-cols-1 md:grid-cols-4 gap-2 reference-item';
            div.innerHTML = `
                <input type="text" class="p-2 border rounded ref-agency" placeholder="기관" value="${data.agency || ''}">
                <input type="text" class="p-2 border rounded ref-number" placeholder="문서 번호" value="${data.number || ''}">
                <input type="date" class="p-2 border rounded ref-date" value="${data.date || ''}">
                <input type="text" class="p-2 border rounded ref-content" placeholder="내용(선택)" value="${data.content || ''}">
            `;
            referenceContainer.appendChild(div);
        }

        function addAttachmentField(data = {}) {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 attachment-item';
            div.innerHTML = `
                <input type="text" class="flex-1 p-2 border rounded attachment-name" placeholder="붙임 문서 이름" value="${data.name || ''}">
                <input type="file" class="hidden attachment-file">
                <button type="button" class="btn btn-secondary upload-file-btn">파일 업로드</button>
            `;
            const fileInput = div.querySelector('.attachment-file');
            const uploadBtn = div.querySelector('.upload-file-btn');
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => {
                if(fileInput.files[0]) {
                    div.querySelector('.attachment-name').value = fileInput.files[0].name;
                }
            });
            attachmentContainer.appendChild(div);
        }

        document.getElementById('draft-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const subject = document.getElementById('draft-subject').value.trim();
            const notes = document.getElementById('draft-notes').value.trim();
            const references = Array.from(referenceContainer.querySelectorAll('.reference-item')).map(item => ({
                agency: item.querySelector('.ref-agency').value,
                number: item.querySelector('.ref-number').value,
                date: item.querySelector('.ref-date').value,
                content: item.querySelector('.ref-content').value
            }));
            const attachments = Array.from(attachmentContainer.querySelectorAll('.attachment-item')).map(item => ({
                name: item.querySelector('.attachment-name').value
            }));

            const { title, body } = generateDraftText(subject, notes, references, attachments);
            generatedTitle.textContent = title;
            generatedBody.textContent = body;
            draftResult.classList.remove('hidden');
        });

        function generateDraftText(subject, notes, references, attachments) {
            const title = subject;
            let body = '';
            if(references.length) {
                const refStr = references.map(r => `${r.agency}-${r.number}(${r.date})${r.content ? ' 「'+r.content+'」' : ''}`).join(', ');
                body += `1. 관련: ${refStr}\n`;
                body += `2. ${subject}에 대하여`;
            } else {
                body += `1. ${subject}에 대하여`;
            }
            if(attachments.length) {
                body += ' 붙임과 같이 보고하고자 합니다.';
                body += '\n\n붙임  ';
                if(attachments.length === 1) {
                    body += `${attachments[0].name} 1부.  끝.`;
                } else {
                    body += attachments.map((a,i)=>`${i+1}. ${a.name} ${i+1}부.`).join('\n        ') + '  끝.';
                }
            } else {
                body += ' 보고하고자 합니다.  끝.';
            }
            return { title, body };
        }

        document.getElementById('edit-title-btn').addEventListener('click', () => {
            const newTitle = prompt('제목 수정', generatedTitle.textContent);
            if(newTitle) generatedTitle.textContent = newTitle;
        });
        document.getElementById('edit-body-btn').addEventListener('click', () => {
            const newBody = prompt('본문 수정', generatedBody.textContent);
            if(newBody) generatedBody.textContent = newBody;
        });
        document.getElementById('copy-title-btn').addEventListener('click', () => navigator.clipboard.writeText(generatedTitle.textContent));
        document.getElementById('copy-body-btn').addEventListener('click', () => navigator.clipboard.writeText(generatedBody.textContent));

        document.getElementById('save-draft-btn').addEventListener('click', () => {
            const docs = JSON.parse(localStorage.getItem(userKey('workDocs')) || '[]');
            const docData = {
                title: generatedTitle.textContent,
                body: generatedBody.textContent,
                subject: document.getElementById('draft-subject').value.trim(),
                notes: document.getElementById('draft-notes').value.trim(),
                references: Array.from(referenceContainer.querySelectorAll('.reference-item')).map(item => ({
                    agency: item.querySelector('.ref-agency').value,
                    number: item.querySelector('.ref-number').value,
                    date: item.querySelector('.ref-date').value,
                    content: item.querySelector('.ref-content').value
                })),
                attachments: Array.from(attachmentContainer.querySelectorAll('.attachment-item')).map(item => ({
                    name: item.querySelector('.attachment-name').value
                }))
            };
            if(currentDraftIndex !== null) {
                docs[currentDraftIndex] = docData;
            } else {
                docs.push(docData);
            }
            localStorage.setItem(userKey('workDocs'), JSON.stringify(docs));
            draftModal.style.display = 'none';
            loadWorkDocs();
        });

        function loadWorkDocs() {
            const container = document.getElementById('work-doc-list');
            const docs = JSON.parse(localStorage.getItem(userKey('workDocs')) || '[]');
            if(!container) return;
            if(docs.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500">작성된 문서가 없습니다.</p>';
                return;
            }
            container.innerHTML = '<div class="divide-y divide-gray-200">' +
                docs.map((d,i)=>`<div class="p-3 flex justify-between items-center"><span>${d.title}</span><button class="edit-draft-btn btn btn-secondary btn-xs" data-index="${i}">편집</button></div>`).join('') +
                '</div>';
            container.querySelectorAll('.edit-draft-btn').forEach(btn => btn.addEventListener('click', e => {
                const idx = Number(e.target.dataset.index);
                openDraftModal(idx);
            }));
        }

        // ----- Manual Problem Item Helpers -----
        const manualItemMenu = document.getElementById('manual-item-menu');
        document.getElementById('add-manual-item-btn').addEventListener('click', () => {
            manualItemMenu.classList.toggle('hidden');
        });
        manualItemMenu.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
            addManualItem(btn.dataset.type);
            manualItemMenu.classList.add('hidden');
        }));

        document.getElementById('manual-problem-use-password').addEventListener('change', toggleManualProblemPassword);

        function toggleManualProblemPassword() {
            const chk = document.getElementById('manual-problem-use-password');
            const input = document.getElementById('manual-problem-password');
            input.disabled = !chk.checked;
            if(!chk.checked) input.value = '';
        }

        function addManualItem(type, data = {}) {
            const container = document.getElementById('manual-problem-items');
            const div = document.createElement('div');
            div.className = 'manual-item border p-2 rounded relative';
            div.dataset.type = type;
            let html = '';
            if (type === 'text' || type === 'aiText') {
                html += `<textarea class="item-text w-full p-2 border rounded" placeholder="내용">${data.content || ''}</textarea>`;
                if (type === 'aiText') html += `<button type="button" class="generate-ai-btn btn btn-secondary btn-xs mt-1">AI 생성</button>`;
            } else if (type === 'question' || type === 'aiQuestion') {
                html += `<input type="text" class="item-question w-full p-2 border rounded mb-2" placeholder="문제" value="${data.question || ''}">`;
                html += `<input type="text" class="item-answer w-full p-2 border rounded" placeholder="정답" value="${data.answer || ''}">`;
                if (type === 'aiQuestion') html += `<button type="button" class="generate-ai-question-btn btn btn-secondary btn-xs mt-1">AI 생성</button>`;
            } else if (type === 'questionNoAnswer') {
                html += `<input type="text" class="item-question w-full p-2 border rounded" placeholder="문제" value="${data.question || ''}">`;
            } else if (type === 'image') {
                html += `<input type="url" class="item-image-url w-full p-2 border rounded" placeholder="이미지 URL" value="${data.url || ''}">`;
            } else if (type === 'button') {
                html += `<input type="text" class="item-button-text w-full p-2 border rounded mb-2" placeholder="버튼 텍스트" value="${data.text || ''}">`;
                html += `<input type="url" class="item-button-url w-full p-2 border rounded" placeholder="링크 URL" value="${data.url || ''}">`;
            }
            html += `<div class="absolute top-1 right-1 space-x-1">
                        <button type="button" class="move-up btn btn-secondary btn-xs">▲</button>
                        <button type="button" class="move-down btn btn-secondary btn-xs">▼</button>
                        <button type="button" class="delete-item btn bg-red-500 hover:bg-red-600 text-white btn-xs">삭제</button>
                    </div>`;
            div.innerHTML = html;
            container.appendChild(div);
            div.querySelector('.delete-item').addEventListener('click', () => div.remove());
            div.querySelector('.move-up').addEventListener('click', () => {
                if (div.previousElementSibling) div.parentNode.insertBefore(div, div.previousElementSibling);
            });
            div.querySelector('.move-down').addEventListener('click', () => {
                if (div.nextElementSibling) div.parentNode.insertBefore(div.nextElementSibling, div);
            });
            if (type === 'aiText') {
                div.querySelector('.generate-ai-btn').addEventListener('click', () => {
                    openAiPromptModal(async prompt => {
                        if(!prompt) return;
                        const result = await callGemini(prompt);
                        div.querySelector('.item-text').value = result;
                    });
                });
            }
            if (type === 'aiQuestion') {
                div.querySelector('.generate-ai-question-btn').addEventListener('click', () => {
                    openAiPromptModal(async prompt => {
                        if(!prompt) return;
                        const result = await callGemini(prompt, true);
                        if(result.question) div.querySelector('.item-question').value = result.question;
                        if(result.answer) div.querySelector('.item-answer').value = result.answer;
                    });
                });
            }
        }

        function renderManualProblemItems(items) {
            return items.map((item, idx) => {
                if (item.type === 'text') {
                    return `<p>${item.content}</p>`;
                }
                if (item.type === 'question' || item.type === 'aiQuestion') {
                    return `
                        <div class="manual-question border p-2 rounded space-y-1" data-answer="${item.answer}" data-result="pending">
                            <p class="font-semibold flex items-center"><span class="manual-status-icon text-lg mr-2"></span>${idx + 1}. ${item.question}</p>
                            <div class="flex items-center mt-1">
                                <input type="text" class="manual-answer-input w-full p-2 border rounded-md form-input" placeholder="답변을 입력하세요">
                                <button type="button" class="manual-grade-btn btn btn-secondary text-xs px-3 py-2 ml-2 whitespace-nowrap">채점</button>
                            </div>
                            <p class="manual-correct-answer text-sm text-blue-600 mt-1 hidden">정답: ${item.answer}</p>
                        </div>`;
                }
                if (item.type === 'questionNoAnswer') {
                    return `
                        <div class="manual-question border p-2 rounded space-y-1" data-answer="" data-result="pending">
                            <p class="font-semibold flex items-center"><span class="manual-status-icon text-lg mr-2"></span>${idx + 1}. ${item.question}</p>
                            <div class="flex items-center mt-1">
                                <input type="text" class="manual-answer-input w-full p-2 border rounded-md form-input" placeholder="답변을 입력하세요">
                                <button type="button" class="manual-grade-btn btn btn-secondary text-xs px-3 py-2 ml-2 whitespace-nowrap" disabled>채점</button>
                            </div>
                        </div>`;
                }
                if (item.type === 'image') {
                    return `<img src="${item.url}" class="w-1/2 max-w-full h-auto object-contain mx-auto"/>`;
                }
                if (item.type === 'button') {
                    return `<a href="${item.url}" target="_blank" class="btn btn-primary inline-block">${item.text}</a>`;
                }
                return '';
            }).join('');
        }

        function setupManualProblemGrading() {
            document.querySelectorAll('#manual-problem-modal-content .manual-question').forEach(item => {
                const gradeBtn = item.querySelector('.manual-grade-btn');
                const inputEl = item.querySelector('.manual-answer-input');
                if (item.dataset.answer === '') {
                    gradeBtn.disabled = inputEl.value.trim() === '';
                    inputEl.addEventListener('input', () => {
                        gradeBtn.disabled = inputEl.value.trim() === '';
                    });
                }
                gradeBtn.addEventListener('click', () => {
                    gradeManualItem(item);
                    updateManualScore();
                });
            });
            document.getElementById('grade-all-manual-btn').onclick = () => {
                document.querySelectorAll('#manual-problem-modal-content .manual-question').forEach(item => gradeManualItem(item));
                updateManualScore();
            };
        }

        function gradeManualItem(item) {
            const answer = item.dataset.answer.trim();
            const inputEl = item.querySelector('.manual-answer-input');
            const userAnswer = inputEl.value.trim();
            const iconEl = item.querySelector('.manual-status-icon');
            const correctAnsEl = item.querySelector('.manual-correct-answer');
            let correct;
            if (answer) {
                correctAnsEl.classList.remove('hidden');
                correct = userAnswer === answer;
            } else {
                correct = true;
            }
            if (correct) {
                iconEl.innerHTML = '⭕';
                iconEl.classList.remove('text-yellow-400');
                iconEl.classList.add('text-red-500');
                item.dataset.result = 'correct';
            } else {
                iconEl.innerHTML = '⭐';
                iconEl.classList.remove('text-red-500');
                iconEl.classList.add('text-yellow-400');
                item.dataset.result = 'wrong';
            }
        }

        function calculateManualScore() {
            const items = document.querySelectorAll('#manual-problem-modal-content .manual-question');
            if (items.length === 0) return 100;
            let correctCount = 0;
            items.forEach(item => {
                if (item.dataset.result === 'correct') correctCount++;
            });
            return Math.round((correctCount / items.length) * 100);
        }

        function updateManualScore() {
            const score = calculateManualScore();
            document.getElementById('manual-score-display').textContent = `점수: ${score} / 100`;
            const completeBtn = document.getElementById('complete-manual-problem-btn');
            if (score === 100) {
                completeBtn.classList.remove('btn-disabled');
                completeBtn.disabled = false;
            } else {
                completeBtn.classList.add('btn-disabled');
                completeBtn.disabled = true;
            }
        }

        async function callGemini(prompt, json = false) {
            const apiKey = "AIzaSyC7_Gq4LIVVMv0hMD6qSwcTlGJcDSt-KgI";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: json ? { responseMimeType: 'application/json' } : {} };
            try {
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if(json) return JSON.parse(text);
                return text;
            } catch (e) {
                console.error('AI error', e);
                return json ? {} : '';
            }
        }

        // --- AI Prompt Modal ---
        let aiPromptCallback = null;
        const aiPromptModal = document.getElementById('ai-prompt-modal');
        document.getElementById('close-ai-prompt-modal-btn').addEventListener('click', closeAiPromptModal);
        document.getElementById('cancel-ai-prompt-btn').addEventListener('click', closeAiPromptModal);
        document.getElementById('confirm-ai-prompt-btn').addEventListener('click', () => {
            const prompt = document.getElementById('ai-prompt-input').value.trim();
            if (aiPromptCallback) aiPromptCallback(prompt);
            closeAiPromptModal();
        });

        function openAiPromptModal(callback) {
            aiPromptCallback = callback;
            document.getElementById('ai-prompt-input').value = '';
            aiPromptModal.style.display = 'flex';
        }

        function closeAiPromptModal() {
            aiPromptModal.style.display = 'none';
            aiPromptCallback = null;
        }
        
        // --- AI Dictation Feature ---

        function openDictationCreationModal(problemSet = null) {
            dictationCreationModal.style.display = 'flex';
            const form = document.getElementById('dictation-creation-form');
            form.reset();
            document.getElementById('dictation-problem-id').value = problemSet?.id || '';
            if (problemSet) {
                document.getElementById('dictation-title').value = problemSet.title;
                document.getElementById('dictation-type').value = problemSet.dictationType;
                document.getElementById('dictation-count').value = problemSet.count;
                document.getElementById('dictation-reward').value = problemSet.reward;
            }
        }

        document.getElementById('dictation-creation-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const problemId = document.getElementById('dictation-problem-id').value;
            const data = {
                type: 'dictation',
                title: document.getElementById('dictation-title').value,
                dictationType: document.getElementById('dictation-type').value,
                count: Number(document.getElementById('dictation-count').value),
                reward: Number(document.getElementById('dictation-reward').value),
                teacherId: currentAuthUser.uid,
                createdAt: serverTimestamp()
            };

            if (!data.title || !data.count || !data.reward) {
                showModal('오류', '모든 필드를 입력해주세요.');
                return;
            }

            try {
                if (problemId) {
                    await setDoc(doc(db, "learningProblems", problemId), data, { merge: true });
                } else {
                    await addDoc(collection(db, "learningProblems"), data);
                }
                dictationCreationModal.style.display = 'none';
                loadLearningProblems();
            } catch (error) {
                showModal('저장 실패', `오류: ${error.message}`);
            }
        });
        
        async function openDictationModal(assignmentId, problemId) {
            currentAssignmentId = assignmentId;
            const dataToShow = viewedUserData;

            const assignmentDoc = await getDoc(doc(db, `users/${dataToShow.id}/assignedHomework`, assignmentId));
            if (!assignmentDoc.exists()) {
                showModal('오류', '숙제 정보를 찾을 수 없습니다.');
                return;
            }
            const assignmentData = assignmentDoc.data();
            const isCompleted = assignmentData.status === 'completed';

            document.getElementById('dictation-modal-title').textContent = assignmentData.title;

            if (isCompleted) {
                // Review mode
                document.getElementById('dictation-initial-view').style.display = 'none';
                document.getElementById('dictation-main-view').style.display = 'block';
                document.getElementById('dictation-footer').style.display = 'none'; // Hide footer in review mode
                if (!assignmentData.problems) {
                    showModal('오류', '저장된 문제 내용을 찾을 수 없어 결과를 표시할 수 없습니다.');
                    dictationModal.style.display = 'none';
                    return;
                }
                renderDictationQuestions(assignmentData.problems, assignmentData.studentAnswers, true);
            } else {
                // Taking the test mode
                if (assignmentData.problems && Array.isArray(assignmentData.problems)) {
                    // Resume in-progress dictation
                    document.getElementById('dictation-initial-view').style.display = 'none';
                    document.getElementById('dictation-main-view').style.display = 'block';
                    document.getElementById('dictation-footer').style.display = 'flex';
                    const problemDoc = await getDoc(doc(db, "learningProblems", problemId));
                    if (problemDoc.exists()) {
                         currentDictationTemplate = problemDoc.data();
                    }
                    renderDictationQuestions(assignmentData.problems, [], false);
                } else {
                    // First time opening this assignment. Show topic input.
                    const problemDoc = await getDoc(doc(db, "learningProblems", problemId));
                    if (!problemDoc.exists()) {
                        showModal('오류', '받아쓰기 문제를 불러올 수 없습니다.');
                        return;
                    }
                    currentDictationTemplate = problemDoc.data();
                    
                    document.getElementById('dictation-initial-view').style.display = 'block';
                    document.getElementById('dictation-main-view').style.display = 'none';
                    document.getElementById('dictation-student-topic').value = '';
                    document.getElementById('dictation-content').innerHTML = '';
                }
            }
            
            dictationModal.style.display = 'flex';
        }

        document.getElementById('generate-dictation-questions-btn').addEventListener('click', async () => {
            const topic = document.getElementById('dictation-student-topic').value.trim();
            if (!topic) {
                showModal('오류', '주제를 입력해주세요.');
                return;
            }

            const { count, dictationType } = currentDictationTemplate;
            const typeText = dictationType === 'word' ? '단어' : '문장';
            const prompt = `초등학생을 위한 받아쓰기 연습. '${topic}'와(과) 관련된 ${typeText} ${count}개를 만들어줘. 응답은 반드시 JSON 형식으로 "items"라는 키 아래에 철자가 정확한 ${typeText} 배열로 제공해줘. 예: {"items": ["사과", "바나나", "딸기"]}`;
            
            const contentArea = document.getElementById('dictation-content');
            contentArea.innerHTML = `<div class="flex items-center justify-center p-4"><div class="loading-spinner"></div><p class="ml-2">AI가 문제를 만들고 있습니다...</p></div>`;
            document.getElementById('dictation-initial-view').style.display = 'none';
            document.getElementById('dictation-main-view').style.display = 'block';
            document.getElementById('dictation-footer').style.display = 'flex';


            const apiKey = "AIzaSyC7_Gq4LIVVMv0hMD6qSwcTlGJcDSt-KgI";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            };

            try {
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error(`API 요청 실패 (상태 코드: ${response.status})`);
                const result = await response.json();
                const jsonString = result.candidates[0].content.parts[0].text;
                const generatedData = JSON.parse(jsonString);

                if (!generatedData.items || !Array.isArray(generatedData.items)) {
                    throw new Error("AI가 유효한 형식의 문제를 생성하지 못했습니다.");
                }
                
                // Save generated questions to the assignment document immediately
                const assignmentRef = doc(db, `users/${currentUserData.id}/assignedHomework`, currentAssignmentId);
                await updateDoc(assignmentRef, {
                    problems: generatedData.items 
                });

                renderDictationQuestions(generatedData.items, [], false);

            } catch (error) {
                contentArea.innerHTML = `<p class="text-red-500 text-center">문제 생성 실패: ${error.message}</p>`;
                console.error(error);
            }
        });

        function renderDictationQuestions(items, studentAnswers = [], isReview = false) {
            const contentArea = document.getElementById('dictation-content');
            contentArea.innerHTML = items.map((item, index) => {
                const studentAnswer = studentAnswers[index] || '';
                const isCorrect = studentAnswer.trim() === item.trim();
                return `
                <div class="dictation-item border-b py-3" data-answer="${item}">
                    <div class="flex items-center">
                        <span class="font-bold mr-3">${index + 1}.</span>
                        <button class="speak-btn text-blue-500 hover:text-blue-700 mr-4 text-xl" data-text="${item}"><i class="fas fa-volume-up"></i></button>
                        <input type="text" class="student-answer-input w-full p-2 border rounded-md form-input" placeholder="받아쓰기" value="${studentAnswer}" ${isReview ? 'disabled' : ''}>
                    </div>
                    <div class="correct-answer-display ml-12 mt-1 ${isReview ? '' : 'hidden'}">
                        ${isReview ? `<p class="text-sm ${isCorrect ? 'text-green-600' : 'text-red-500'}">정답: ${item}</p>` : ''}
                    </div>
                </div>
            `}).join('');

            contentArea.querySelectorAll('.speak-btn').forEach(btn => btn.addEventListener('click', (e) => speak(e.currentTarget.dataset.text)));
        }
        
        document.getElementById('reveal-dictation-answers-btn').addEventListener('click', () => {
            document.querySelectorAll('.dictation-item').forEach(item => {
                const correctAnswer = item.dataset.answer;
                const studentAnswer = item.querySelector('.student-answer-input').value.trim();
                const isCorrect = studentAnswer === correctAnswer.trim();
                const displayEl = item.querySelector('.correct-answer-display');
                displayEl.innerHTML = `<p class="text-sm ${isCorrect ? 'text-green-600' : 'text-red-500'}">정답: ${correctAnswer}</p>`;
                displayEl.classList.remove('hidden');
            });
            const completeBtn = document.getElementById('complete-dictation-btn');
            completeBtn.classList.remove('btn-disabled');
            completeBtn.disabled = false;
        });

        document.getElementById('complete-dictation-btn').addEventListener('click', async () => {
            const btn = document.getElementById('complete-dictation-btn');
            if (!currentAssignmentId || isAdminViewing || btn.disabled) return;
            btn.disabled = true;
            btn.classList.add('btn-disabled');

            const userRef = doc(db, "users", currentUserData.id);
            const assignmentRef = doc(db, `users/${currentUserData.id}/assignedHomework`, currentAssignmentId);
            
            const studentAnswers = Array.from(document.querySelectorAll('#dictation-content .student-answer-input')).map(input => input.value);
            
            try {
                const reward = currentDictationTemplate.reward || 0;
                await updateDoc(assignmentRef, { 
                    status: 'completed',
                    studentAnswers: studentAnswers,
                    completedAt: serverTimestamp()
                });
                await updateDoc(userRef, { balance: increment(reward) });

                const userDoc = await getDoc(userRef);
                currentUserData = { id: userDoc.id, ...userDoc.data() };
                viewedUserData = currentUserData;

                dictationModal.style.display = 'none';
                showModal('숙제 완료!', `참 잘했어요! ${formatCurrency(reward)}을(를) 획득했습니다!`);
                updateDashboardDisplay();
                renderHomework();
            } catch (error) {
                showModal('오류', `숙제 완료 처리 중 오류가 발생했습니다: ${error.message}`);
            }
        });

        function openManualProblemCreationModal(problem = null) {
            manualProblemCreationModal.style.display = 'flex';
            const form = document.getElementById('manual-problem-form');
            form.reset();
            document.getElementById('manual-problem-id').value = problem?.id || '';
            const itemsContainer = document.getElementById('manual-problem-items');
            itemsContainer.innerHTML = '';
            document.getElementById('manual-problem-use-password').checked = false;
            document.getElementById('manual-problem-password').value = '';
            document.getElementById('manual-problem-password').disabled = true;
            document.getElementById('manual-problem-use-proof-code').checked = false;
            if (problem) {
                document.getElementById('manual-problem-title').value = problem.title;
                if (Array.isArray(problem.items)) {
                    problem.items.forEach(item => addManualItem(item.type, item));
                } else {
                    if (problem.content) addManualItem('text', { content: problem.content });
                    if (problem.link) addManualItem('button', { text: '링크', url: problem.link });
                }
                if (problem.password) {
                    document.getElementById('manual-problem-use-password').checked = true;
                    document.getElementById('manual-problem-password').disabled = false;
                    document.getElementById('manual-problem-password').value = problem.password;
                }
                if (problem.requireProof) {
                    document.getElementById('manual-problem-use-proof-code').checked = true;
                }
                document.getElementById('manual-problem-reward').value = problem.reward;
            }
            toggleManualProblemPassword();
        }

        document.getElementById('manual-problem-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const problemId = document.getElementById('manual-problem-id').value;
            const items = Array.from(document.querySelectorAll('#manual-problem-items .manual-item')).map(item => {
                const type = item.dataset.type;
                if (type === 'text' || type === 'aiText') {
                    return { type: 'text', content: item.querySelector('.item-text').value };
                }
                if (type === 'question') {
                    return { type: 'question', question: item.querySelector('.item-question').value, answer: item.querySelector('.item-answer').value };
                }
                if (type === 'questionNoAnswer') {
                    return { type: 'questionNoAnswer', question: item.querySelector('.item-question').value };
                }
                if (type === 'aiQuestion') {
                    return { type: 'question', question: item.querySelector('.item-question').value, answer: item.querySelector('.item-answer').value };
                }
                if (type === 'image') {
                    return { type: 'image', url: item.querySelector('.item-image-url').value };
                }
                if (type === 'button') {
                    return { type: 'button', text: item.querySelector('.item-button-text').value, url: item.querySelector('.item-button-url').value };
                }
            });

            const data = {
                type: 'manual',
                title: document.getElementById('manual-problem-title').value,
                items,
                password: document.getElementById('manual-problem-use-password').checked ? document.getElementById('manual-problem-password').value : '',
                requireProof: document.getElementById('manual-problem-use-proof-code').checked,
                reward: Number(document.getElementById('manual-problem-reward').value),
                teacherId: currentAuthUser.uid,
                createdAt: serverTimestamp()
            };
            if (!data.title || data.reward === '' || (document.getElementById('manual-problem-use-password').checked && !data.password)) {
                showModal('오류', '모든 필드를 입력해주세요.');
                return;
            }
            try {
                if (problemId) {
                    await setDoc(doc(db, 'learningProblems', problemId), data, { merge: true });
                } else {
                    await addDoc(collection(db, 'learningProblems'), data);
                }
                manualProblemCreationModal.style.display = 'none';
                loadLearningProblems();
            } catch (error) {
                showModal('저장 실패', `오류: ${error.message}`);
            }
        });

       async function openManualProblemModal(assignmentId, problemId) {
           currentAssignmentId = assignmentId;
           const dataToShow = viewedUserData;
            const assignmentDoc = await getDoc(doc(db, `users/${dataToShow.id}/assignedHomework`, assignmentId));
            const problemDoc = await getDoc(doc(db, 'learningProblems', problemId));
            if (!assignmentDoc.exists() || !problemDoc.exists()) {
                showModal('오류', '숙제 문제를 불러올 수 없습니다.');
                return;
            }
            const assignmentData = assignmentDoc.data();
            const problem = problemDoc.data();
            const isCompleted = assignmentData.status === 'completed';
            document.getElementById('manual-problem-modal-title').textContent = problem.title;
            const modalContent = document.getElementById('manual-problem-modal-content');
            if (Array.isArray(problem.items)) {
                modalContent.innerHTML = renderManualProblemItems(problem.items);
            } else {
                modalContent.textContent = problem.content || '';
            }
            const inputEl = document.getElementById('manual-problem-answer-input');
            const proofContainer = document.getElementById('proof-code-container');
            const proofInput = document.getElementById('proof-code-input');
            const resultMsg = document.getElementById('result-message');
            inputEl.value = '';
            inputEl.disabled = isCompleted;
            proofInput.value = '';
            resultMsg.textContent = '';
            proofInput.disabled = isCompleted;
            const hasPassword = !!problem.password;
            const needProof = !!problem.requireProof;
            inputEl.style.display = hasPassword ? 'block' : 'none';
            proofContainer.classList.toggle('hidden', !needProof);
            document.getElementById('manual-problem-footer').style.display = isCompleted ? 'none' : 'block';
            document.getElementById('manual-score-display').textContent = '';

            setupManualProblemGrading();
            updateManualScore();

            manualProblemModal.style.display = 'flex';
        }

        document.getElementById('verify-code-btn').addEventListener('click', async () => {
            const verifyBtn = document.getElementById('verify-code-btn');
            const codeInput = document.getElementById('proof-code-input');
            const resultMessage = document.getElementById('result-message');
            const code = codeInput.value;
            if (!code) { resultMessage.textContent = '코드를 입력해주세요.'; resultMessage.style.color = 'red'; return; }
            if (!auth.currentUser) { resultMessage.textContent = '인증 정보가 없습니다. 새로고침 해주세요.'; resultMessage.style.color = 'red'; return; }
            try {
                verifyBtn.disabled = true;
                resultMessage.textContent = '코드를 확인하는 중...';
                const verifyCodeFunction = httpsCallable(functions, 'verifyCode');
                const result = await verifyCodeFunction({ code });
                if (result.data.success) {
                    resultMessage.textContent = result.data.message;
                    resultMessage.style.color = 'green';
                } else {
                    resultMessage.textContent = result.data.message || '알 수 없는 오류가 발생했습니다.';
                    resultMessage.style.color = 'red';
                }
            } catch (error) {
                console.error('코드 검증 상세 오류:', error);
                resultMessage.textContent = `오류가 발생했습니다: ${error.message}`;
                resultMessage.style.color = 'red';
            } finally {
                verifyBtn.disabled = false;
            }
        });

       document.getElementById('complete-manual-problem-btn').addEventListener('click', async () => {
           const btn = document.getElementById('complete-manual-problem-btn');
           if (!currentAssignmentId || isAdminViewing || btn.disabled) return;
           btn.disabled = true;
           btn.classList.add('btn-disabled');
           if (calculateManualScore() !== 100) {
               showModal('오류', '모든 문제를 맞혀야 숙제 완료가 가능합니다.');
               return;
           }
            const answer = document.getElementById('manual-problem-answer-input').value.trim();
            const inputAnswers = Array.from(document.querySelectorAll('#manual-problem-modal-content .manual-answer-input')).map(el => el.value.trim());
            const assignmentRef = doc(db, `users/${currentUserData.id}/assignedHomework`, currentAssignmentId);
            const assignmentDoc = await getDoc(assignmentRef);
            const problemId = assignmentDoc.data().problemId;
            const problemDoc = await getDoc(doc(db, 'learningProblems', problemId));
            const correct = problemDoc.data().password || '';
            const needProof = !!problemDoc.data().requireProof;
            if (correct && answer !== correct) {
                showModal('오류', '암호가 틀렸습니다.');
                btn.disabled = false;
                btn.classList.remove('btn-disabled');
                return;
            }
            if (needProof) {
                const code = document.getElementById('proof-code-input').value.trim();
                if (!code) {
                    showModal('오류', '증명 코드를 입력해주세요.');
                    btn.disabled = false;
                    btn.classList.remove('btn-disabled');
                    return;
                }
                try {
                    const verifyCodeFunction = httpsCallable(functions, 'verifyCode');
                    const result = await verifyCodeFunction({ code });
                    if (!result.data.success) {
                        showModal('오류', result.data.message || '증명 코드가 올바르지 않습니다.');
                        btn.disabled = false;
                        btn.classList.remove('btn-disabled');
                        return;
                    }
                } catch (error) {
                    showModal('오류', `증명 코드 확인 중 오류가 발생했습니다: ${error.message}`);
                    btn.disabled = false;
                    btn.classList.remove('btn-disabled');
                    return;
                }
            }
            try {
                const reward = assignmentDoc.data().reward || 0;
                const userRef = doc(db, 'users', currentUserData.id);
                await updateDoc(assignmentRef, { status: 'completed', studentAnswers: [...inputAnswers, answer], completedAt: serverTimestamp() });
                await updateDoc(userRef, { balance: increment(reward) });
                const userDoc = await getDoc(userRef);
                currentUserData = { id: userDoc.id, ...userDoc.data() };
                viewedUserData = currentUserData;
                manualProblemModal.style.display = 'none';
                showModal('숙제 완료!', `참 잘했어요! ${formatCurrency(reward)}을(를) 획득했습니다!`);
                updateDashboardDisplay();
                renderHomework();
            } catch (error) {
                showModal('오류', `숙제 완료 처리 중 오류가 발생했습니다: ${error.message}`);
            }
        });


        async function loadPurchaseLog() {
            const logEl = document.getElementById('admin-purchase-log');
            logEl.innerHTML = '<li>기록을 불러오는 중...</li>';
            try {
                const q = query(collection(db, 'purchaseLog'), orderBy('purchasedAt', 'desc'));
                const logSnapshot = await getDocs(q);
                if (logSnapshot.empty) {
                    logEl.innerHTML = '<li>구매 기록이 없습니다.</li>';
                    return;
                }
                logEl.innerHTML = '';
                logSnapshot.forEach(logDoc => {
                    const log = logDoc.data();
                    const li = document.createElement('li');
                    li.className = "border-b pb-2 mb-2";
                    li.innerHTML = `
                        <p><span class="font-semibold">${log.studentName}</span> 학생이 <span class="font-semibold">${log.itemName}</span> 구매</p>
                        <p class="text-xs text-gray-500">${log.purchasedAt.toDate().toLocaleString('ko-KR')}</p>
                    `;
                    logEl.appendChild(li);
                });
            } catch(error) {
                console.error("Error loading purchase log:", error);
                logEl.innerHTML = `
                    <li class="text-red-500">기록 로드 실패</li>
                    <li class="text-xs text-gray-600 mt-2">
                        <b>원인:</b> Firestore 색인이 필요할 수 있습니다.<br>
                        <b>해결 방법:</b>
                        <ol class="list-decimal list-inside">
                            <li>브라우저의 개발자 도구(F12)를 열고 Console 탭을 확인하세요.</li>
                            <li>'FAILED_PRECONDITION' 또는 'The query requires an index'와 유사한 오류 메시지를 찾으세요.</li>
                            <li>오류 메시지 안에 있는 링크를 클릭하여 Firebase 콘솔에서 필요한 색인을 생성하세요. 색인이 생성되기까지 몇 분 정도 걸릴 수 있습니다.</li>
                        </ol>
                    </li>
                `;
            }
        }

        async function loadSignupLog() {
            const logEl = document.getElementById('admin-signup-log');
            logEl.innerHTML = '<li>기록을 불러오는 중...</li>';
            try {
                const q = query(collection(db, 'signupLog'), orderBy('signedUpAt', 'desc'));
                const logSnapshot = await getDocs(q);
                if (logSnapshot.empty) {
                    logEl.innerHTML = '<li>가입 기록이 없습니다.</li>';
                    return;
                }
                logEl.innerHTML = '';
                logSnapshot.forEach(logDoc => {
                    const log = logDoc.data();
                    const li = document.createElement('li');
                    li.className = "border-b pb-2 mb-2";
                    li.innerHTML = `
                        <p><span class="font-semibold">${log.name}</span>(코드: ${log.userCode})님이 새로 가입하셨습니다.</p>
                        <p class="text-xs text-gray-500">${log.signedUpAt.toDate().toLocaleString('ko-KR')}</p>
                    `;
                    logEl.appendChild(li);
                });
            } catch(error) {
                console.error("Error loading signup log:", error);
                logEl.innerHTML = `
                    <li class="text-red-500">기록 로드 실패</li>
                    <li class="text-xs text-gray-600 mt-2">
                        <b>원인:</b> Firestore 색인이 필요할 수 있습니다.<br>
                        <b>해결 방법:</b>
                        <ol class="list-decimal list-inside">
                            <li>브라우저의 개발자 도구(F12)를 열고 Console 탭을 확인하세요.</li>
                            <li>'FAILED_PRECONDITION' 또는 'The query requires an index'와 유사한 오류 메시지를 찾으세요.</li>
                            <li>오류 메시지 안에 있는 링크를 클릭하여 Firebase 콘솔에서 필요한 색인을 생성하세요. 색인이 생성되기까지 몇 분 정도 걸릴 수 있습니다.</li>
                        </ol>
                    </li>
                `;
            }
        }

        async function loadAdminMarket() {
            const container = document.getElementById('admin-market-list');
            if (!container) return;
            container.innerHTML = '<p>주식 정보를 불러오는 중...</p>';
            try {
                const qSnap = await getDocs(query(collection(db, 'stocks'), orderBy('name')));
                container.innerHTML = '';
                qSnap.forEach(docSnap => {
                    const stock = { id: docSnap.id, ...docSnap.data() };
                    const row = document.createElement('div');
                    row.className = 'flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-2 mb-2';
                    row.innerHTML = `
                        <div class="font-semibold">${stock.name} <span class="ml-2 text-sm text-gray-600">${formatCurrency(stock.price)}</span></div>
                        <div class="flex items-center space-x-2 mt-2 sm:mt-0">
                            <input type="number" data-stockid="${stock.id}" data-field="min" class="w-20 p-1 border rounded" value="${stock.minFluctuation || 0}">
                            <input type="number" data-stockid="${stock.id}" data-field="max" class="w-20 p-1 border rounded" value="${stock.maxFluctuation || 0}">
                            <button class="update-fluct-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs" data-stockid="${stock.id}">적용</button>
                        </div>`;
                    container.appendChild(row);
                });
                container.querySelectorAll('.update-fluct-btn').forEach(btn => btn.addEventListener('click', async (e) => {
                    const id = e.target.dataset.stockid;
                    const minInput = container.querySelector(`input[data-stockid="${id}"][data-field="min"]`);
                    const maxInput = container.querySelector(`input[data-stockid="${id}"][data-field="max"]`);
                    const min = Number(minInput.value);
                    const max = Number(maxInput.value);
                    await updateDoc(doc(db, 'stocks', id), { minFluctuation: min, maxFluctuation: max });
                    showModal('완료', '등락폭이 수정되었습니다.');
                }));
            } catch (error) {
                console.error('Error loading admin market:', error);
                container.innerHTML = '<p class="text-red-500">주식 정보를 불러오지 못했습니다.</p>';
            }
        }

        async function deleteAssignedHomework(assignmentId) {
            if (!isAdminViewing || !viewedUserData) return;
            showModal('숙제 삭제 확인', '정말로 이 학생의 숙제를 삭제하시겠습니까?', async () => {
                try {
                    await deleteDoc(doc(db, `users/${viewedUserData.id}/assignedHomework`, assignmentId));
                    modal.style.display = 'none';
                    showModal('성공', '숙제가 삭제되었습니다.');
                    renderHomework(); // Refresh the list
                } catch (error) {
                    showModal('오류', `삭제 중 오류가 발생했습니다: ${error.message}`);
                }
            });
        }

        async function deleteAssignedLifeRule(ruleId) {
            if (!isAdminViewing || !viewedUserData) return;
            showModal('생활 규칙 삭제 확인', '정말로 이 학생의 생활 규칙을 삭제하시겠습니까?', async () => {
                try {
                    await deleteDoc(doc(db, `users/${viewedUserData.id}/assignedLifeRules`, ruleId));
                    modal.style.display = 'none';
                    showModal('성공', '생활 규칙이 삭제되었습니다.');
                    renderLifeRulesForStudent(); // Refresh the list
                } catch (error) {
                    showModal('오류', `삭제 중 오류가 발생했습니다: ${error.message}`);
                }
            });
        }

        let bulkAssignmentType = null;
        let bulkSelectedStudents = [];

        async function openBulkAssignment(type) {
            bulkAssignmentType = type;
            bulkSelectedStudents = [];
            document.getElementById('bulk-step1').classList.remove('hidden');
            document.getElementById('bulk-step2').classList.add('hidden');
            document.getElementById('bulk-assignment-title').textContent = type === 'homework' ? '숙제 배부하기 - 학생 선택' : '생활 규칙 배부하기 - 학생 선택';
            const list = document.getElementById('bulk-student-list');
            list.innerHTML = '학생 목록 로딩 중...';
            document.getElementById('bulk-assignment-modal').style.display = 'flex';
            const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
            if (usersSnapshot.empty) { list.innerHTML = '배부할 학생이 없습니다.'; return; }
            list.innerHTML = usersSnapshot.docs.map(docSnap => {
                const s = {id: docSnap.id, ...docSnap.data()};
                return `<label class="flex items-center space-x-3 p-2 rounded hover:bg-gray-100"><input type="checkbox" data-studentid="${s.id}" class="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"><span>${s.name} (코드: ${s.userCode})</span></label>`;
            }).join('');
            const search = document.getElementById('bulk-student-search');
            search.value = '';
            search.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('#bulk-student-list label').forEach(lbl => {
                    lbl.style.display = lbl.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
                });
            };
        }

        async function loadBulkItems() {
            const container = document.getElementById('bulk-item-list');
            container.innerHTML = '목록 로딩 중...';
            if (bulkAssignmentType === 'homework') {
                const qSnap = await getDocs(query(collection(db, 'learningProblems'), where('teacherId', '==', currentUserData.id)));
                if (qSnap.empty) { container.innerHTML = '학습 문제가 없습니다.'; return; }
                container.innerHTML = qSnap.docs.map(d => `<label class="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded"><input type="radio" name="bulk-item" value="${d.id}" data-title="${d.data().title}"><span>${d.data().title}</span></label>`).join('');
            } else {
                const qSnap = await getDocs(query(collection(db, 'lifeRules'), where('teacherId', '==', currentUserData.id)));
                if (qSnap.empty) { container.innerHTML = '생활 규칙이 없습니다.'; return; }
                container.innerHTML = qSnap.docs.map(d => `<label class="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded"><input type="radio" name="bulk-item" value="${d.id}" data-title="${d.data().text}"><span>${d.data().text}</span></label>`).join('');
            }
        }

        document.getElementById('bulk-select-item-btn').addEventListener('click', async () => {
            bulkSelectedStudents = Array.from(document.querySelectorAll('#bulk-student-list input:checked')).map(i => i.dataset.studentid);
            if (bulkSelectedStudents.length === 0) { showModal('오류', '한 명 이상의 학생을 선택해주세요.'); return; }
            document.getElementById('bulk-step1').classList.add('hidden');
            document.getElementById('bulk-step2').classList.remove('hidden');
            document.getElementById('bulk-item-title').textContent = bulkAssignmentType === 'homework' ? '숙제 선택' : '생활 규칙 선택';
            await loadBulkItems();
        });

        document.getElementById('bulk-assign-btn').addEventListener('click', async () => {
            const sel = document.querySelector('#bulk-item-list input[name="bulk-item"]:checked');
            if (!sel) { showModal('오류', '배부할 항목을 선택해주세요.'); return; }
            try {
                if (bulkAssignmentType === 'homework') {
                    const docSnap = await getDoc(doc(db, 'learningProblems', sel.value));
                    const ps = docSnap.data();
                    for (const sid of bulkSelectedStudents) {
                        const data = { problemId: sel.value, type: ps.type, title: ps.title, reward: ps.reward, status: 'assigned', assignedAt: serverTimestamp() };
                        await addDoc(collection(db, `users/${sid}/assignedHomework`), data);
                    }
                } else {
                    const docSnap = await getDoc(doc(db, 'lifeRules', sel.value));
                    const rule = docSnap.data();
                    for (const sid of bulkSelectedStudents) {
                        const data = { ruleId: sel.value, text: rule.text, reward: rule.reward, repeatType: 'one-time', assignedAt: serverTimestamp(), lastCompletedAt: null };
                        await setDoc(doc(db, `users/${sid}/assignedLifeRules`, sel.value), data);
                    }
                }
                document.getElementById('bulk-assignment-modal').style.display = 'none';
                showModal('성공', `${bulkSelectedStudents.length}명의 학생에게 배부를 완료했습니다.`);
            } catch (error) {
                showModal('배부 실패', `오류: ${error.message}`);
            }
        });

        document.getElementById('close-bulk-assignment-modal-btn').addEventListener('click', () => document.getElementById('bulk-assignment-modal').style.display = 'none');

        // Close Modals
        document.getElementById('close-homework-modal-btn').addEventListener('click', () => homeworkModal.style.display = 'none');
        document.getElementById('close-problem-creation-modal-btn').addEventListener('click', () => problemCreationModal.style.display = 'none');
        document.getElementById('close-assignment-modal-btn').addEventListener('click', () => assignmentModal.style.display = 'none');
        document.getElementById('close-life-rule-modal-btn').addEventListener('click', () => lifeRuleModal.style.display = 'none');
        document.getElementById('close-dictation-creation-modal-btn').addEventListener('click', () => dictationCreationModal.style.display = 'none');
        document.getElementById('close-dictation-modal-btn').addEventListener('click', () => dictationModal.style.display = 'none');
        document.getElementById('close-manual-problem-creation-modal-btn').addEventListener('click', () => manualProblemCreationModal.style.display = 'none');
        document.getElementById('close-manual-problem-modal-btn').addEventListener('click', () => manualProblemModal.style.display = 'none');


        // --- Initial Load ---
        initializeAuthentication();
