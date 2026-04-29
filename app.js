// ===== Configuración de Firebase =====
// TODO: Reemplaza con tu configuración real de Firebase desde la Consola de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAuhgYTBqYb0Pq8ykYgT50d7bGFhtWKLv0",
  authDomain: "pokerplanning-5e23a.firebaseapp.com",
  projectId: "pokerplanning-5e23a",
  storageBucket: "pokerplanning-5e23a.firebasestorage.app",
  messagingSenderId: "399680514377",
  appId: "1:399680514377:web:566d33b361ae8c1acfd298",
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===== Gestión del Estado =====
const state = {
  roomId: null,
  participants: [],
  currentParticipantId: null,
  votes: {},
  votesVisible: false,
  unsubscribe: null, // Para el listener de Firestore
};

// ===== Colores de Avatar =====
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

// ===== Elementos del DOM =====
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

// ===== Funciones del Modal =====
function openModal() {
  elements.addParticipantModal.classList.remove("hidden");
  elements.participantNameInput.focus();
}

function closeModal() {
  elements.addParticipantModal.classList.add("hidden");
  elements.addParticipantForm.reset();
}

// ===== Funciones de Participantes =====
function addParticipant(name) {
  if (!state.roomId) return;

  // Evitar registro duplicado si ya se está registrando
  if (state.currentParticipantId) return;

  const participant = {
    id: generateId(),
    name: name.trim(),
    color: getAvatarColor(state.participants.length),
  };

  // Establecer el ID ANTES de la llamada a Firestore para evitar condición de carrera
  state.currentParticipantId = participant.id;
  saveToLocalStorage();

  // Usar arrayUnion para adición atómica - previene condiciones de carrera
  db.collection("rooms")
    .doc(state.roomId)
    .update({
      participants: firebase.firestore.FieldValue.arrayUnion(participant),
    })
    .then(() => {
      updateUI();
    })
    .catch((err) => {
      // Revertir en caso de error
      state.currentParticipantId = null;
      saveToLocalStorage();
      console.error("Error adding participant:", err);
    });
}

function removeParticipant(id) {
  if (!state.roomId) return;

  const participantToRemove = state.participants.find((p) => p.id === id);
  if (!participantToRemove) return;

  // Eliminación atómica del objeto participante and their vote
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

  // Limpiar la identidad del usuario actual
  state.currentParticipantId = null;
  saveToLocalStorage();

  // Limpiar todos los participantes y votos
  db.collection("rooms")
    .doc(state.roomId)
    .update({
      participants: [],
      votes: {},
    })
    .catch((err) => console.error("Error clearing participants:", err));
}

function selectParticipant(id) {
  // Validación: Solo permitir selección si el usuario aún no tiene un ID
  // o si está re-seleccionando su propio ID (redundante pero seguro)
  if (!state.currentParticipantId) {
    state.currentParticipantId = id;
    saveToLocalStorage();
    updateUI();
  } else if (state.currentParticipantId !== id) {
    console.warn("Security: Attempted to switch identity to " + id);
  }
}

