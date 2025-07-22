function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// NOVA FUNÇÃO: Para escapar strings para HTML
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function setupProfileDropdown() {
  const userProfileIcon = document.querySelector(
    ".user-profile .fa-user-circle"
  );
  const profileDropdown = document.querySelector(".profile-dropdown");
  if (userProfileIcon && profileDropdown) {
    userProfileIcon.addEventListener("click", (event) => {
      event.stopPropagation();
      const isActive = profileDropdown.classList.toggle("active");
      userProfileIcon.setAttribute("aria-expanded", isActive.toString());
    });
    document.addEventListener("click", (event) => {
      if (
        !userProfileIcon.contains(event.target) &&
        !profileDropdown.contains(event.target) &&
        profileDropdown.classList.contains("active")
      ) {
        profileDropdown.classList.remove("active");
        userProfileIcon.setAttribute("aria-expanded", "false");
      }
    });
  }
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

let watchLaterList = JSON.parse(localStorage.getItem("watchLater")) || [];
let currentTrailerKey = "";

fetch("https://torrentio.strem.fun/stream/movie/tt7068946.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    if (data && data.streams) {
      console.log("Streaming options fetched successfully:", data.streams.length, "options available");
    } else {
      console.warn("Unexpected API response structure:", data);
    }
  })
  .catch((error) => {
    console.error("Failed to fetch streaming data:", error);
    showNotification("Failed to load streaming options", "error");
  });

function handleMediaClick(item, type) {
  const titleText = item.title || item.name || "Untitled";
  const poster = item.poster_path
    ? `${IMAGE_BASE_URL}${item.poster_path}`
    : "https://via.placeholder.com/500x750?text=No+Poster";

  // Identificação específica para "The Making of Deadpool & Wolverine"
  // ou outros itens que você quer tratar como série, mas que são 'movie' no TMDB.
  // Use o ID do TMDB para a identificação precisa.
  if (item.id === 1386628 /* The Making of Deadpool & Wolverine TMDB ID */) {
    console.log(`[HANDLE MEDIA CLICK] Tratando '${titleText}' (ID: ${item.id}) como série para abrir modal de temporadas/episódios simulados.`);
    
    // Criar um objeto "fake" de série com os dados mínimos necessários para openSeriesModal
    // e para a lógica subsequente de simulação.
    const fakeSeriesItem = {
      id: item.id, // Manter o ID original do TMDB
      name: titleText,
      imdb_id: item.imdb_id || "tt34570789", // Garantir o IMDb ID correto
      poster_path: item.poster_path,
      overview: item.overview,
      // Não é estritamente necessário para o modal, mas bom para consistência
      media_type: "tv" // Forçar para 'tv' para que openSeriesModal aceite
    };
    openSeriesModal(fakeSeriesItem);

  } else if (type === "movie") {
    // Lógica original para filmes
    playMovie(item.imdb_id, "movie", titleText, poster);
  } else if (type === "tv" || type === "series") {
    // Lógica original para séries
    openSeriesModal(item);
  } else {
    showNotification("Unsupported media type.", "error");
  }
}

