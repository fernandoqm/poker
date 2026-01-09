// ============================================
// Professional Scrum Poker - Enhanced JavaScript
// ============================================

// ===== Firebase Configuration =====
// TODO: Replace with your actual Firebase configuration from the Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyAuhgYTBqYb0Pq8ykYgT50d7bGFhtWKLv0",
    authDomain: "pokerplanning-5e23a.firebaseapp.com",
    projectId: "pokerplanning-5e23a",
    storageBucket: "pokerplanning-5e23a.firebasestorage.app",
    messagingSenderId: "399680514377",
    appId: "1:399680514377:web:566d33b361ae8c1acfd298"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===== State Management =====
const state = {
    roomId: null,
    participants: [],
    currentParticipantId: null,
    votes: {},
    votesVisible: false,
    unsubscribe: null // For Firestore listener
};

// ===== Avatar Colors =====
const avatarColors = [
    '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c',
    '#059669', '#0891b2', '#4f46e5', '#c026d3', '#dc2626'
];

// ===== Utility Functions =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

function getAvatarColor(index) {
    return avatarColors[index % avatarColors.length];
}

function saveToLocalStorage() {
    localStorage.setItem('scrumPokerParticipantId', state.currentParticipantId);
}

function loadFromLocalStorage() {
    state.currentParticipantId = localStorage.getItem('scrumPokerParticipantId');
}

// ===== DOM Elements =====
const elements = {
    addParticipantBtn: document.getElementById('addParticipantBtn'),
    addParticipantModal: document.getElementById('addParticipantModal'),
    addParticipantForm: document.getElementById('addParticipantForm'),
    participantNameInput: document.getElementById('participantName'),
    modalClose: document.getElementById('modalClose'),
    modalOverlay: document.getElementById('modalOverlay'),
    cancelBtn: document.getElementById('cancelBtn'),
    participantsGrid: document.getElementById('participantsGrid'),
    currentParticipantName: document.getElementById('currentParticipantName'),
    cardsContainer: document.getElementById('cardsContainer'),
    hideVotesBtn: document.getElementById('hideVotesBtn'),
    showVotesBtn: document.getElementById('showVotesBtn'),
    newRoundBtn: document.getElementById('newRoundBtn'),
    statistics: document.getElementById('statistics'),
    averageValue: document.getElementById('averageValue'),
    medianValue: document.getElementById('medianValue'),
    votesCount: document.getElementById('votesCount'),
    recommendationsSection: document.getElementById('recommendationsSection'),
    recommendationContent: document.getElementById('recommendationContent'),
    // Lobby Elements
    lobbyOverlay: document.getElementById('lobbyOverlay'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    roomCodeInput: document.getElementById('roomCodeInput'),
    roomInfoDisplay: document.getElementById('roomInfoDisplay'),
    currentRoomId: document.getElementById('currentRoomId'),
    copyRoomLink: document.getElementById('copyRoomLink')
};

// ===== Modal Functions =====
function openModal() {
    elements.addParticipantModal.classList.remove('hidden');
    elements.participantNameInput.focus();
}

function closeModal() {
    elements.addParticipantModal.classList.add('hidden');
    elements.addParticipantForm.reset();
}

// ===== Participant Functions =====
function addParticipant(name) {
    if (!state.roomId) return;

    const participant = {
        id: generateId(),
        name: name.trim(),
        color: getAvatarColor(state.participants.length)
    };

    const newParticipants = [...state.participants, participant];

    // If it's the first time this user joins any room, save their ID
    if (!state.currentParticipantId) {
        state.currentParticipantId = participant.id;
        saveToLocalStorage();
    }

    // Update Firestore
    db.collection('rooms').doc(state.roomId).update({
        participants: newParticipants
    }).catch(err => console.error("Error adding participant:", err));
}

function removeParticipant(id) {
    if (!state.roomId) return;

    const newParticipants = state.participants.filter(p => p.id !== id);
    const newVotes = { ...state.votes };
    delete newVotes[id];

    // Update Firestore
    db.collection('rooms').doc(state.roomId).update({
        participants: newParticipants,
        votes: newVotes
    }).catch(err => console.error("Error removing participant:", err));
}

function selectParticipant(id) {
    state.currentParticipantId = id;
    saveToLocalStorage();
    renderParticipants();
    updateCurrentParticipantDisplay();
    updateVotingCards();
}

function renderParticipants() {
    elements.participantsGrid.innerHTML = '';

    if (state.participants.length === 0) {
        elements.participantsGrid.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--color-text-muted); font-size: 0.875rem;">
                No hay participantes. Agregar uno para empezar.
            </div>
        `;
        return;
    }

    state.participants.forEach(participant => {
        const hasVoted = state.votes[participant.id] !== undefined;
        const isActive = state.currentParticipantId === participant.id;
        const vote = state.votes[participant.id];

        const item = document.createElement('div');
        item.className = `participant-item ${isActive ? 'active' : ''} ${hasVoted ? 'voted' : ''}`;

        // Show vote value if votes are visible and participant has voted
        let voteDisplay = '';
        if (state.votesVisible && hasVoted) {
            voteDisplay = `<span class="vote-badge-inline">${vote}</span>`;
        }

        item.innerHTML = `
            <div class="participant-avatar-small" style="background: ${participant.color}">
                ${getInitials(participant.name)}
            </div>
            <div class="participant-name-small">${participant.name}</div>
            ${voteDisplay}
            <button class="participant-remove-small" onclick="removeParticipant('${participant.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.closest('.participant-remove-small')) {
                selectParticipant(participant.id);
            }
        });

        elements.participantsGrid.appendChild(item);
    });
}

