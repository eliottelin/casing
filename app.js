// ===================== GLOBAL STATE =====================

let caseData = null;
let selectedIndustry = null;

let timerInterval = null;
let timerSeconds = 0;
let isPaused = false;
let practiceHistory = [];
let currentCaseSession = null;

// ===================== INIT =============================

async function init() {
    try {
        const response = await fetch('case_framework_data.json');
        caseData = await response.json();

        // Load practice history
        loadPracticeHistory();

        // Populate UI
        populateIndustryDropdown();
        populateAIGeneratorDropdowns();
        renderComboCases();
        updatePracticeStats();

        // Framework tab
        document.getElementById('industry-select').addEventListener('change', handleIndustryChange);
        document.getElementById('random-industry-btn').addEventListener('click', selectRandomIndustry);
        document.querySelector('.close-btn').addEventListener('click', closeModal);

        // Timer
        document.getElementById('start-timer-btn').addEventListener('click', startTimer);
        document.getElementById('pause-timer-btn').addEventListener('click', pauseTimer);
        document.getElementById('reset-timer-btn').addEventListener('click', resetTimer);
        document.getElementById('complete-case-btn').addEventListener('click', completeCase);

        // AI generation
        document.getElementById('generate-case-btn').addEventListener('click', generateAICase);

        // Settings
        document.getElementById('save-api-key-btn').addEventListener('click', saveAPIKey);
        document.getElementById('test-api-key-btn').addEventListener('click', testAPIKey);
        document.getElementById('clear-history-btn').addEventListener('click', clearHistory);

        // API key status + load into input
        updateAPIKeyStatus();
        loadAPIKey();

        // Close modal on outside click
        document.getElementById('case-modal').addEventListener('click', (e) => {
            if (e.target.id === 'case-modal') {
                closeModal();
            }
        });

        initTabs();
    } catch (error) {
        console.error('Error loading case data:', error);
        alert('Error loading case framework data. Please check console.');
    }
}

// ================= API KEY MANAGEMENT ===================

function updateAPIKeyStatus() {
    const apiKey = localStorage.getItem('tamu_api_key');
    const statusDiv = document.getElementById('api-key-status');

    if (apiKey && apiKey.length > 0) {
        statusDiv.innerHTML = '<p style="color: #28a745;">✅ API Key saved (length: ' + apiKey.length + ' characters)</p>';
    } else {
        statusDiv.innerHTML = '<p style="color: #dc3545;">❌ No API key saved</p>';
    }
}

function saveAPIKey() {
    const apiKey = document.getElementById('api-key-input').value.trim();

    if (!apiKey) {
        alert('Please enter an API key.');
        return;
    }
    if (apiKey.length < 10) {
        alert('API key seems too short. Please check and try again.');
        return;
    }

    localStorage.setItem('tamu_api_key', apiKey);
    console.log('API Key saved to localStorage:', apiKey.substring(0, 10) + '...');

    alert(
        'TAMU API key saved successfully!\n\n' +
        'Key length: ' + apiKey.length + ' characters\n\n' +
        'You can now generate AI cases.'
    );

    updateAPIKeyStatus();
}

function loadAPIKey() {
    const apiKey = localStorage.getItem('tamu_api_key');
    if (apiKey) {
        const input = document.getElementById('api-key-input');
        if (input) input.value = apiKey;
    }
}

async function testAPIKey() {
    const apiKey = localStorage.getItem('tamu_api_key');

    if (!apiKey) {
        alert('No API key found. Please save one first.');
        return;
    }

    const testBtn = document.getElementById('test-api-key-btn');
    testBtn.disabled = true;
    testBtn.textContent = '⏳ Testing...';

    try {
        const response = await fetch('https://chat-api.tamu.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'protected.gemini-2.0-flash-lite',
                messages: [
                    { role: 'user', content: 'Say "test successful" if you can read this.' }
                ],
                stream: false
            })
        });

        if (response.ok) {
            alert('✅ API Key is valid and working!');
        } else {
            const errorText = await response.text();
            alert('❌ API Key test failed.\n\nStatus: ' + response.status + '\nError: ' + errorText);
        }
    } catch (error) {
        alert('❌ Connection error: ' + error.message);
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = '🔍 Test API Key';
    }
}

// ========== AI GENERATOR DROPDOWNS ==========

