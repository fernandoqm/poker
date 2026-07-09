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
  appId: "1:399680514377:web:566d33b361ae8c1acfd298",
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
  unsubscribe: null, // For Firestore listener
};

// ===== Avatar Colors =====
const avatarColors = [
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#059669",
  "#0891b2",
  "#4f46e5",
  "#c026d3",
  "#dc2626",
];

// ===== Utility Functions =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getInitials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function getAvatarColor(index) {
  return avatarColors[index % avatarColors.length];
}

function saveToLocalStorage() {
  if (state.roomId) {
    if (state.currentParticipantId) {
      localStorage.setItem(
        `scrumPokerParticipantId_${state.roomId}`,
        state.currentParticipantId,
      );
    } else {
      localStorage.removeItem(`scrumPokerParticipantId_${state.roomId}`);
    }
  }
}

function loadFromLocalStorage() {
  if (state.roomId) {
    const savedId = localStorage.getItem(
      `scrumPokerParticipantId_${state.roomId}`,
    );
    state.currentParticipantId = savedId || null;
  }
}

// ===== DOM Elements =====
const elements = {
  addParticipantBtn: document.getElementById("addParticipantBtn"),
  addParticipantModal: document.getElementById("addParticipantModal"),
  addParticipantForm: document.getElementById("addParticipantForm"),
  participantNameInput: document.getElementById("participantName"),
  modalClose: document.getElementById("modalClose"),
  modalOverlay: document.getElementById("modalOverlay"),
  cancelBtn: document.getElementById("cancelBtn"),
  participantsGrid: document.getElementById("participantsGrid"),
  clearAllParticipantsBtn: document.getElementById("clearAllParticipantsBtn"),
  currentParticipantName: document.getElementById("currentParticipantName"),
  cardsContainer: document.getElementById("cardsContainer"),
  hideVotesBtn: document.getElementById("hideVotesBtn"),
  showVotesBtn: document.getElementById("showVotesBtn"),
  newRoundBtn: document.getElementById("newRoundBtn"),
  statistics: document.getElementById("statistics"),
  averageValue: document.getElementById("averageValue"),
  medianValue: document.getElementById("medianValue"),
  votesCount: document.getElementById("votesCount"),
  recommendationsSection: document.getElementById("recommendationsSection"),
  recommendationContent: document.getElementById("recommendationContent"),
  refreshRecommendationsBtn: document.getElementById(
    "refreshRecommendationsBtn",
  ),
  votingSection: document.getElementById("votingSection"),
  toggleCardsBtn: document.getElementById("toggleCardsBtn"),
  cardsGridContainer: document.getElementById("cardsContainer"),
  // Calculator Elements
  openCalculatorBtn: document.getElementById("openCalculatorBtn"),
  calculatorModal: document.getElementById("calculatorModal"),
  calculatorModalOverlay: document.getElementById("calculatorModalOverlay"),
  calculatorModalClose: document.getElementById("calculatorModalClose"),
  calcCriteria: document.getElementById("calcCriteria"),
  calcResultValue: document.getElementById("calcResultValue"),
  calcResultHint: document.getElementById("calcResultHint"),
  calcCancelBtn: document.getElementById("calcCancelBtn"),
  calcUseBtn: document.getElementById("calcUseBtn"),
  // Lobby Elements
  lobbyOverlay: document.getElementById("lobbyOverlay"),
  nicknameOverlay: document.getElementById("nicknameOverlay"),
  nicknameForm: document.getElementById("nicknameForm"),
  nicknameInput: document.getElementById("nicknameInput"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  roomInfoDisplay: document.getElementById("roomInfoDisplay"),
  currentRoomId: document.getElementById("currentRoomId"),
  copyRoomLink: document.getElementById("copyRoomLink"),
};

// ===== Modal Functions =====
function openModal() {
  elements.addParticipantModal.classList.remove("hidden");
  elements.participantNameInput.focus();
}

function closeModal() {
  elements.addParticipantModal.classList.add("hidden");
  elements.addParticipantForm.reset();
}

// ===== Estimation Calculator =====
// All 4 criteria carry equal weight, per standard story-point theory: points
// represent effort + complexity + risk, and time is a correlated signal, not
// the driver. Tiempo has more selectable positions (10 vs. 5) for finer input
// precision, but each criterion's level is normalized to a common 1-5 scale
// before summing, so no criterion outweighs another just for having more ticks.
const CALC_SCORE_MAP = [
  { max: 4.22, value: "0.5" },
  { max: 4.67, value: "1" },
  { max: 6.61, value: "2" },
  { max: 9.56, value: "3" },
  { max: 11.5, value: "5" },
  { max: 12.94, value: "8" },
  { max: 15.39, value: "13" },
  { max: 18.33, value: "20" },
  { max: 19.78, value: "40" },
  { max: Infinity, value: "100" },
];

let calcScores = {};
// Populated by initFader(): criterion -> total selectable positions on its fader
const criterionLevels = {};

// Populated by initCalculatorFaders(): criterion -> setLevel(level) function
const faderSetters = {};

function getSuggestedCard(total) {
  const match = CALC_SCORE_MAP.find((row) => total <= row.max);
  return match ? match.value : null;
}

// Rescales a criterion's raw level onto a common 1-5 scale, regardless of
// how many positions that criterion's fader actually has.
function normalizedScore(criterion) {
  const level = calcScores[criterion];
  const levels = criterionLevels[criterion];
  return 1 + ((level - 1) / (levels - 1)) * 4;
}

function updateCalcResult() {
  const total = Object.keys(calcScores).reduce(
    (sum, criterion) => sum + normalizedScore(criterion),
    0,
  );
  const suggested = getSuggestedCard(total);

  elements.calcResultValue.textContent = suggested;
  elements.calcResultHint.textContent = `Puntaje total: ${total.toFixed(1)}/20`;
  elements.calcUseBtn.dataset.value = suggested;
}

function levelFromClientY(track, clientY, levels) {
  const rect = track.getBoundingClientRect();
  const ratio = 1 - (clientY - rect.top) / rect.height;
  const level = Math.round(ratio * (levels - 1)) + 1;
  return Math.min(levels, Math.max(1, level));
}

function initFader(track) {
  const group = track.closest(".calc-group");
  const criterion = group.dataset.criterion;
  const labels = group.dataset.labels.split(",");
  const levels = labels.length;
  const handle = track.querySelector(".calc-fader-handle");
  const valueLabel = group.querySelector(".calc-slider-value");
  const ticksContainer = track.querySelector(".calc-fader-ticks");

  criterionLevels[criterion] = levels;

  ticksContainer.innerHTML = "";
  for (let i = 0; i < levels; i++) {
    ticksContainer.appendChild(document.createElement("span"));
  }

  function setLevel(level) {
    calcScores[criterion] = level;
    const pct = ((level - 1) / (levels - 1)) * 100;
    handle.style.bottom = `${pct}%`;
    valueLabel.textContent = labels[level - 1];
    updateCalcResult();
  }

  track.addEventListener("pointerdown", (e) => {
    track.classList.add("dragging");
    setLevel(levelFromClientY(track, e.clientY, levels));
    try {
      handle.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore: capture is a drag-tracking nicety, not required for the click-to-set behavior.
    }
  });
  track.addEventListener("pointermove", (e) => {
    if (!track.classList.contains("dragging")) return;
    setLevel(levelFromClientY(track, e.clientY, levels));
  });

  faderSetters[criterion] = () => setLevel(Math.ceil(levels / 2));
  setLevel(Math.ceil(levels / 2));
}

function initCalculatorFaders() {
  elements.calcCriteria
    .querySelectorAll(".calc-fader-track")
    .forEach(initFader);

  // Safety net: if a drag ends outside the track (or setPointerCapture
  // silently failed), this guarantees "dragging" always gets cleared.
  const stopDragging = () => {
    elements.calcCriteria
      .querySelectorAll(".calc-fader-track.dragging")
      .forEach((t) => t.classList.remove("dragging"));
  };
  window.addEventListener("pointerup", stopDragging);
  window.addEventListener("pointercancel", stopDragging);
}

function openCalculatorModal() {
  elements.calculatorModal.classList.remove("hidden");
}

function closeCalculatorModal() {
  elements.calculatorModal.classList.add("hidden");
  Object.values(faderSetters).forEach((resetLevel) => resetLevel());
}

// ===== Participant Functions =====
function addParticipant(name) {
  if (!state.roomId) return;

  // Prevent duplicate registration if already registering
  if (state.currentParticipantId) return;

  const participant = {
    id: generateId(),
    name: name.trim(),
    color: getAvatarColor(state.participants.length),
  };

  // Set ID immediately BEFORE Firestore call to prevent race condition with onSnapshot
  state.currentParticipantId = participant.id;
  saveToLocalStorage();

  // Use arrayUnion for atomic addition - prevents race conditions
  db.collection("rooms")
    .doc(state.roomId)
    .update({
      participants: firebase.firestore.FieldValue.arrayUnion(participant),
    })
    .then(() => {
      updateUI();
    })
    .catch((err) => {
      // Rollback on error
      state.currentParticipantId = null;
      saveToLocalStorage();
      console.error("Error adding participant:", err);
    });
}

function removeParticipant(id) {
  if (!state.roomId) return;

  const participantToRemove = state.participants.find((p) => p.id === id);
  if (!participantToRemove) return;

  // Atomic update in Firestore: remove participant from array and delete their specific vote field
  db.collection("rooms")
    .doc(state.roomId)
    .update({
      participants:
        firebase.firestore.FieldValue.arrayRemove(participantToRemove),
      [`votes.${id}`]: firebase.firestore.FieldValue.delete(),
    })
    .catch((err) => console.error("Error removing participant:", err));
}

function clearAllParticipants() {
  if (!state.roomId) return;

  const count = state.participants.length;
  if (count === 0) return;

  if (
    !confirm(
      `¿Eliminar todos los participantes? Se borrarán ${count} participante(s) y sus votos.`,
    )
  ) {
    return;
  }

  // Clear current user's identity
  state.currentParticipantId = null;
  saveToLocalStorage();

  // Clear all participants and votes
  db.collection("rooms")
    .doc(state.roomId)
    .update({
      participants: [],
      votes: {},
    })
    .catch((err) => console.error("Error clearing participants:", err));
}

function selectParticipant(id) {
  // Validation: Only allow selection if the user doesn't have an ID yet
  // or if they are re-selecting their own ID (redundant but safe)
  if (!state.currentParticipantId) {
    state.currentParticipantId = id;
    saveToLocalStorage();
    updateUI();
  } else if (state.currentParticipantId !== id) {
    console.warn("Security: Attempted to switch identity to " + id);
  }
}

function renderParticipants() {
  // 1. Handle empty state
  if (state.participants.length === 0) {
    elements.participantsGrid.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--color-text-muted); font-size: 0.875rem;">
                No hay participantes. Agregar uno para empezar.
            </div>
        `;
    return;
  }

  // 2. Identify existing DOM elements to avoid full re-render (smart update)
  const currentNodes = Array.from(elements.participantsGrid.children);
  const currentIds = currentNodes
    .map((node) => node.dataset.id)
    .filter((id) => id);

  // Filter out if it was the empty message
  if (
    elements.participantsGrid.querySelector('[style*="text-align: center"]')
  ) {
    elements.participantsGrid.innerHTML = "";
  }

  // 3. Update or Add participants
  let participantsToRender = [...state.participants];

  // Sort by vote if visible
  if (state.votesVisible) {
    participantsToRender.sort((a, b) => {
      const voteA = state.votes[a.id];
      const voteB = state.votes[b.id];

      // Handle non-numeric votes (like '?') or missing votes
      // We'll treat non-numeric as 0 for sorting purposes, or put them at the end.
      // Let's use parseFloat. If NaN (e.g. coffee cup), treat as -1 so they go last?
      // Or just treat as 0.
      const valA = parseFloat(voteA);
      const valB = parseFloat(voteB);

      const numA = isNaN(valA) ? 0 : valA;
      const numB = isNaN(valB) ? 0 : valB;

      return numB - numA;
    });
  }

  participantsToRender.forEach((participant) => {
    const hasVoted = state.votes[participant.id] !== undefined;
    const isActive = state.currentParticipantId === participant.id;
    const vote = state.votes[participant.id];
    const voteDisplayValue =
      state.votesVisible && hasVoted
        ? `<span class="vote-badge-inline">${vote}</span>`
        : "";

    let item = currentNodes.find((node) => node.dataset.id === participant.id);

    if (!item) {
      // New participant, create element
      item = document.createElement("div");
      item.dataset.id = participant.id;
      item.addEventListener("click", (e) => {
        if (!e.target.closest(".participant-remove-small")) {
          if (!state.currentParticipantId) {
            selectParticipant(participant.id);
          }
        }
      });
    }

    // ALWAYS append to ensure order matches sorted array
    elements.participantsGrid.appendChild(item);

    // Update classes and content only if changed (prevents flickering)
    const newClassName = `participant-item ${isActive ? "active" : ""} ${hasVoted ? "voted" : ""}`;
    if (item.className !== newClassName) {
      item.className = newClassName;
    }

    const newHTML = `
            <div class="participant-avatar-small" style="background: ${participant.color}">
                ${getInitials(participant.name)}
            </div>
            <div class="participant-name-small">${participant.name}</div>
            ${voteDisplayValue}
            <button class="participant-remove-small" onclick="removeParticipant('${participant.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

    if (item.innerHTML !== newHTML) {
      item.innerHTML = newHTML;
    }
  });

  // 4. Remove elements for participants who left
  currentNodes.forEach((node) => {
    const id = node.dataset.id;
    if (id && !state.participants.find((p) => p.id === id)) {
      node.remove();
    }
  });
}