async function handleSearch(query) {
  const mainContainer = document.querySelector(".main");
  const heroBanner = document.querySelector(".hero-banner");
  const originalSections = mainContainer.querySelectorAll(
    ".section:not(#search-results-section)"
  );
  let searchSection = document.getElementById("search-results-section");

  if (!query) {
    if (searchSection) searchSection.remove();
    if (heroBanner) heroBanner.style.display = "";
    originalSections.forEach((section) => {
      section.style.display = "";
    });
    return;
  }

  if (heroBanner) heroBanner.style.display = "none";
  originalSections.forEach((section) => {
    section.style.display = "none";
  });

  if (!searchSection) {
    const searchBar = document.querySelector(".search-bar");
    searchSection = document.createElement("div");
    searchSection.id = "search-results-section";
    searchSection.className = "section";
    searchSection.innerHTML = `
            <div class="section-title"><i class="fas fa-search"></i> Search Results</div>
            <div class="movie-grid" id="search-results-grid"></div>
            <div class="loading-spinner" id="search-results-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
    searchBar.insertAdjacentElement("afterend", searchSection);
  }
  searchSection.style.display = "";

  const resultsGrid = document.getElementById("search-results-grid");
  const spinner = document.getElementById("search-results-spinner");
  resultsGrid.innerHTML = "";
  spinner.classList.add("active");

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(
        query
      )}&include_adult=false`
    );
    if (!response.ok) throw new Error("Failed to fetch search results.");

    const data = await response.json();
    const filteredResults = data.results.filter(
      (item) => item.media_type !== "person" && item.poster_path
    );

    if (filteredResults.length === 0) {
      resultsGrid.innerHTML = "<p>No results found.</p>";
      spinner.classList.remove("active");
      return;
    }

    const fullResults = await Promise.all(
      filteredResults.map(async (item) => {
        if (item.id && item.media_type) {
          try {
            const externalIdsResponse = await fetch(
              `${TMDB_BASE_URL}/${item.media_type}/${item.id}/external_ids?api_key=${TMDB_API_KEY}`
            );
            if (externalIdsResponse.ok) {
              const externalIds = await externalIdsResponse.json();
              item.imdb_id = externalIds.imdb_id || "";
              console.log(
                `[SEARCH] Título: ${item.title || item.name}, TMDB id: ${item.id}, media_type: ${item.media_type}, imdb_id: ${item.imdb_id}`
              );
            }
          } catch (e) {
            console.warn("Could not fetch external ID.");
          }
        }
        return item;
      })
    );

    resultsGrid.innerHTML = fullResults
      .map((item, index) => {
        const poster = `${IMAGE_BASE_URL}${item.poster_path}`;
        const titleText = item.title || item.name || "Untitled";
        // ALTERAÇÃO AQUI: Usar escapeHtml para o JSON
        const itemJSON = escapeHtml(JSON.stringify(item));
        return `
                        <article class="movie-card" style="--i: ${index + 1};">
                            <img src="${poster}" alt="${titleText} Poster">
                            <div class="carousel-item-overlay">
                                <button class="play-btn" data-item="${itemJSON}">Play</button>
                                <button class="details-btn" data-item="${itemJSON}">View Details</button>
                                <button class="watch-later-btn" data-item="${itemJSON}">Add to Watch Later</button>
                            </div>
                            <div class="carousel-item-content">
                                <h3>${titleText}</h3>
                                <p>Rating: ${item.vote_average
                                ? item.vote_average.toFixed(1)
                                : "N/A"
                            }/10</p>
                            </div>
                        </article>`;
      })
      .join("");

    addEventListenersToContainer("search-results-grid");
  } catch (error) {
    resultsGrid.innerHTML = `<p class="error-message">Error loading results.</p>`;
    console.error("Search error:", error);
  } finally {
    spinner.classList.remove("active");
  }
}

function setupSearchBar() {
  const searchInput = document.querySelector(".search-input");
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce((e) => handleSearch(e.target.value.trim()), 500)
    );
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch(searchInput.value.trim());
        searchInput.blur();
      }
    });
  }
}

function playMovie(imdbId, type, title, poster, season, episode) {
  if (!imdbId) {
    showNotification("Cannot play: Missing IMDb ID.", "error");
    return;
  }
  let playerUrl = `player.html?imdbId=${imdbId}&type=${type}&title=${encodeURIComponent(
    title
  )}&poster=${encodeURIComponent(poster)}`;
  if (type === "series" && season && episode) {
    playerUrl += `&season=${season}&episode=${episode}`;
  }
  console.log("Opening player with URL:", playerUrl);
  console.log("imbId", imdbId)
  window.open(playerUrl, "_blank");
}

function addEventListenersToContainer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (container.dataset.listenerAttached) {
    return;
  }

  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-item]");
    if (!button) return;

    const itemDataString = button.dataset.item;
    if (!itemDataString) return;

    try {
      // ALTERAÇÃO AQUI: Removida a chamada decodeURIComponent, pois o .dataset já decodifica entidades HTML
      const itemData = JSON.parse(itemDataString); // Deve funcionar agora com JSON escapado para HTML
      const itemType = itemData.media_type || (itemData.title ? "movie" : "tv");

      if (button.classList.contains("play-btn")) {
        handleMediaClick(itemData, itemType);
      } else if (button.classList.contains("details-btn")) {
        showDetails(itemData, itemType);
      } else if (button.classList.contains("watch-later-btn")) {
        addToWatchLater(itemData, itemType);
      }
    } catch (e) {
      console.error("Failed to parse item data from data-item attribute", e);
    }
  });

  container.dataset.listenerAttached = "true";
}