function renderParticipants() {
  // 1. Manejar estado vacío
  if (state.participants.length === 0) {
    elements.participantsGrid.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--color-text-muted); font-size: 0.875rem;">
                No hay participantes. Agregar uno para empezar.
            </div>
        `;
    return;
  }

  // 2. Identificar elementos DOM existentes para evitar renderizado completo (actualización inteligente)
  const currentNodes = Array.from(elements.participantsGrid.children);
  const currentIds = currentNodes
    .map((node) => node.dataset.id)
    .filter((id) => id);

  // Filtrar si era el mensaje vacío
  if (
    elements.participantsGrid.querySelector('[style*="text-align: center"]')
  ) {
    elements.participantsGrid.innerHTML = "";
  }

  // 3. Actualizar o Añadir participantes
  let participantsToRender = [...state.participants];

  // Ordenar por voto si está visible
  if (state.votesVisible) {
    participantsToRender.sort((a, b) => {
      const voteA = state.votes[a.id];
      const voteB = state.votes[b.id];

      // Manejar votos no numéricos (como '?') o votos faltantes
      // Trataremos a los no numéricos como 0 para propósitos de ordenamiento.
      // Usaremos parseFloat. Si es NaN, podemos tratarlo como 0.
      // O simplemente tratar como 0.
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
      // Nuevo participante, crear elemento
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

    // SIEMPRE agregar al final para asegurar el orden
    elements.participantsGrid.appendChild(item);

    // Actualizar clases y contenido solo si cambiaron (previene parpadeo)
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

  // 4. Eliminar elementos de los participantes que se fueron
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

// ===== Funciones de Votación =====
function vote(value) {
  if (!state.currentParticipantId) {
    alert("Por favor agrega un participante primero");
    openModal();
    return;
  }

  if (!state.roomId) return;

  // Actualizar Firestore atomically using dot notation
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

// ===== Funciones de Visibilidad de Votos =====
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

  // Solo pedir confirmación si hay votos
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

// ===== Funciones de Estadísticas =====
function updateStatistics() {
  // Siempre actualizar conteo de votos (visible independientemente del estado)
  elements.votesCount.textContent = `${Object.keys(state.votes).length}/${state.participants.length}`;

  // Solo calcular y mostrar promedio/mediana cuando los votos estén visibles
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

  // Calcular promedio
  const average =
    numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length;
  elements.averageValue.textContent = average.toFixed(1);

  // Calcular mediana
  const sorted = [...numericVotes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  elements.medianValue.textContent = median.toFixed(1);
}

// ===== Función de Recomendaciones =====
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

  // Calcular desviación estándar
  const average =
    numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length;
  const variance =
    numericVotes.reduce((sum, vote) => sum + Math.pow(vote - average, 2), 0) /
    numericVotes.length;
  const stdDev = Math.sqrt(variance);

  // Calcular rango
  const min = Math.min(...numericVotes);
  const max = Math.max(...numericVotes);
  const range = max - min;

  let recommendation = "";
  let recommendationType = "";

  // Generar recomendaciones basadas en la dispersión de los votos
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

// ===== Funciones de Gestión de Salas =====
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

  // Limpiar listener anterior
  if (state.unsubscribe) {
    state.unsubscribe();
  }

  state.roomId = roomId;

  // Cargar identidad ANTES de suscribirse para evitar mostrar el modal de identidad
  loadFromLocalStorage();

  // Suscribirse a actualizaciones de la sala
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

          // Ocultar lobby siempre
          elements.lobbyOverlay.classList.add("hidden");

          if (!state.currentParticipantId) {
            // Mostrar modal de identidad si no sabemos quién es el usuario
            elements.nicknameOverlay.classList.remove("hidden");
            document.body.classList.remove("app-active");
          } else {
            // Tenemos un ID localizado, verificar si aún es válido en la sala
            const exists = state.participants.find(
              (p) => p.id === state.currentParticipantId,
            );
            if (exists) {
              elements.nicknameOverlay.classList.add("hidden");
              document.body.classList.add("app-active");
            } else {
              // ID eliminado, mostrar ingreso de nombre nuevamente
              state.currentParticipantId = null;
              elements.nicknameOverlay.classList.remove("hidden");
              document.body.classList.remove("app-active");
            }
          }

          elements.roomInfoDisplay.style.display = "flex";
          elements.currentRoomId.textContent = roomId;

          // Actualizar URL para compartir
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
  // Revisar si el ID guardado aún existe en la sala
  if (
    state.currentParticipantId &&
    !state.participants.find((p) => p.id === state.currentParticipantId)
  ) {
    // Si el ID fue eliminado o no existe, limpiarlo localmente
    state.currentParticipantId = null;
    saveToLocalStorage();
  }

  renderParticipants();
  updateCurrentParticipantDisplay();
  updateVotingCards();
  updateStatistics();

  // Ocultar el botón 'Agregar Participante' si el usuario ya está registrado
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

// ===== Listeners de Eventos =====
function initEventListeners() {
  // Eventos del Modal
  elements.addParticipantBtn.addEventListener("click", openModal);
  elements.clearAllParticipantsBtn.addEventListener(
    "click",
    clearAllParticipants,
  );
  elements.modalClose.addEventListener("click", closeModal);
  elements.modalOverlay.addEventListener("click", closeModal);
  elements.cancelBtn.addEventListener("click", closeModal);

  // Envío del formulario
  elements.addParticipantForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = elements.participantNameInput.value.trim();
    if (name) {
      addParticipant(name);
      closeModal();
    }
  });

  // Tarjetas de votación
  elements.cardsContainer.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) {
      vote(card.dataset.value);
    }
  });

  // Visibilidad de votos
  elements.hideVotesBtn.addEventListener("click", hideVotes);
  elements.showVotesBtn.addEventListener("click", showVotes);

  // Refrescar recomendaciones
  elements.refreshRecommendationsBtn.addEventListener("click", () => {
    elements.refreshRecommendationsBtn.classList.add("rotating");
    updateRecommendations();
    setTimeout(() => {
      elements.refreshRecommendationsBtn.classList.remove("rotating");
    }, 500);
  });

  // Alternar visibilidad de las tarjetas
  elements.toggleCardsBtn.addEventListener("click", toggleCardsSection);

  // Nueva ronda
  elements.newRoundBtn.addEventListener("click", newRound);

  // Eventos del lobby
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

  // Formulario de apodo
  elements.nicknameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    // Prevenir doble envío
    if (state.currentParticipantId) return;

    const name = elements.nicknameInput.value.trim();
    if (name) {
      addParticipant(name);
      elements.nicknameOverlay.classList.add("hidden");
      document.body.classList.add("app-active");
    }
  });

  // Copiar enlace
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

  // Atajos de teclado
  document.addEventListener("keydown", (e) => {
    // Tecla Escape para cerrar el modal
    if (
      e.key === "Escape" &&
      !elements.addParticipantModal.classList.contains("hidden")
    ) {
      closeModal();
    }
  });
}

// ===== Inicialización =====
function init() {
  initEventListeners();
  loadFromLocalStorage();

  // Revisar si hay sala en la URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomFromUrl = urlParams.get("room");
  if (roomFromUrl) {
    joinRoom(roomFromUrl);
  }
}

// ===== Iniciar la Aplicación =====
document.addEventListener("DOMContentLoaded", init);

// ===== Funciones Globales para HTML =====
window.removeParticipant = removeParticipant;