function updateCurrentParticipantDisplay() {
  if (state.currentParticipantId) {
    const participant = state.participants.find(
      (p) => p.id === state.currentParticipantId,
    );
    elements.currentParticipantName.textContent = participant
      ? participant.name
      : "Selecciona participante";
  } else {
    elements.currentParticipantName.textContent = "Selecciona participante";
  }
}

// ===== Voting Functions =====
function vote(value) {
  if (!state.currentParticipantId) {
    alert("Por favor agrega un participante primero");
    openModal();
    return;
  }

  if (!state.roomId) return;

  // Use dot notation for atomic update of nested field - prevents race conditions
  db.collection("rooms")
    .doc(state.roomId)
    .update({
      [`votes.${state.currentParticipantId}`]: value,
    })
    .catch((err) => console.error("Error voting:", err));
}

function updateVotingCards() {
  const cards = elements.cardsContainer.querySelectorAll(".card");
  const currentVote = state.currentParticipantId
    ? state.votes[state.currentParticipantId]
    : null;

  cards.forEach((card) => {
    const value = card.dataset.value;
    if (value === currentVote) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

// ===== Vote Visibility Functions =====
function hideVotes() {
  if (!state.roomId) return;
  db.collection("rooms").doc(state.roomId).update({
    votesVisible: false,
  });
}

function showVotes() {
  if (!state.roomId) return;
  db.collection("rooms").doc(state.roomId).update({
    votesVisible: true,
  });
}

function clearVotes() {
  if (!state.roomId) return;
  if (confirm("¿Limpiar todas las estimaciones de esta ronda?")) {
    db.collection("rooms").doc(state.roomId).update({
      votes: {},
      votesVisible: false,
    });
  }
}

function newRound() {
  if (!state.roomId) return;

  // Only ask for confirmation if there are votes
  const voteCount = Object.keys(state.votes).length;
  if (voteCount > 0) {
    if (!confirm(`¿Iniciar nueva ronda? Se borrarán ${voteCount} voto(s).`)) {
      return;
    }
  }

  db.collection("rooms").doc(state.roomId).update({
    votes: {},
    votesVisible: false,
  });
}

function toggleCardsSection() {
  const cardsGrid = elements.cardsGridContainer;
  const toggleBtn = elements.toggleCardsBtn;

  cardsGrid.classList.toggle("collapsed");
  toggleBtn.classList.toggle("collapsed");
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
    .filter((vote) => !isNaN(parseFloat(vote)))
    .map((vote) => parseFloat(vote));

  if (numericVotes.length === 0) {
    elements.averageValue.textContent = "-";
    elements.medianValue.textContent = "-";
    return;
  }

  // Calculate average
  const average =
    numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length;
  elements.averageValue.textContent = average.toFixed(1);

  // Calculate median
  const sorted = [...numericVotes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  elements.medianValue.textContent = median.toFixed(1);
}

// ===== Recommendations Function =====
function updateRecommendations() {
  if (!state.votesVisible || Object.keys(state.votes).length === 0) {
    elements.recommendationsSection.classList.add("hidden");
    return;
  }

  const numericVotes = Object.values(state.votes)
    .filter((vote) => !isNaN(parseFloat(vote)))
    .map((vote) => parseFloat(vote));

  if (numericVotes.length < 2) {
    elements.recommendationsSection.classList.add("hidden");
    return;
  }

  // Calculate standard deviation
  const average =
    numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length;
  const variance =
    numericVotes.reduce((sum, vote) => sum + Math.pow(vote - average, 2), 0) /
    numericVotes.length;
  const stdDev = Math.sqrt(variance);

  // Calculate range
  const min = Math.min(...numericVotes);
  const max = Math.max(...numericVotes);
  const range = max - min;

  let recommendation = "";
  let recommendationType = "";

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
    recommendationType = "success";
  } else if (stdDev <= 2) {
    recommendation = `
            <div class="recommendation-title">👍 Buena Convergencia</div>
            <p class="recommendation-text">
                Las estimaciones están bastante alineadas (rango: ${min}-${max}). 
                Se recomienda usar la <strong>mediana: ${elements.medianValue.textContent}</strong> como estimación final.
            </p>
            <span class="recommendation-badge">Consenso Alto</span>
        `;
    recommendationType = "good";
  } else if (stdDev <= 5) {
    recommendation = `
            <div class="recommendation-title">💬 Discusión Recomendada</div>
            <p class="recommendation-text">
                Hay dispersión moderada en las estimaciones (${min}-${max}). 
                Se sugiere que los participantes con votos extremos expliquen su razonamiento antes de decidir.
            </p>
            <span class="recommendation-badge">Revisar</span>
        `;
    recommendationType = "warning";
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
    recommendationType = "danger";
  }

  elements.recommendationContent.innerHTML = recommendation;
  elements.recommendationsSection.classList.remove("hidden");
}

// ===== Room Management Functions =====
function generateRoomCode() {
  const adjectives = [
    "blue",
    "green",
    "fast",
    "smart",
    "agile",
    "cool",
    "zen",
    "bright",
  ];
  const nouns = [
    "team",
    "squad",
    "group",
    "poker",
    "scrum",
    "star",
    "devs",
    "flow",
  ];
  const rand = () => Math.floor(Math.random() * 8);
  return `${adjectives[rand()]}-${nouns[rand()]}-${Math.floor(100 + Math.random() * 900)}`;
}

async function createRoom() {
  const roomId = generateRoomCode();
  try {
    await db.collection("rooms").doc(roomId).set({
      participants: [],
      votes: {},
      votesVisible: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    joinRoom(roomId);
  } catch (err) {
    alert("Error al crear la sala: " + err.message);
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

  // Load identity BEFORE subscribing to prevent showing nickname overlay unnecessarily
  loadFromLocalStorage();

  // Subscribe to Room updates
  state.unsubscribe = db
    .collection("rooms")
    .doc(roomId)
    .onSnapshot(
      (doc) => {
        if (doc.exists) {
          const data = doc.data();
          state.participants = data.participants || [];
          state.votes = data.votes || {};
          state.votesVisible = data.votesVisible || false;

          updateUI();

          // Hide Lobby always
          elements.lobbyOverlay.classList.add("hidden");

          if (!state.currentParticipantId) {
            // Show identity overlay if we don't know who this is
            elements.nicknameOverlay.classList.remove("hidden");
            document.body.classList.remove("app-active");
          } else {
            // We have an ID, but check if it's still valid in the room
            const exists = state.participants.find(
              (p) => p.id === state.currentParticipantId,
            );
            if (exists) {
              elements.nicknameOverlay.classList.add("hidden");
              document.body.classList.add("app-active");
            } else {
              // ID cleared (maybe deleted), show name entry again
              state.currentParticipantId = null;
              elements.nicknameOverlay.classList.remove("hidden");
              document.body.classList.remove("app-active");
            }
          }

          elements.roomInfoDisplay.style.display = "flex";
          elements.currentRoomId.textContent = roomId;

          // Update URL for sharing
          window.history.replaceState(null, "", `?room=${roomId}`);
        } else {
          alert("La sala no existe. Verifica el código.");
          document.body.classList.remove("app-active");
          window.history.replaceState(null, "", window.location.pathname);
        }
      },
      (err) => {
        console.error("Firestore Error:", err);
        alert("Error al conectar con la sala");
      },
    );
}

function updateUI() {
  // Check if the saved ID still exists in the room
  if (
    state.currentParticipantId &&
    !state.participants.find((p) => p.id === state.currentParticipantId)
  ) {
    // If the ID was deleted or doesn't exist, clear it locally to allow re-joining
    state.currentParticipantId = null;
    saveToLocalStorage();
  }

  renderParticipants();
  updateCurrentParticipantDisplay();
  updateVotingCards();
  updateStatistics();

  // Hide 'Add Participant' button if the user is already registered
  if (state.currentParticipantId) {
    elements.addParticipantBtn.classList.add("hidden");
  } else {
    elements.addParticipantBtn.classList.remove("hidden");
  }

  if (state.votesVisible) {
    elements.hideVotesBtn.classList.remove("hidden");
    elements.showVotesBtn.classList.add("hidden");
    elements.statistics.classList.remove("hidden");
    updateRecommendations();
  } else {
    elements.hideVotesBtn.classList.add("hidden");
    elements.showVotesBtn.classList.remove("hidden");
    elements.statistics.classList.add("hidden");
    elements.recommendationsSection.classList.add("hidden");
  }
}

// ===== Event Listeners =====
function initEventListeners() {
  // Modal events
  elements.addParticipantBtn.addEventListener("click", openModal);
  elements.clearAllParticipantsBtn.addEventListener(
    "click",
    clearAllParticipants,
  );
  elements.modalClose.addEventListener("click", closeModal);
  elements.modalOverlay.addEventListener("click", closeModal);
  elements.cancelBtn.addEventListener("click", closeModal);

  // Form submit
  elements.addParticipantForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = elements.participantNameInput.value.trim();
    if (name) {
      addParticipant(name);
      closeModal();
    }
  });

  // Voting cards
  elements.cardsContainer.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) {
      vote(card.dataset.value);
    }
  });

  // Vote visibility
  elements.hideVotesBtn.addEventListener("click", hideVotes);
  elements.showVotesBtn.addEventListener("click", showVotes);

  // Refresh recommendations
  elements.refreshRecommendationsBtn.addEventListener("click", () => {
    elements.refreshRecommendationsBtn.classList.add("rotating");
    updateRecommendations();
    setTimeout(() => {
      elements.refreshRecommendationsBtn.classList.remove("rotating");
    }, 500);
  });

  // Toggle voting cards visibility
  elements.toggleCardsBtn.addEventListener("click", toggleCardsSection);

  // Estimation calculator
  elements.openCalculatorBtn.addEventListener("click", openCalculatorModal);
  elements.calculatorModalClose.addEventListener("click", closeCalculatorModal);
  elements.calculatorModalOverlay.addEventListener("click", closeCalculatorModal);
  elements.calcCancelBtn.addEventListener("click", closeCalculatorModal);
  elements.calcUseBtn.addEventListener("click", () => {
    const value = elements.calcUseBtn.dataset.value;
    if (value) {
      vote(value);
      closeCalculatorModal();
    }
  });

  // New round
  elements.newRoundBtn.addEventListener("click", newRound);

  // Lobby events
  elements.createRoomBtn.addEventListener("click", createRoom);
  elements.joinRoomBtn.addEventListener("click", () => {
    const code = elements.roomCodeInput.value;
    if (code) joinRoom(code);
  });
  elements.roomCodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const code = elements.roomCodeInput.value;
      if (code) joinRoom(code);
    }
  });

  // Nickname form
  elements.nicknameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    // Prevent double submission
    if (state.currentParticipantId) return;

    const name = elements.nicknameInput.value.trim();
    if (name) {
      addParticipant(name);
      elements.nicknameOverlay.classList.add("hidden");
      document.body.classList.add("app-active");
    }
  });

  // Copy link
  elements.copyRoomLink.addEventListener("click", () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const originalColor = elements.currentRoomId.style.color;
      elements.currentRoomId.textContent = "¡Copiado!";
      elements.currentRoomId.style.color = "var(--color-accent-light)";
      setTimeout(() => {
        elements.currentRoomId.textContent = state.roomId;
        elements.currentRoomId.style.color = originalColor;
      }, 2000);
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    // Escape key to close modal
    if (!elements.addParticipantModal.classList.contains("hidden")) {
      closeModal();
    }
    if (!elements.calculatorModal.classList.contains("hidden")) {
      closeCalculatorModal();
    }
  });
}

// ===== Initialization =====
function init() {
  initEventListeners();
  initCalculatorFaders();
  loadFromLocalStorage();

  // Check for room in URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomFromUrl = urlParams.get("room");
  if (roomFromUrl) {
    joinRoom(roomFromUrl);
  }
}

// ===== Start Application =====
document.addEventListener("DOMContentLoaded", init);

// ===== Global Functions (for inline event handlers) =====
window.removeParticipant = removeParticipant;