async function fetchMovies(endpoint, containerId, type) {
  const container = document.getElementById(containerId);
  const spinner = document.getElementById(`${containerId}-spinner`);
  if (!container || !spinner) return;

  try {
    spinner.classList.add("active");
    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&include_adult=false`
    );
    if (!response.ok) throw new Error(`TMDB fetch error: ${response.status}`);
    const data = await response.json();

    container.innerHTML = "";
    if (!data.results || data.results.length === 0) {
      container.innerHTML = "<p>No results found.</p>";
      spinner.classList.remove("active");
      return;
    }

    const itemsWithImdb = await Promise.all(
      data.results.map(async (item) => {
        const itemTypeForAPI =
          item.media_type || type || (item.title ? "movie" : "tv");
        let imdbId = "";
        if (item.id) {
          try {
            const externalIdsResponse = await fetch(
              `${TMDB_BASE_URL}/${itemTypeForAPI}/${item.id}/external_ids?api_key=${TMDB_API_KEY}`
            );
            if (externalIdsResponse.ok)
              imdbId = (await externalIdsResponse.json()).imdb_id || "";
          } catch (e) {
            console.warn(`Error fetching external ID for ${item.id}`);
          }
        }
        item.imdb_id = imdbId;
        item.media_type = itemTypeForAPI;
        return item;
      })
    );

    container.innerHTML = itemsWithImdb
      .map((item, index) => {
        const poster = item.poster_path
          ? `${IMAGE_BASE_URL}${item.poster_path}`
          : "https://via.placeholder.com/200x280?text=No+Poster";
        const titleText = item.title || item.name || "Untitled";
        // ALTERAÇÃO AQUI: Usar escapeHtml para o JSON
        const itemJSON = escapeHtml(JSON.stringify(item));
        return `
            <div class="carousel-item" style="--i: ${index + 1};">
                <img src="${poster}" alt="${titleText} Poster">
                <div class="carousel-item-overlay">
                    <button class="play-btn" data-item="${itemJSON}">Play</button>
                    <button class="details-btn" data-item="${itemJSON}">View Details</button>
                    <button class="watch-later-btn" data-item="${itemJSON}">Add to Watch Later</button>
                </div>
                <div class="carousel-item-content">
                    <h3>${titleText}</h3>
                    <p>Rating: ${item.vote_average ? item.vote_average.toFixed(1) : "N/A"
                    }/10</p>
                </div>
            </div>`;
      })
      .join("");

    addEventListenersToContainer(containerId);
    spinner.classList.remove("active");
  } catch (error) {
    console.error(`Error loading content for ${containerId}:`, error);
    showNotification(`Failed to load content.`, "error");
    if (container)
      container.innerHTML = `<p class="error-message">Could not load content.</p>`;
    if (spinner) spinner.classList.remove("active");
  }
}

async function openSeriesModal(seriesData) {
  const modal = document.getElementById("series-modal");
  if (!modal) return;

  document.getElementById("series-modal-title").textContent =
    seriesData.name || seriesData.title;
  const seasonsList = document.getElementById("seasons-list");
  const episodesList = document.getElementById("episodes-list");

  seasonsList.innerHTML =
    '<div class="loading-spinner active"><i class="fas fa-spinner fa-spin"></i></div>';
  episodesList.innerHTML = "<p>Please select a season first.</p>";
  modal.showModal();

  try {
    // VERIFICAÇÃO PARA O ITEM ESPECÍFICO QUE VOCÊ QUER SIMULAR
    if (seriesData.id === 1386628) {
      console.log("Simulando temporadas para o item específico.");
      // Hardcode das temporadas para este item.
      // Você pode adicionar mais botões de temporada se for necessário, mas para um "making of", uma temporada deve ser suficiente.
      seasonsList.innerHTML = `
        <button onclick="fetchEpisodes(${seriesData.id}, 1, '${seriesData.imdb_id}', this, true)">Season 1 (Special)</button>
      `;
    } else {
      // Lógica original para séries reais do TMDB
      const response = await fetch(
        `${TMDB_BASE_URL}/tv/${seriesData.id}?api_key=${TMDB_API_KEY}&language=en-US`
      );
      if (!response.ok) throw new Error("Failed to fetch series details.");
      const details = await response.json();

      seasonsList.innerHTML = details.seasons
        .filter((season) => season.season_number > 0)
        .map(
          (season) =>
            `<button onclick="fetchEpisodes(${seriesData.id}, ${season.season_number}, '${seriesData.imdb_id}', this, false)">${season.name}</button>`
        )
        .join("");
    }
  } catch (error) {
    console.error("Error fetching seasons:", error);
    seasonsList.innerHTML =
      '<p class="error-message">Could not load seasons.</p>';
  }
  if (window.innerWidth <= 768) {
    modal.style.maxWidth = '95vw';
    modal.style.width = '95vw';
    modal.style.padding = '1rem';
  }
}
function showSeasonsList() {
  const seasonsContainer = document.querySelector('.seasons-container');
  const episodesContainer = document.querySelector('.episodes-container');

  seasonsContainer.classList.remove('hidden');
  episodesContainer.classList.add('hidden');
}

async function fetchEpisodes(seriesId, seasonNumber, seriesImdbId, seasonButton, isSimulated = false) {
  const episodesList = document.getElementById('episodes-list');
  const seasonsContainer = document.querySelector('.seasons-container');
  const episodesContainer = document.querySelector('.episodes-container');

  episodesList.innerHTML = '<div class="loading-spinner active"><i class="fas fa-spinner fa-spin"></i></div>';

  document.querySelectorAll('#seasons-list button').forEach(btn => btn.classList.remove('active'));
  if (seasonButton) seasonButton.classList.add('active');

  try {
    let poster = 'https://via.placeholder.com/500x750?text=No+Poster'; // Default poster

    // Lógica para o item simulado
    if (isSimulated && seriesId === 1386628 && seasonNumber === 1) {
        console.log("Simulando episódios para o item específico.");
        // Hardcode dos episódios para a "Temporada 1 (Special)" deste item.
        // Se houver apenas um "episódio", crie um.
        const episodeName = "The Making of Deadpool & Wolverine"; // Ou outro nome mais específico
        const fullTitle = `${episodeName}`; // Pode simplificar o título para este caso
        seriesImdbId = seriesImdbId || "tt34570789"; // Garantir que o IMDb ID está presente
        
        // Use a imagem do poster do item original se disponível
        const itemData = JSON.parse(seasonButton.closest('.carousel-item, .movie-card').querySelector('[data-item]').dataset.item);
        if (itemData && itemData.poster_path) {
            poster = `${IMAGE_BASE_URL}${itemData.poster_path}`;
        }

        episodesList.innerHTML = `
            <button class="episode-button"
                    data-imdb-id="${seriesImdbId}"
                    data-type="movie" // **IMPORTANTE**: Para o player, este ainda é um 'movie'
                    data-title="${escapeHtml(fullTitle)}"
                    data-poster="${poster}"
                    data-season="1"
                    data-episode="1">
              <span>${episodeName}</span>
              <i class="fas fa-play play-icon"></i>
            </button>
        `;
    } else {
      // Lógica original para séries reais do TMDB
      if (!seriesImdbId) {
        try {
          const externalIdsResponse = await fetch(`${TMDB_BASE_URL}/tv/${seriesId}/external_ids?api_key=${TMDB_API_KEY}`);
          if (externalIdsResponse.ok) {
            const externalIds = await externalIdsResponse.json();
            seriesImdbId = externalIds.imdb_id || '';
          }
        } catch (error) {
          console.warn('Failed to fetch fallback IMDb ID:', error);
        }
      }

      const response = await fetch(`${TMDB_BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`);
      if (!response.ok) throw new Error('Failed to fetch episodes.');
      const seasonDetails = await response.json();

      poster = seasonDetails.poster_path
        ? `${IMAGE_BASE_URL}${seasonDetails.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';

      episodesList.innerHTML = seasonDetails.episodes.map((episode) => {
        const title = `${episode.episode_number}. ${episode.name}`;
        const fullTitle = `${seasonDetails.name} - ${title}`;
        return `
          <button class="episode-button"
                  data-imdb-id="${seriesImdbId}"
                  data-type="series"
                  data-title="${escapeHtml(fullTitle)}"
                  data-poster="${poster}"
                  data-season="${seasonNumber}"
                  data-episode="${episode.episode_number}">
            <span>${title}</span>
            <i class="fas fa-play play-icon"></i>
          </button>`;
      }).join('');
    }

    if (window.innerWidth <= 768) {
      seasonsContainer.classList.add('hidden');
      episodesContainer.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error fetching episodes:', error);
    episodesList.innerHTML = '<p class="error-message">Could not load episodes.</p>';
  }
}

function setupSeriesModalEventListeners() {
  const episodesList = document.getElementById("episodes-list");
  if (episodesList) {
    episodesList.addEventListener("click", (event) => {
      const button = event.target.closest(".episode-button");
      if (!button) return;

      // ALTERAÇÃO AQUI: Não precisa de decodeURIComponent para data-attributes que não são JSON
      const { imdbId, type, title, poster, season, episode } = button.dataset;
      playMovie(imdbId, type, title, poster, season, episode);
    });
  }
}

function scrollCarousel(containerId, scrollAmount) {
  const container = document.getElementById(containerId);
  if (container) container.scrollBy({ left: scrollAmount, behavior: "smooth" });
}

function playTrailer() {
  if (currentTrailerKey) {
    const iframe = document.getElementById("trailer-iframe");
    const modal = document.getElementById("trailer-modal");
    if (iframe && modal) {
      iframe.src = `https://www.youtube.com/embed/${currentTrailerKey}?autoplay=1&modestbranding=1&rel=0&vq=hd720`;
      modal.showModal();
    }
  } else {
    showNotification("No trailer available for this item.", "info");
  }
}

function closeTrailerModal() {
  const iframe = document.getElementById("trailer-iframe");
  const modal = document.getElementById("trailer-modal");
  if (iframe) iframe.src = "";
  if (modal && modal.hasAttribute("open")) modal.close();
}

async function showDetails(itemData, type) {
  const modal = document.getElementById("details-modal");
  if (!modal) return;

  document.getElementById("details-title").textContent = "Loading...";
  document.getElementById("details-overview").textContent = "";
  document.getElementById("trailer-button").style.display = "none";
  modal.showModal();

  try {
    const itemId = itemData.id;
    let itemTypeForApiCall = itemData.media_type || type;
    if (!itemId || !itemTypeForApiCall)
      throw new Error("Missing ID or type for API call.");

    const response = await fetch(
      `${TMDB_BASE_URL}/${itemTypeForApiCall}/${itemId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`
    );
    if (!response.ok) throw new Error("Failed to fetch full details from API.");

    const details = await response.json();

    const title = details.title || details.name || "No Title";
    document.getElementById("details-title").textContent = title;
    document.getElementById("details-poster").src = details.poster_path
      ? `${IMAGE_BASE_URL}${details.poster_path}`
      : "https://via.placeholder.com/300x450?text=No+Poster";
    document.getElementById("details-poster").alt = `${title} Poster`;
    document.getElementById("details-overview").textContent =
      details.overview || "No overview available.";
    document.getElementById("details-rating").textContent =
      (details.vote_average ? details.vote_average.toFixed(1) : "N/A") + "/10";
    document.getElementById("details-release").textContent =
      details.release_date || details.first_air_date || "Unknown";

    const trailer =
      details.videos?.results.find(
        (v) => v.type === "Trailer" && v.site === "YouTube"
      ) || details.videos?.results.find((v) => v.site === "YouTube");
    currentTrailerKey = trailer ? trailer.key : "";
    document.getElementById("trailer-button").style.display = currentTrailerKey
      ? "inline-block"
      : "none";
  } catch (error) {
    console.error("Error fetching details:", error);
    showNotification("Could not load details for this item.", "error");
    const detailsModal = document.getElementById("details-modal");
    if (detailsModal && detailsModal.hasAttribute("open")) detailsModal.close();
  }
}

// === INÍCIO: Firebase e Firestore ===
let firebaseApp, firebaseAuth, firestore, currentUser;
let doc, setDoc, deleteDoc, collection, getDocs;

async function initFirebaseAndAuth() {
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
  const authModule = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
  const firestoreModule = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
  getAuth = authModule.getAuth;
  onAuthStateChanged = authModule.onAuthStateChanged;
  doc = firestoreModule.doc;
  setDoc = firestoreModule.setDoc;
  collection = firestoreModule.collection;
  getDocs = firestoreModule.getDocs;
  getDoc = firestoreModule.getDoc;
  const firebaseConfig = {
    apiKey: "AIzaSyCqfBDHkKEsHSzdb5KTvagYwoEk1b3da3o",
    authDomain: "istreambyweb.firebaseapp.com",
    projectId: "istreambyweb",
    storageBucket: "istreambyweb.firebaseapp.com",
    messagingSenderId: "458543632560",
    appId: "1:458543632560:web:1de42763df2d1515316b75",
    measurementId: "G-JWNQKK2ZKW"
  };
  if (!window.firebaseApp) {
    if (!getApps().length) {
      window.firebaseApp = initializeApp(firebaseConfig);
    } else {
      window.firebaseApp = getApps()[0];
    }
  }
  firebaseAuth = getAuth(window.firebaseApp);
  firestore = firestoreModule.getFirestore(window.firebaseApp);
  await new Promise((resolve) => {
    onAuthStateChanged(firebaseAuth, (user) => {
      currentUser = user;
      resolve();
    });
  });
}
// === FIM: Firebase e Firestore ===

// === INÍCIO: Utilitário para buscar API Keys do usuário ===
// Remover duplicidade: use as variáveis já declaradas globalmente
async function getUserApiKeys() {
  await initFirebaseAndAuth();
  if (!currentUser) return {};
  const docRef = doc(firestore, "userApiKeys", currentUser.uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data();
  }
  return {};
}
// === FIM: Utilitário para buscar API Keys do usuário ===

// Substituir funções de adicionar/remover para usar Firestore
async function addToWatchLaterFirestore(item, type) {
  await initFirebaseAndAuth();
  if (!currentUser) return;
  const docRef = doc(firestore, "watchLater", currentUser.uid, "items", `${item.id}_${type}`);
  await setDoc(docRef, { id: item.id, type });
  await loadWatchLaterFromFirestore();
  showNotification("Adicionado à lista!", "success");
}
async function loadWatchLaterFromFirestore() {
  await initFirebaseAndAuth();
  if (!currentUser) {
    watchLaterList = [];
    return;
  }
  const itemsCol = collection(firestore, "watchLater", currentUser.uid, "items");
  const snapshot = await getDocs(itemsCol);
  watchLaterList = snapshot.docs.map(doc => doc.data());
}
// Adaptar addToWatchLater
async function addToWatchLater(itemData, type) {
  await initFirebaseAndAuth();
  const itemType = itemData.media_type || type || (itemData.title ? "movie" : "tv");
  const title = itemData.title || itemData.name || "Untitled";
  if (!watchLaterList.some((item) => item.id === itemData.id)) {
    await addToWatchLaterFirestore(itemData, itemType);
  } else {
    showNotification(`${title} is already in Watch Later.`, "info");
  }
}

// === INÍCIO: Continue Watching ===
async function fetchContinueWatchingFromFirestore() {
  await initFirebaseAndAuth();
  if (!currentUser) return [];
  const itemsCol = collection(firestore, "continueWatching", currentUser.uid, "items");
  const snapshot = await getDocs(itemsCol);
  // Filtrar para não mostrar itens já concluídos (progresso < 95% do filme/série)
  return snapshot.docs.map(doc => doc.data()).filter(item => item.progress && item.progress < (item.duration ? item.duration * 0.95 : 100000));
}

async function fetchTmdbDetails(itemId, itemType) {
  try {
    const lang = "pt-BR";
    const response = await fetch(
      `${TMDB_BASE_URL}/${itemType}/${itemId}?api_key=${TMDB_API_KEY}&language=${lang}`
    );
    if (!response.ok) throw new Error("Erro ao buscar detalhes do TMDB");
    return await response.json();
  } catch (error) {
    console.error("Erro ao buscar detalhes TMDB:", error);
    return null;
  }
}

async function renderContinueWatchingSection() {
  const grid = document.getElementById("continue-watching");
  const spinner = document.getElementById("continue-watching-spinner");
  if (!grid || !spinner) return;
  // Garantir que o grid tenha apenas a classe correta para estilização
  grid.className = "carousel";
  // Mostrar spinner enquanto carrega
  spinner.style.display = "block";
  // Limpar grid
  grid.innerHTML = "";

  const items = await fetchContinueWatchingFromFirestore();
  if (!items.length) {
    spinner.style.display = "none";
    return;
  }

  // Buscar detalhes do TMDB para cada item
  const itemsWithDetails = await Promise.all(
    items.map(async (item) => {
      const details = await fetchTmdbDetails(item.id, item.type);
      return details ? { ...details, ...item } : null;
    })
  );
  const validItems = itemsWithDetails.filter(Boolean);
  if (!validItems.length) {
    spinner.style.display = "none";
    return;
  }

  grid.innerHTML = validItems.map((item, index) => {
    const poster = item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : "https://via.placeholder.com/200x300?text=S/Poster";
    const title = item.title || item.name || "Título Desconhecido";
    const percent = item.runtime ? Math.min(100, Math.round((item.progress / item.runtime) * 100)) : 0;
    const itemJSON = escapeHtml(JSON.stringify(item));
    return `
      <div class="carousel-item" style="--i: ${index + 1};">
        <img src="${poster}" alt="${title} Poster">
        <div class="carousel-item-overlay">
          <button class="play-btn" data-item='${itemJSON}'>Play</button>
          <button class="details-btn" data-item='${itemJSON}'>View Details</button>
          <button class="watch-later-btn" data-item='${itemJSON}'>Add to Watch Later</button>
        </div>
        <div class="carousel-item-content">
          <h3>${title}</h3>
          <p>Progresso: ${percent}%</p>
        </div>
      </div>
    `;
  }).join("");

  // Adicionar listeners aos botões
  grid.querySelectorAll(".play-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const itemDataString = btn.dataset.item;
      if (!itemDataString) return;
      try {
        const itemData = JSON.parse(itemDataString);
        const id = itemData.id;
        const type = itemData.type;
        const title = itemData.title || itemData.name || "Título Desconhecido";
        const poster = itemData.poster_path ? `${IMAGE_BASE_URL}${itemData.poster_path}` : "https://via.placeholder.com/200x300?text=S/Poster";
        const progress = parseInt(itemData.progress || "0");
        let playerUrl = `player.html?imdbId=${id}&type=${type}&title=${encodeURIComponent(title)}&poster=${encodeURIComponent(poster)}`;
        if (progress > 0) playerUrl += `&start=${progress}`;
        window.open(playerUrl, "_blank");
      } catch (err) {
        console.error("Failed to parse item data for Play", err);
      }
    });
  });
  grid.querySelectorAll(".details-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const itemDataString = btn.dataset.item;
      if (!itemDataString) return;
      try {
        const itemData = JSON.parse(itemDataString);
        const id = itemData.id;
        const type = itemData.type;
        const details = await fetchTmdbDetails(id, type);
        if (details) showDetails(details, type);
      } catch (err) {
        console.error("Failed to parse item data for Details", err);
      }
    });
  });
  grid.querySelectorAll(".watch-later-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const itemDataString = btn.dataset.item;
      if (!itemDataString) return;
      try {
        const itemData = JSON.parse(itemDataString);
        const itemType = itemData.media_type || (itemData.title ? "movie" : "tv");
        addToWatchLater(itemData, itemType);
      } catch (err) {
        console.error("Failed to parse item data for Watch Later", err);
      }
    });
  });
  // Esconder spinner ao terminar
  spinner.style.display = "none";
}
// === FIM: Continue Watching ===

