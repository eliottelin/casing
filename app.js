// Load the case framework data
let caseData = null;
let selectedIndustry = null;

// Initialize app
async function init() {
    try {
        const response = await fetch('case_framework_data.json');
        caseData = await response.json();

        populateIndustryDropdown();
        renderComboCases();

        // Event listeners
        document.getElementById('industry-select').addEventListener('change', handleIndustryChange);
        document.getElementById('random-industry-btn').addEventListener('click', selectRandomIndustry);
        document.querySelector('.close-btn').addEventListener('click', closeModal);

        // Close modal on outside click
        document.getElementById('case-modal').addEventListener('click', (e) => {
            if (e.target.id === 'case-modal') {
                closeModal();
            }
        });

    } catch (error) {
        console.error('Error loading case data:', error);
        alert('Error loading case framework data. Please check console.');
    }
}

// Populate industry dropdown
function populateIndustryDropdown() {
    const select = document.getElementById('industry-select');

    caseData.industries.forEach(industry => {
        const option = document.createElement('option');
        option.value = industry.id;
        option.textContent = `${industry.icon} ${industry.name}`;
        select.appendChild(option);
    });
}

// Handle industry selection
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

// Select random industry
function selectRandomIndustry() {
    const randomIndex = Math.floor(Math.random() * caseData.industries.length);
    const randomIndustry = caseData.industries[randomIndex];

    document.getElementById('industry-select').value = randomIndustry.id;
    selectedIndustry = randomIndustry;
    displaySelectedIndustry();
    renderCaseCards(randomIndustry.id);
}

// Display selected industry
function displaySelectedIndustry() {
    const container = document.getElementById('selected-industry');
    const nameElement = document.getElementById('industry-name');

    nameElement.textContent = `${selectedIndustry.icon} ${selectedIndustry.name}`;
    container.classList.remove('hidden');
}

// Render case type cards
function renderCaseCards(industryId) {
    const grid = document.getElementById('case-grid');
    grid.innerHTML = '';

    const relevantCases = caseData.industry_relevance[industryId] || [];

    // Render all case types, highlight relevant ones
    Object.entries(caseData.case_types).forEach(([id, caseType]) => {
        const isRelevant = relevantCases.includes(id);
        const card = createCaseCard(caseType, isRelevant);
        grid.appendChild(card);
    });
}

// Create a case card element
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

// Show case detail in modal
function showCaseDetail(caseType) {
    const modal = document.getElementById('case-modal');
    const modalBody = document.getElementById('modal-body');

    const frameworkSteps = caseType.framework.steps
        .map(step => `<li>${step}</li>`)
        .join('');

    const questions = caseType.clarifying_questions
        .map(q => `<li>${q}</li>`)
        .join('');

    const pitfalls = caseType.common_pitfalls
        .map(p => `<li>${p}</li>`)
        .join('');

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

// Close modal
function closeModal() {
    document.getElementById('case-modal').classList.add('hidden');
}

// Render combo cases
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);