function populateAIGeneratorDropdowns() {
    // Industry
    const aiIndustrySelect = document.getElementById('ai-industry-select');
    aiIndustrySelect.innerHTML = '<option value="">-- Choose an industry --</option>';

    caseData.industries.forEach(industry => {
        const option = document.createElement('option');
        option.value = industry.id;
        option.textContent = `${industry.icon} ${industry.name}`;
        aiIndustrySelect.appendChild(option);
    });

    // Case type
    const aiCaseSelect = document.getElementById('ai-case-select');
    aiCaseSelect.innerHTML = '<option value="">-- Choose a case type --</option>';

    Object.entries(caseData.case_types).forEach(([id, caseType]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${caseType.name} (${caseType.category})`;
        aiCaseSelect.appendChild(option);
    });
}

// ========== PRACTICE TRACKING ==========

function loadPracticeHistory() {
    const stored = localStorage.getItem('caseHistory');
    if (stored) {
        practiceHistory = JSON.parse(stored);
    }
}

function savePracticeHistory() {
    localStorage.setItem('caseHistory', JSON.stringify(practiceHistory));
}

function updatePracticeStats() {
    const totalCases = practiceHistory.length;
    const totalTime = practiceHistory.reduce((sum, session) => sum + session.duration, 0);
    const avgTime = totalCases > 0 ? Math.round(totalTime / totalCases) : 0;

    const caseTypeCounts = {};
    practiceHistory.forEach(session => {
        caseTypeCounts[session.caseType] = (caseTypeCounts[session.caseType] || 0) + 1;
    });

    document.getElementById('total-cases').textContent = totalCases;
    document.getElementById('total-time').textContent = formatTime(totalTime);
    document.getElementById('avg-time').textContent = formatTime(avgTime);

    renderPracticeHistory();
    updateWeakSpots(caseTypeCounts);
}

function renderPracticeHistory() {
    const container = document.getElementById('history-list');
    if (practiceHistory.length === 0) {
        container.innerHTML = '<p class="empty-state">No practice sessions yet. Start practicing!</p>';
        return;
    }

    const recentHistory = practiceHistory.slice(-10).reverse();

    container.innerHTML = recentHistory.map(session => `
        <div class="history-item">
            <div class="history-main">
                <strong>${session.caseType}</strong>
                <span class="history-industry">${session.industry || 'General'}</span>
            </div>
            <div class="history-meta">
                <span>⏱️ ${formatTime(session.duration)}</span>
                <span>${new Date(session.timestamp).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');
}

function updateWeakSpots(caseTypeCounts) {
    const container = document.getElementById('weak-spots');
    const allCaseTypes = Object.keys(caseData.case_types);
    const weakCases = allCaseTypes.filter(type => (caseTypeCounts[type] || 0) <= 1);

    if (weakCases.length === 0) {
        container.innerHTML = '<p class="success-message">Great! You\'ve practiced all case types multiple times.</p>';
        return;
    }

    container.innerHTML = weakCases.map(caseId => {
        const caseType = caseData.case_types[caseId];
        const count = caseTypeCounts[caseId] || 0;
        return `
            <div class="weak-spot-item">
                <span>${caseType.name}</span>
                <span class="practice-count">${count} time${count !== 1 ? 's' : ''}</span>
            </div>
        `;
    }).join('');
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all practice history? This cannot be undone.')) {
        practiceHistory = [];
        savePracticeHistory();
        updatePracticeStats();
        alert('Practice history cleared!');
    }
}

// ========== TIMER FUNCTIONS ==========

function startTimer() {
    if (!currentCaseSession) {
        alert('Please select a case type first by clicking a case card.');
        return;
    }

    isPaused = false;
    document.getElementById('timer-controls').classList.remove('hidden');
    document.getElementById('start-timer-btn').disabled = true;
    document.getElementById('pause-timer-btn').disabled = false;

    timerInterval = setInterval(() => {
        if (!isPaused) {
            timerSeconds++;
            updateTimerDisplay();
        }
    }, 1000);
}

function pauseTimer() {
    isPaused = !isPaused;
    document.getElementById('pause-timer-btn').textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
}

function resetTimer() {
    clearInterval(timerInterval);
    timerSeconds = 0;
    isPaused = false;
    updateTimerDisplay();
    document.getElementById('start-timer-btn').disabled = false;
    document.getElementById('pause-timer-btn').disabled = true;
    document.getElementById('pause-timer-btn').textContent = '⏸️ Pause';
}

function updateTimerDisplay() {
    document.getElementById('timer-display').textContent = formatTime(timerSeconds);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function completeCase() {
    if (!currentCaseSession) {
        alert('No case session active.');
        return;
    }

    clearInterval(timerInterval);

    const session = {
        caseType: currentCaseSession.name,
        industry: selectedIndustry ? selectedIndustry.name : null,
        duration: timerSeconds,
        timestamp: new Date().toISOString()
    };

    practiceHistory.push(session);
    savePracticeHistory();
    updatePracticeStats();

    alert(`Great job! You completed a ${currentCaseSession.name} case in ${formatTime(timerSeconds)}.`);

    resetTimer();
    currentCaseSession = null;
    document.getElementById('timer-controls').classList.add('hidden');
}

// ========== TAMU AI CASE GENERATION ==========

async function generateAICase() {
    const apiKey = localStorage.getItem('tamu_api_key');
    console.log('Retrieving API key from localStorage...');
    console.log('API key found:', apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No');

    if (!apiKey) {
        alert('Please enter your TAMU AI API key in the Settings tab first.\n\nGet your key at: https://tamu.ai/');
        document.querySelector('[data-tab="settings"]').click();
        return;
    }

    const aiIndustryId = document.getElementById('ai-industry-select').value;
    const aiCaseId = document.getElementById('ai-case-select').value;

    if (!aiIndustryId || !aiCaseId) {
        alert('Please select both an industry and a case type from the dropdowns above.');
        return;
    }

    const aiIndustry = caseData.industries.find(i => i.id === aiIndustryId);
    const aiCaseType = caseData.case_types[aiCaseId];

    const generateBtn = document.getElementById('generate-case-btn');
    const outputDiv = document.getElementById('ai-case-output');

    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating...';
    outputDiv.innerHTML = '<p class="loading">Generating custom case prompt using TAMU AI...</p>';

    try {
        const prompt = `You are a McKinsey case interview coach. Generate a realistic consulting case interview prompt.

Requirements:
- Case Type: ${aiCaseType.name}
- Industry: ${aiIndustry.name}
- Include: Client background (1-2 sentences), problem statement, key data points (2-3 metrics), and the question posed to the candidate
- Make it realistic and representative of actual MBB interviews
- Keep it concise (4-5 sentences total)

Generate the case prompt now:`;

        console.log('Calling TAMU API with key:', apiKey.substring(0, 10) + '...');

        const response = await fetch('https://chat-api.tamu.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'protected.gemini-2.0-flash-lite',
                messages: [
                    { role: 'system', content: 'You are a McKinsey case interview coach creating realistic case prompts.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.8,
                stream: false
            })
        });

        console.log('API Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const generatedCase = data.choices[0].message.content;

        outputDiv.innerHTML = `
            <div class="ai-case-result">
                <h4>🎯 Generated Case Prompt (via TAMU AI):</h4>
                <div class="case-metadata">
                    <strong>Industry:</strong> ${aiIndustry.icon} ${aiIndustry.name} • 
                    <strong>Type:</strong> ${aiCaseType.name}
                </div>
                <div class="generated-prompt">${generatedCase}</div>
                <button onclick="copyToClipboard(this)" class="btn-copy">📋 Copy to Clipboard</button>
            </div>
        `;
    } catch (error) {
        console.error('TAMU AI generation error:', error);
        outputDiv.innerHTML = `
            <div class="error-message">
                <p>❌ Error generating case: ${error.message}</p>
                <p><strong>Troubleshooting:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Check your TAMU API key is correct in Settings tab</li>
                    <li>Click "Test API Key" button in Settings to verify</li>
                    <li>Verify you're logged into TAMU with your NetID</li>
                    <li>Check daily token limit hasn't been exceeded (resets 6-7pm CT)</li>
                    <li>Get help at: <a href="https://docs.tamus.ai/" target="_blank">docs.tamus.ai</a></li>
                </ul>
                <p><strong>Debug Info:</strong></p>
                <p style="font-family: monospace; font-size: 0.85em; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                    API Key Length: ${apiKey ? apiKey.length : 0}<br>
                    Industry: ${aiIndustry ? aiIndustry.name : 'None'}<br>
                    Case Type: ${aiCaseType ? aiCaseType.name : 'None'}
                </p>
            </div>
        `;
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '🤖 Generate AI Case';
    }
}

function copyToClipboard(button) {
    const promptText = button.previousElementSibling.textContent;
    navigator.clipboard.writeText(promptText).then(() => {
        button.textContent = '✅ Copied!';
        setTimeout(() => {
            button.textContent = '📋 Copy to Clipboard';
        }, 2000);
    });
}

// ========== TAB SWITCHING ==========

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// ========== FRAMEWORK TAB (ORIGINAL) ==========

function populateIndustryDropdown() {
    const select = document.getElementById('industry-select');

    caseData.industries.forEach(industry => {
        const option = document.createElement('option');
        option.value = industry.id;
        option.textContent = `${industry.icon} ${industry.name}`;
        select.appendChild(option);
    });
}

function handleIndustryChange(e) {
    const industryId = e.target.value;

    if (!industryId) {
        document.getElementById('selected-industry').classList.add('hidden');
        document.getElementById('case-grid').innerHTML = '';
        return;
    }

    selectedIndustry = caseData.industries.find(i => i.id === industryId);
    displaySelectedIndustry();
    renderCaseCards(industryId);
}

function selectRandomIndustry() {
    const randomIndex = Math.floor(Math.random() * caseData.industries.length);
    const randomIndustry = caseData.industries[randomIndex];

    document.getElementById('industry-select').value = randomIndustry.id;
    selectedIndustry = randomIndustry;
    displaySelectedIndustry();
    renderCaseCards(randomIndustry.id);
}

function displaySelectedIndustry() {
    const container = document.getElementById('selected-industry');
    const nameElement = document.getElementById('industry-name');

    nameElement.textContent = `${selectedIndustry.icon} ${selectedIndustry.name}`;
    container.classList.remove('hidden');
}

function renderCaseCards(industryId) {
    const grid = document.getElementById('case-grid');
    grid.innerHTML = '';

    const relevantCases = caseData.industry_relevance[industryId] || [];

    Object.entries(caseData.case_types).forEach(([id, caseType]) => {
        const isRelevant = relevantCases.includes(id);
        const card = createCaseCard(caseType, isRelevant);
        grid.appendChild(card);
    });
}

function createCaseCard(caseType, isHighlighted) {
    const card = document.createElement('div');
    card.className = `case-card ${isHighlighted ? 'highlighted' : ''}`;
    card.onclick = () => showCaseDetail(caseType);

    const badgeClass = `badge-${caseType.category}`;

    card.innerHTML = `
        <span class="case-badge ${badgeClass}">${caseType.category}</span>
        <h3>${caseType.name}</h3>
        <div class="case-meta">
            ⏱️ ${caseType.duration} • 📊 ${caseType.difficulty}
        </div>
        <p>${caseType.description}</p>
    `;

    return card;
}

function showCaseDetail(caseType) {
    currentCaseSession = caseType;

    const modal = document.getElementById('case-modal');
    const modalBody = document.getElementById('modal-body');

    const frameworkSteps = caseType.framework.steps.map(step => `<li>${step}</li>`).join('');
    const questions = caseType.clarifying_questions.map(q => `<li>${q}</li>`).join('');
    const pitfalls = caseType.common_pitfalls.map(p => `<li>${p}</li>`).join('');
    const keyAreas = caseType.framework.key_areas.join(' • ');

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>${caseType.name}</h2>
            <p><strong>When to use:</strong> ${caseType.when_used}</p>
            <p style="color: #6c757d; margin-top: 8px;">⏱️ ${caseType.duration} • 📊 ${caseType.difficulty} difficulty</p>
        </div>

        <div class="modal-section">
            <h3>📋 Framework Steps</h3>
            <ol class="framework-steps">
                ${frameworkSteps}
            </ol>
        </div>

        <div class="modal-section">
            <h3>🔍 Key Areas to Explore</h3>
            <p style="line-height: 1.8; color: #555;">${keyAreas}</p>
        </div>

        <div class="modal-section">
            <h3>❓ Clarifying Questions to Ask</h3>
            <ul class="question-list">
                ${questions}
            </ul>
        </div>

        <div class="modal-section">
            <h3>⚠️ Common Pitfalls</h3>
            <ul class="pitfall-list">
                ${pitfalls}
            </ul>
        </div>

        <div class="modal-section">
            <h3>💡 Example Case Prompt</h3>
            <div class="example-prompt">
                "${caseType.example_prompt}"
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('case-modal').classList.add('hidden');
}

function renderComboCases() {
    const grid = document.getElementById('combo-grid');

    caseData.combo_cases.forEach(combo => {
        const card = document.createElement('div');
        card.className = 'combo-card';

        card.innerHTML = `
            <h4>${combo.name}</h4>
            <p>${combo.description}</p>
            <p class="combo-example"><strong>Example:</strong> ${combo.example}</p>
        `;

        grid.appendChild(card);
    });
}

// ========== BOOTSTRAP ==========

document.addEventListener('DOMContentLoaded', () => {
    init();
});