function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

function showTutorial() {
  const tutorialSteps = [
    {
      element: '.search-bar',
      title: 'Search',
      content: 'Search for your favorite movies and TV shows here'
    },
    {
      element: '.sidebar',
      title: 'Navigation',
      content: 'Use the sidebar to navigate between different sections'
    },
    {
      element: '.movie-grid',
      title: 'Content',
      content: 'Browse through our collection of movies and TV shows'
    }
  ];

  let currentStep = 0;

  function showStep(step) {
    const tutorial = document.createElement('div');
    tutorial.className = 'tutorial-popup';
    tutorial.innerHTML = `
      <h3>${tutorialSteps[step].title}</h3>
      <p>${tutorialSteps[step].content}</p>
      <div class="tutorial-buttons">
        ${step > 0 ? '<button class="tutorial-prev">Previous</button>' : ''}
        ${step < tutorialSteps.length - 1 ? '<button class="tutorial-next">Next</button>' : '<button class="tutorial-finish">Finish</button>'}
      </div>
    `;

    const element = document.querySelector(tutorialSteps[step].element);
    if (element) {
      const rect = element.getBoundingClientRect();
      tutorial.style.position = 'fixed';
      tutorial.style.top = `${rect.bottom + 10}px`;
      tutorial.style.left = `${rect.left}px`;
    }

    const existingTutorial = document.querySelector('.tutorial-popup');
    if (existingTutorial) {
      existingTutorial.remove();
    }

    document.body.appendChild(tutorial);

    const prevBtn = tutorial.querySelector('.tutorial-prev');
    const nextBtn = tutorial.querySelector('.tutorial-next');
    const finishBtn = tutorial.querySelector('.tutorial-finish');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        currentStep--;
        showStep(currentStep);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentStep++;
        showStep(currentStep);
      });
    }

    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        tutorial.remove();
        localStorage.setItem('tutorialComplete', 'true');
      });
    }
  }

  showStep(0);
}