function updateCurrentParticipantDisplay() {
    if (state.currentParticipantId) {
        const participant = state.participants.find(p => p.id === state.currentParticipantId);
        elements.currentParticipantName.textContent = participant ? participant.name : 'Selecciona participante';
    } else {
        elements.currentParticipantName.textContent = 'Selecciona participante';
    }
}

// ===== Voting Functions =====
function vote(value) {
    if (!state.currentParticipantId) {
        alert('Por favor agrega un participante primero');
        openModal();
        return;
    }

    if (!state.roomId) return;

    const newVotes = { ...state.votes };
    newVotes[state.currentParticipantId] = value;

    // Update Firestore
    db.collection('rooms').doc(state.roomId).update({
        votes: newVotes
    }).catch(err => console.error("Error voting:", err));
}

function updateVotingCards() {
    const cards = elements.cardsContainer.querySelectorAll('.card');
    const currentVote = state.currentParticipantId ? state.votes[state.currentParticipantId] : null;

    cards.forEach(card => {
        const value = card.dataset.value;
        if (value === currentVote) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

// ===== Vote Visibility Functions =====
function hideVotes() {
    if (!state.roomId) return;
    db.collection('rooms').doc(state.roomId).update({
        votesVisible: false
    });
}

function showVotes() {
    if (!state.roomId) return;
    db.collection('rooms').doc(state.roomId).update({
        votesVisible: true
    });
}

function clearVotes() {
    if (!state.roomId) return;
    if (confirm('¿Limpiar todas las estimaciones de esta ronda?')) {
        db.collection('rooms').doc(state.roomId).update({
            votes: {},
            votesVisible: false
        });
    }
}

function newRound() {
    if (!state.roomId) return;
    db.collection('rooms').doc(state.roomId).update({
        votes: {},
        votesVisible: false
    });
}



// ===== Statistics Functions =====
function updateStatistics() {
    // Always update vote count (visible regardless of votesVisible state)
    elements.votesCount.textContent = `${Object.keys(state.votes).length}/${state.participants.length}`;

    // Only calculate and show average/median when votes are visible
    if (!state.votesVisible) {
        return;
    }

    const numericVotes = Object.values(state.votes)
        .filter(vote => !isNaN(parseFloat(vote)))
        .map(vote => parseFloat(vote));

    if (numericVotes.length === 0) {
        elements.averageValue.textContent = '-';
        elements.medianValue.textContent = '-';
        return;
    }

    // Calculate average
    const average = numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length;
    elements.averageValue.textContent = average.toFixed(1);

    // Calculate median
    const sorted = [...numericVotes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    elements.medianValue.textContent = median.toFixed(1);
}

// ===== Recommendations Function =====
function updateRecommendations() {
    if (!state.votesVisible || Object.keys(state.votes).length === 0) {
        elements.recommendationsSection.classList.add('hidden');
        return;
    }

    const numericVotes = Object.values(state.votes)
        .filter(vote => !isNaN(parseFloat(vote)))
        .map(vote => parseFloat(vote));

    if (numericVotes.length < 2) {
        elements.recommendationsSection.classList.add('hidden');
        return;
    }

    // Calculate standard deviation
    const average = numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length;
    const variance = numericVotes.reduce((sum, vote) => sum + Math.pow(vote - average, 2), 0) / numericVotes.length;
    const stdDev = Math.sqrt(variance);

    // Calculate range
    const min = Math.min(...numericVotes);
    const max = Math.max(...numericVotes);
    const range = max - min;

    let recommendation = '';
    let recommendationType = '';

    // Generate recommendations based on vote dispersion
    if (range === 0) {
        recommendation = `
            <div class="recommendation-title">✨ Consenso Perfecto</div>
            <p class="recommendation-text">
                Todo el equipo está de acuerdo con la estimación de <strong>${average}</strong> puntos. 
                ¡Excelente alineación! Pueden proceder con confianza.
            </p>
            <span class="recommendation-badge">Aprobado</span>
        `;
        recommendationType = 'success';
    } else if (stdDev <= 2) {
        recommendation = `
            <div class="recommendation-title">👍 Buena Convergencia</div>
            <p class="recommendation-text">
                Las estimaciones están bastante alineadas (rango: ${min}-${max}). 
                Se recomienda usar la <strong>mediana: ${elements.medianValue.textContent}</strong> como estimación final.
            </p>
            <span class="recommendation-badge">Consenso Alto</span>
        `;
        recommendationType = 'good';
    } else if (stdDev <= 5) {
        recommendation = `
            <div class="recommendation-title">💬 Discusión Recomendada</div>
            <p class="recommendation-text">
                Hay dispersión moderada en las estimaciones (${min}-${max}). 
                Se sugiere que los participantes con votos extremos expliquen su razonamiento antes de decidir.
            </p>
            <span class="recommendation-badge">Revisar</span>
        `;
        recommendationType = 'warning';
    } else {
        recommendation = `
            <div class="recommendation-title">⚠️ Gran Dispersión</div>
            <p class="recommendation-text">
                Existe una diferencia significativa entre las estimaciones (${min}-${max}). 
                <strong>¡Necesario discutir!</strong> El equipo tiene perspectivas muy diferentes. 
                Consideren hacer otra ronda de votación después de la discusión.
            </p>
            <span class="recommendation-badge">Acción Requerida</span>
        `;
        recommendationType = 'danger';
    }

    elements.recommendationContent.innerHTML = recommendation;
    elements.recommendationsSection.classList.remove('hidden');
}

// ===== Room Management Functions =====
function generateRoomCode() {
    const adjectives = ['blue', 'green', 'fast', 'smart', 'agile', 'cool', 'zen', 'bright'];
    const nouns = ['team', 'squad', 'group', 'poker', 'scrum', 'star', 'devs', 'flow'];
    const rand = () => Math.floor(Math.random() * 8);
    return `${adjectives[rand()]}-${nouns[rand()]}-${Math.floor(100 + Math.random() * 900)}`;
}

async function createRoom() {
    const roomId = generateRoomCode();
    try {
        await db.collection('rooms').doc(roomId).set({
            participants: [],
            votes: {},
            votesVisible: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        joinRoom(roomId);
    } catch (err) {
        alert('Error al crear la sala: ' + err.message);
    }
}

function joinRoom(roomId) {
    if (!roomId) return;
    roomId = roomId.toLowerCase().trim();

    // Clean up previous listener
    if (state.unsubscribe) {
        state.unsubscribe();
    }

    state.roomId = roomId;

    // Subscribe to Room updates
    state.unsubscribe = db.collection('rooms').doc(roomId).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            state.participants = data.participants || [];
            state.votes = data.votes || {};
            state.votesVisible = data.votesVisible || false;

            updateUI();

            // Show main app, hide lobby
            document.body.classList.add('app-active');
            elements.roomInfoDisplay.style.display = 'flex';
            elements.currentRoomId.textContent = roomId;

            // Update URL for sharing
            window.history.replaceState(null, '', `?room=${roomId}`);
        } else {
            alert('La sala no existe. Verifica el código.');
            document.body.classList.remove('app-active');
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, (err) => {
        console.error("Firestore Error:", err);
        alert('Error al conectar con la sala');
    });
}

function updateUI() {
    renderParticipants();
    updateCurrentParticipantDisplay();
    updateVotingCards();
    updateStatistics();

    if (state.votesVisible) {
        elements.hideVotesBtn.classList.remove('hidden');
        elements.showVotesBtn.classList.add('hidden');
        elements.statistics.classList.remove('hidden');
        updateRecommendations();
    } else {
        elements.hideVotesBtn.classList.add('hidden');
        elements.showVotesBtn.classList.remove('hidden');
        elements.statistics.classList.add('hidden');
        elements.recommendationsSection.classList.add('hidden');
    }
}

// ===== Event Listeners =====
function initEventListeners() {
    // Modal events
    elements.addParticipantBtn.addEventListener('click', openModal);
    elements.modalClose.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);

    // Form submit
    elements.addParticipantForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = elements.participantNameInput.value.trim();
        if (name) {
            addParticipant(name);
            closeModal();
        }
    });

    // Voting cards
    elements.cardsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (card) {
            vote(card.dataset.value);
        }
    });

    // Vote visibility
    elements.hideVotesBtn.addEventListener('click', hideVotes);
    elements.showVotesBtn.addEventListener('click', showVotes);

    // New round
    elements.newRoundBtn.addEventListener('click', newRound);

    // Lobby events
    elements.createRoomBtn.addEventListener('click', createRoom);
    elements.joinRoomBtn.addEventListener('click', () => {
        const code = elements.roomCodeInput.value;
        if (code) joinRoom(code);
    });
    elements.roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const code = elements.roomCodeInput.value;
            if (code) joinRoom(code);
        }
    });

    // Copy link
    elements.copyRoomLink.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            const originalColor = elements.currentRoomId.style.color;
            elements.currentRoomId.textContent = '¡Copiado!';
            elements.currentRoomId.style.color = 'var(--color-accent-light)';
            setTimeout(() => {
                elements.currentRoomId.textContent = state.roomId;
                elements.currentRoomId.style.color = originalColor;
            }, 2000);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key to close modal
        if (e.key === 'Escape' && !elements.addParticipantModal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// ===== Initialization =====
function init() {
    initEventListeners();
    loadFromLocalStorage();

    // Check for room in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        joinRoom(roomFromUrl);
    }
}

// ===== Start Application =====
document.addEventListener('DOMContentLoaded', init);

// ===== Global Functions (for inline event handlers) =====
window.removeParticipant = removeParticipant;