function closeTutorial() {
  const tutorialDialog = document.querySelector('dialog');
  if (tutorialDialog && tutorialDialog.open) {
    tutorialDialog.close();
  }
}

function logout() {
  import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").then(({ getAuth, signOut }) => {
    const auth = getAuth();
    signOut(auth).then(() => {
      window.location.href = "../index.html";
    });
  });
}

let TMDB_API_KEY = null;

async function initializeAppWithUserApiKeys() {
  const apiKeys = await getUserApiKeys();
  if (apiKeys.tmdbApiKey) {
    TMDB_API_KEY = apiKeys.tmdbApiKey;
    // Só chama as funções se a key existe!
    renderContinueWatchingSection();
    fetchMovies("movie/now_playing", "new-movies", "movie");
    fetchMovies("tv/on_the_air", "new-series", "tv");
    fetchMovies("movie/popular", "popular-movies", "movie");
    fetchMovies("tv/popular", "popular-series", "tv");
    setupSearchBar();
    setupSeriesModalEventListeners();
  } else {
    showNotification("Você precisa configurar sua TMDB API Key nas configurações para usar o sistema!", "error");
  }
}

// NOVA FUNÇÃO: Alternância de tema escuro/claro
function setupThemeToggle() {
  const themeToggleButton = document.querySelector(".theme-toggle");
  if (!themeToggleButton) return;

  const applyTheme = (theme) => {
    if (theme === "dark") {
      document.body.classList.add("dark-theme");
      themeToggleButton.innerHTML = '<i class="fas fa-sun"></i>';
      themeToggleButton.setAttribute("data-tooltip", "Mudar para tema claro");
    } else {
      document.body.classList.remove("dark-theme");
      themeToggleButton.innerHTML = '<i class="fas fa-moon"></i>';
      themeToggleButton.setAttribute("data-tooltip", "Mudar para tema escuro");
    }
  };

  themeToggleButton.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    const newTheme = isDark ? "dark" : "light";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  });

  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);
}

// Proteção de autenticação: impede acesso sem login
async function requireAuth() {
    const firebaseConfig = {
        apiKey: "AIzaSyCqfBDHkKEsHSzdb5KTvagYwoEk1b3da3o",
        authDomain: "istreambyweb.firebaseapp.com",
        projectId: "istreambyweb",
        storageBucket: "istreambyweb.firebaseapp.com",
        messagingSenderId: "458543632560",
        appId: "1:458543632560:web:1de42763df2d1515316b75",
        measurementId: "G-JWNQKK2ZKW"
    };
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
    if (!getApps().length) {
        window.firebaseApp = initializeApp(firebaseConfig);
    } else {
        window.firebaseApp = getApps()[0];
    }
    const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
    if (!window.firebaseAuth) {
        window.firebaseAuth = getAuth(firebaseApp);
    }
    return new Promise((resolve) => {
        onAuthStateChanged(window.firebaseAuth, (user) => {
            if (!user) {
                window.location.href = "../index.html";
            } else {
                resolve(user);
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await requireAuth();
    setupThemeToggle();
    setupProfileDropdown();
    initializeAppWithUserApiKeys();
  // showLoadingSpinner(); // Remova esta linha se showLoadingSpinner não estiver definida
  // const result = await fetchData(); // Remova esta linha se fetchData não estiver definida
  // if (result.success && result.data) { // Remova esta linha se displayMovies não estiver definida
  //   // displayMovies(result.data); // Remova esta linha se displayMovies não estiver definida
  // } else { // Remova esta linha se showError não estiver definida
  //   // showError('Não foi possível carregar o conteúdo.'); // Remova esta linha se showError não estiver definida
  // }
  // } catch (error) { // Remova esta linha se showError não estiver definida
  //   console.error('Error:', error); // Remova esta linha se showError não estiver definida
  // } finally { // Remova esta linha se hideLoadingSpinner não estiver definida
  //   // hideLoadingSpinner(); // Remova esta linha se hideLoadingSpinner não estiver definida
  // }
});