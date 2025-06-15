// Constantes
const TMDB_API_KEY = "f0609e6638ef2bc5b31313a712e7a8a4";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const YOUTUBE_EMBED_BASE_URL = "https://www.youtube.com/embed/VIDEO_ID";

// Estado global da aplicação
const state = {
  watchLaterItems: [],
  filteredItems: [],
  searchTerm: "",
  currentTypeFilter: "all",
  currentSortBy: "addedDate",
  currentPlayer: null,
  isProcessing: false,
  isModalOpen: false
};

// Alias para compatibilidade com código existente
let watchLaterItemsGlobal = state.watchLaterItems;
let filteredItemsGlobal = state.filteredItems;
let searchTermGlobal = state.searchTerm;
let currentTypeFilterGlobal = state.currentTypeFilter;
let currentSortByGlobal = state.currentSortBy;
let currentPlayer = state.currentPlayer;
let isProcessing = state.isProcessing;
let isModalOpen = state.isModalOpen;
let currentTrailerKey = null;

function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 3000);
}
const loadingSpinnerWatchLater = document.getElementById(
  "loading-spinner-watch-later"
);
function showLoading() {
  const loadingSpinnerWatchLater = document.getElementById("loading-spinner-watch-later");
  if (loadingSpinnerWatchLater) loadingSpinnerWatchLater.style.display = "flex";
  else console.log("A carregar...");
}
function hideLoading() {
  const loadingSpinnerWatchLater = document.getElementById("loading-spinner-watch-later");
  if (loadingSpinnerWatchLater) loadingSpinnerWatchLater.style.display = "none";
  else console.log("Carregamento completo.");
}

async function fetchTmdbDetails(itemId, itemType) {
  showLoading();
  try {
    const lang = "pt-BR";
    const [detailsRes, creditsRes, externalIdsRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/${itemType}/${itemId}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=release_dates,videos`
      ),
      fetch(
        `${TMDB_BASE_URL}/${itemType}/${itemId}/credits?api_key=${TMDB_API_KEY}&language=${lang}`
      ),
      fetch(
        `${TMDB_BASE_URL}/${itemType}/${itemId}/external_ids?api_key=${TMDB_API_KEY}`
      ),
    ]);
    if (!detailsRes.ok)
      throw new Error(`Detalhes TMDB: ${detailsRes.statusText}`);
    if (!creditsRes.ok)
      throw new Error(`Créditos TMDB: ${creditsRes.statusText}`);
    if (!externalIdsRes.ok)
      throw new Error(`IDs Externos TMDB: ${externalIdsRes.statusText}`);

    const details = await detailsRes.json();
    const credits = await creditsRes.json();
    const externalIds = await externalIdsRes.json();

    const director =
      credits.crew?.find((member) => member.job === "Director")?.name || "N/A";
    const cast =
      credits.cast
        ?.slice(0, 5)
        .map((actor) => actor.name)
        .join(", ") || "N/A";

    return { ...details, imdb_id: externalIds.imdb_id, director, cast };
  } catch (error) {
    console.error("Erro ao obter detalhes TMDB:", error);
    showNotification("Erro ao carregar detalhes.", "error");
    return null;
  } finally {
    hideLoading();
  }
}

async function fetchTrailerKey(itemId, itemType) {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${itemType}/${itemId}/videos?api_key=${TMDB_API_KEY}&language=en-US,pt-BR`
    );
    if (!response.ok) throw new Error("Falha ao obter vídeos do trailer.");
    const data = await response.json();
    const trailer =
      data.results?.find(
        (video) =>
          video.type === "Trailer" &&
          video.site === "YouTube" &&
          video.iso_639_1 === "pt"
      ) ||
      data.results?.find(
        (video) =>
          video.type === "Trailer" &&
          video.site === "YouTube" &&
          video.iso_639_1 === "en"
      ) ||
      data.results?.find(
        (video) => video.type === "Trailer" && video.site === "YouTube"
      );
    return trailer ? trailer.key : null;
  } catch (error) {
    console.error("Erro ao obter chave do trailer:", error);
    return null;
  }
}

window.openTrailerModalFromDetails = async function () {
  if (currentItemForDetailsTrailer?.id && currentItemForDetailsTrailer?.type) {
    showLoading();
    const trailerKey = await fetchTrailerKey(
      currentItemForDetailsTrailer.id,
      currentItemForDetailsTrailer.type
    );
    hideLoading();
    const trailerModal = document.getElementById("trailer-modal");
    const trailerIframe = document.getElementById("trailer-iframe");
    if (trailerKey && trailerIframe && trailerModal) {
      trailerIframe.src = `https://www.youtube.com/embed/${state.currentTrailerKey}?autoplay=1`;
      if (typeof trailerModal.showModal === "function")
        trailerModal.showModal();
      else trailerModal.style.display = "flex";
    } else {
      showNotification("Nenhum trailer disponível.", "info");
    }
  }
};

function playTrailer() {
  if (currentTrailerKey) {
    const trailerModal = document.getElementById("trailer-modal");
    const trailerIframe = document.getElementById("trailer-iframe");
    if (trailerIframe && trailerModal) {
      trailerIframe.src = `https://www.youtube.com/embed/${currentTrailerKey}?autoplay=1&modestbranding=1&rel=0&vq=hd720`;
      if (typeof trailerModal.showModal === "function") {
        trailerModal.showModal();
      } else {
        trailerModal.style.display = "block";
      }
    }
  } else {
    showNotification("Não há trailer disponível para este item.", "info");
  }
}

function closeTrailerModal() {
  const trailerModal = document.getElementById("trailer-modal");
  const trailerIframe = document.getElementById("trailer-iframe");
  if (trailerIframe) trailerIframe.src = "";
  if (trailerModal) {
    if (typeof trailerModal.close === "function") {
      trailerModal.close();
    } else {
      trailerModal.style.display = "none";
    }
  }
}

// --- MODAL DE DETALHES ROBUSTO ---
function openDetailsModal(item) {
  closeAllModals(); // Ensure cleanup before opening
  currentItemForDetailsTrailer = item;
  const detailsModal = document.getElementById("details-modal");
  if (!detailsModal) return;

  // Clean up any existing event listeners
  const oldModal = document.querySelector('.details-modal[open]');
  if (oldModal) {
    oldModal.removeAttribute('open');
    oldModal.style.display = 'none';
  }

  // Preenche os dados
  (async () => {
    const fullDetails = item.director && item.cast ? item : await fetchTmdbDetails(item.id, item.type);
    if (!fullDetails) {
      showNotification("Não foi possível carregar os detalhes.", "error");
      return;
    }
    document.getElementById("details-title").textContent = fullDetails.title || fullDetails.name || "N/A";
    document.getElementById("details-poster").src = fullDetails.poster_path ? `${IMAGE_BASE_URL}${fullDetails.poster_path}` : "https://via.placeholder.com/150x225?text=S/Poster";
    document.getElementById("details-overview").textContent = fullDetails.overview || "Sem resumo.";
    document.getElementById("details-rating").textContent = fullDetails.vote_average ? `${fullDetails.vote_average.toFixed(1)}/10 (${fullDetails.vote_count} votos)` : "N/A";
    const releaseDate = fullDetails.release_date || fullDetails.first_air_date;
    document.getElementById("details-release").textContent = releaseDate ? new Date(releaseDate + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "N/A";
    document.getElementById("details-director").textContent = fullDetails.director || "N/A";
    document.getElementById("details-cast").textContent = fullDetails.cast || "N/A";    // Verifica a disponibilidade do trailer nos vídeos
    const trailer = fullDetails.videos?.results.find(
      (v) => v.type === "Trailer" && v.site === "YouTube"
    ) || fullDetails.videos?.results.find((v) => v.site === "YouTube");
    currentTrailerKey = trailer ? trailer.key : "";
    const trailerButton = document.getElementById("trailer-button");
    if (trailerButton) {
      trailerButton.style.display = currentTrailerKey ? "inline-block" : "none";
    }
    
    // Abre o modal de forma controlada
    if (typeof detailsModal.showModal === "function") detailsModal.showModal();
    else {
      detailsModal.setAttribute("open", "true");
      detailsModal.style.display = "block";
    }
  })();
}

function closeDetailsModal() {
  const modal = document.getElementById("details-modal");
  if (!modal) return;

  if (typeof modal.close === 'function') {
    modal.close();
  }
  
  currentItemForDetailsTrailer = null;
}

// --- FIM MODIFICAÇÕES ---

async function openDetailsModal(item) {
  if (isProcessing) return;
  
  const modal = document.getElementById("details-modal");
  if (!modal) return;

  try {
    isProcessing = true;
    document.getElementById("details-title").textContent = "Loading...";
    document.getElementById("details-overview").textContent = "";
    document.getElementById("trailer-button").style.display = "none";
    modal.showModal();

    const itemId = item.id;
    let itemTypeForApiCall = item.type;
    if (!itemId || !itemTypeForApiCall) {
      throw new Error("Missing ID or type for API call.");
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/${itemTypeForApiCall}/${itemId}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=videos`
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch full details from API.");
    }

    const details = await response.json();
    console.log("API Response:", details); // Para debug

    const title = details.title || details.name || "Sem título";
    document.getElementById("details-title").textContent = title;
    document.getElementById("details-poster").src = details.poster_path
      ? `${IMAGE_BASE_URL}${details.poster_path}`
      : "https://via.placeholder.com/300x450?text=Sem+Poster";
    document.getElementById("details-poster").alt = `${title} Poster`;
    document.getElementById("details-overview").textContent =
      details.overview || "Sem descrição disponível.";
    document.getElementById("details-rating").textContent =
      (details.vote_average ? details.vote_average.toFixed(1) : "N/A") + "/10";
    document.getElementById("details-release").textContent =
      details.release_date || details.first_air_date || "Desconhecido";

    // Lógica do trailer
    const trailer =
      details.videos?.results.find(
        (v) => v.type === "Trailer" && v.site === "YouTube"
      ) || details.videos?.results.find((v) => v.site === "YouTube");
    
    console.log("Trailer encontrado:", trailer); // Para debug
    
    currentTrailerKey = trailer ? trailer.key : "";
    const trailerButton = document.getElementById("trailer-button");
    if (trailerButton) {
      console.log("Estado do botão:", currentTrailerKey ? "mostrar" : "esconder"); // Para debug
      trailerButton.style.display = currentTrailerKey ? "inline-block" : "none";
    }
  } catch (error) {
    console.error("Error fetching details:", error);
    showNotification("Não foi possível carregar os detalhes deste item.", "error");
    if (modal && modal.hasAttribute("open")) modal.close();
  } finally {
    isProcessing = false;
  }
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
    showNotification("Não há trailer disponível para este item.", "info");
  }
}

function closeTrailerModal() {
  const iframe = document.getElementById("trailer-iframe");
  const modal = document.getElementById("trailer-modal");
  if (iframe) iframe.src = "";
  if (modal && modal.hasAttribute("open")) modal.close();
}

// --- FIM MODIFICAÇÕES ---

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Fecha o modal
  if (typeof modal.close === 'function') {
    modal.close();
  }
  modal.removeAttribute("open");
  modal.style.display = "none";

  // Limpa recursos específicos de cada tipo de modal
  if (modalId === 'trailer-modal') {
    const iframe = document.getElementById("trailer-iframe");
    if (iframe) iframe.src = "";
  }
}

// --- FIM MODIFICAÇÕES ---

async function openDetailsModal(item) {
  if (isModalOpen || isProcessing) {
    return;
  }

  try {
    isProcessing = true;
    showLoading();
    
    const details = await fetchTmdbDetails(item.id, item.type);
    if (!details) {
      throw new Error("Não foi possível carregar os detalhes");
    }

    const modal = document.getElementById("details-modal");
    if (!modal) {
      throw new Error("Modal não encontrado");
    }

    // Preenche o conteúdo do modal
    populateDetailsModal(details, item);
    
    // Mostra o modal
    modal.style.display = "block";
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    }
    modal.setAttribute("open", "true");
    
    isModalOpen = true;
    currentItemForDetailsTrailer = item;
    
  } catch (error) {
    console.error("Erro ao abrir modal de detalhes:", error);
    showNotification(error.message || "Erro ao abrir detalhes.", "error");
  } finally {
    isProcessing = false;
    hideLoading();
  }
}

// Configura os listeners do modal uma única vez quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById("details-modal");
  if (!modal) return;

  // Configurar o botão de fechar
  const closeButton = modal.querySelector('button[onclick*="details-modal"]');
  if (closeButton) {
    closeButton.removeAttribute('onclick'); // Remove o onclick inline
    closeButton.addEventListener('click', closeDetailsModal);
  }

  // Prevenir fechamento ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      e.preventDefault();
    }
  });

  // Prevenir fechamento com Escape
  modal.addEventListener('cancel', (e) => {
    e.preventDefault();
  });

  // Garantir limpeza ao fechar
  modal.addEventListener('close', () => {
    closeDetailsModal();
  });

  // Marca a página atual como ativa na navegação inferior
  function updateCurrentPage() {
    // Remove active class de todos os itens da navegação
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
      item.classList.remove('active');
      item.removeAttribute('aria-current');
    });
    
    // Adiciona active class e aria-current à página atual
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'watch_later.html';
    const currentNavItem = document.querySelector(`.bottom-nav .nav-item[href="${currentPage}"]`);
    
    if (currentNavItem) {
      currentNavItem.classList.add('active');
      currentNavItem.setAttribute('aria-current', 'page');
    }
  }

  // Chama a função quando a página carregar
  document.addEventListener('DOMContentLoaded', () => {
    updateCurrentPage();
    // ...resto do código existente de inicialização...
  });
});

function populateDetailsModal(details, item) {
  const modal = document.getElementById("details-modal");
  if (!modal) return;

  try {
    // Título e ano
    const title = details.title || details.name;
    const year = new Date(details.release_date || details.first_air_date).getFullYear();
    const titleElement = document.getElementById("details-title");
    if (titleElement) titleElement.textContent = `${title} (${year})`;

    // Poster
    const posterImg = document.getElementById("details-poster");
    if (posterImg) {
      posterImg.src = details.poster_path ? `${IMAGE_BASE_URL}${details.poster_path}` : "images/no-poster.png";
      posterImg.alt = `Poster de ${title}`;
    }

    // Preenche as informações com verificação de elemento
    const elements = {
      "details-overview": details.overview || "Sem sinopse disponível.",
      "details-rating": details.vote_average ? `${details.vote_average.toFixed(1)}/10` : "N/A",
      "details-release": formatDate(details.release_date || details.first_air_date),
      "details-director": details.director || "N/A",
      "details-cast": details.cast || "N/A"
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });

    // Configurar botão do trailer
    const trailerButton = document.getElementById("details-trailer-button");
    if (trailerButton) {
      if (details.videos?.results?.length > 0) {
        // Procura por um trailer oficial primeiro
        const trailer = details.videos.results.find(
          video => video.type === "Trailer" && video.site === "YouTube"
        ) || details.videos.results[0];
        
        if (trailer) {
          currentTrailerKey = trailer.key;
          trailerButton.style.display = "inline-block";
        } else {
          currentTrailerKey = null;
          trailerButton.style.display = "none";
        }
      } else {
        trailerButton.style.display = "none";
        currentTrailerKey = null;
      }
    }
  } catch (error) {
    console.error("Erro ao preencher modal:", error);
    showNotification("Erro ao exibir detalhes.", "error");
  }
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const options = { day: "2-digit", month: "2-digit", year: "numeric" };
  return new Date(dateString).toLocaleDateString("pt-BR", options);
}

// Event listeners são configurados no DOMContentLoaded

function closeAllModals() {
  if (isProcessing) return;
  
  return new Promise(resolve => {
    try {
      isProcessing = true;
      
      // Remove event listeners
      document.removeEventListener("click", window.__dropdownCloseHandler);
      document.removeEventListener("keydown", window.__escapeHandler);
      
      // Reset state variables
      currentItemForDetailsTrailer = null;
      
      // Close all modals
      document.querySelectorAll('dialog[open], .dropdown-menu.show').forEach(element => {
        if (element.classList.contains('dropdown-menu')) {
          element.classList.remove('show');
        } else {
          if (typeof element.close === 'function') element.close();
          element.removeAttribute('open');
          element.style.display = 'none';
        }
      });
      
      // Clean up backdrop and reset body
      document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
      
    } finally {
      isProcessing = false;
      setTimeout(resolve, 100);
    }
  });
}

function applyFiltersAndSort() {
  // Close all modals before applying new filters
  closeAllModals();
  let itemsToDisplay = [...watchLaterItemsGlobal];

  if (currentTypeFilterGlobal === "movie" || currentTypeFilterGlobal === "tv") {
    itemsToDisplay = itemsToDisplay.filter(
      (item) => item.type === currentTypeFilterGlobal
    );
  }
  if (searchTermGlobal) {
    itemsToDisplay = itemsToDisplay.filter((item) => {
      const title = (item.title || item.name || "").toLowerCase();
      if (!title.includes(searchTermGlobal)) return false;
      // Filtro exato para Deadpool
      if (searchTermGlobal === "deadpool") {
        const normalized = title.replace(/[^a-z0-9]/gi, " ").replace(/\s+/g, " ").trim();
        return /^deadpool(\s|$)/.test(normalized);
      }
      return true;
    });
  }

  switch (currentSortByGlobal) {
    case "title":
      itemsToDisplay.sort((a, b) =>
        (a.title || a.name || "").localeCompare(b.title || b.name || "")
      );
      break;
    case "addedDate":
      itemsToDisplay.sort(
        (a, b) => new Date(b.addedDate || 0) - new Date(a.addedDate || 0)
      );
      break;
    case "rating":
      itemsToDisplay.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
  }
  filteredItemsGlobal = itemsToDisplay;
  displayWatchLaterItems(filteredItemsGlobal);

  setTimeout(closeAllModals, 0);
}

function displayWatchLaterItems(itemsToDisplayOnGrid) {
  const grid = document.getElementById("watch-later-grid");
  if (!grid) {
    console.error("Elemento watch-later-grid não encontrado.");
    return;
  }
  
  grid.innerHTML = "";

  if (!Array.isArray(itemsToDisplayOnGrid) || itemsToDisplayOnGrid.length === 0) {
    let message = 'A sua lista "Ver Mais Tarde" está vazia.';
    if (searchTermGlobal || currentTypeFilterGlobal !== "all") {
      message = "Nenhum item corresponde aos filtros/pesquisa atuais.";
    }
    grid.innerHTML = `<p style="color: var(--text-color, white); text-align: center; width: 100%; padding: 20px;">${message}</p>`;
    return;
  }

  itemsToDisplayOnGrid.forEach((item) => {
    const card = document.createElement("article");
    card.classList.add("watch-later-card");
    card.tabIndex = 0;
    
    const itemTitle = item.title || item.name || "Título Desconhecido";
    card.setAttribute("aria-label", `Item: ${itemTitle}`);
    const posterUrl = item.poster_path
      ? `${IMAGE_BASE_URL}${item.poster_path}`
      : "https://via.placeholder.com/200x300?text=S/Poster";
    const itemTypeDisplay =
      item.type === "movie" ? "Filme" : item.type === "tv" ? "Série" : "N/A";
    const itemAddedDate = item.addedDate
      ? new Date(item.addedDate).toLocaleDateString("pt-BR")
      : "N/A";
    const itemRating = item.rating ? `${item.rating.toFixed(1)}/10` : "N/A";

    card.innerHTML = `
            <img src="${posterUrl}" alt="Poster de ${itemTitle}" loading="lazy">
            <div class="watch-later-card-content">
                <h3 class="watch-later-card-title">${itemTitle}</h3>
                <p class="card-info"><strong>Rating:</strong> ${itemRating}</p>
            </div>
            <div class="watch-later-card-actions">
                <button class="action-btn play-btn" title="Reproduzir ${itemTitle}" aria-label="Reproduzir ${itemTitle}">Play</button>
                <button class="action-btn details-btn" title="Ver detalhes de ${itemTitle}" aria-label="Ver detalhes de ${itemTitle}">View Details</button>
                <button class="action-btn remove-btn" title="Remover ${itemTitle}" aria-label="Remover ${itemTitle} da lista">Remove</button>
            </div>`;

    // Direct event handlers without safeModalOperation wrapper
    const playBtn = card.querySelector(".play-btn");
    const detailsBtn = card.querySelector(".details-btn");
    const removeBtn = card.querySelector(".remove-btn");

    if (playBtn) {
      playBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await playWatchLaterItem(item);
      });
    }

    if (detailsBtn) {
      detailsBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await closeAllModals();
        await openDetailsModal(item);
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await closeAllModals();
        card.classList.add("removing");
        await new Promise(resolve => 
          card.addEventListener('animationend', resolve, { once: true })
        );
        removeItemFromStorageAndRefresh(item.id, item.type);
      });
    }

    // Card click for details
    card.addEventListener("click", async (e) => {
      if (!e.target.closest(".action-btn")) {
        e.preventDefault();
        await closeAllModals();
        await openDetailsModal(item);
      }
    });

    grid.appendChild(card);
  });
}

async function fetchTmdbDetails(itemId, itemType) {
  showLoading();
  try {
    const lang = "pt-BR";
    const [detailsRes, creditsRes, externalIdsRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/${itemType}/${itemId}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=release_dates,videos`
      ),
      fetch(
        `${TMDB_BASE_URL}/${itemType}/${itemId}/credits?api_key=${TMDB_API_KEY}&language=${lang}`
      ),
      fetch(
        `${TMDB_BASE_URL}/${itemType}/${itemId}/external_ids?api_key=${TMDB_API_KEY}`
      ),
    ]);
    if (!detailsRes.ok)
      throw new Error(`Detalhes TMDB: ${detailsRes.statusText}`);
    if (!creditsRes.ok)
      throw new Error(`Créditos TMDB: ${creditsRes.statusText}`);
    if (!externalIdsRes.ok)
      throw new Error(`IDs Externos TMDB: ${externalIdsRes.statusText}`);

    const details = await detailsRes.json();
    const credits = await creditsRes.json();
    const externalIds = await externalIdsRes.json();

    const director =
      credits.crew?.find((member) => member.job === "Director")?.name || "N/A";
    const cast =
      credits.cast
        ?.slice(0, 5)
        .map((actor) => actor.name)
        .join(", ") || "N/A";

    return { ...details, imdb_id: externalIds.imdb_id, director, cast };
  } catch (error) {
    console.error("Erro ao obter detalhes TMDB:", error);
    showNotification("Erro ao carregar detalhes.", "error");
    return null;
  } finally {
    hideLoading();
  }
}

async function removeItemFromStorageAndRefresh(itemId, itemType) {
  if (isProcessing) {
    return;
  }

  try {
    isProcessing = true;
    showLoading();

    // Fecha o modal de detalhes se estiver aberto
    closeDetailsModal();

    // Remove o item da lista
    watchLaterItemsGlobal = watchLaterItemsGlobal.filter(
      (item) => !(item.id === itemId && item.type === itemType)
    );
    
    // Atualiza o localStorage
    localStorage.setItem("watchLater", JSON.stringify(watchLaterItemsGlobal));
    
    // Atualiza a interface
    await applyFiltersAndSort();
    showNotification("Item removido da lista!", "success");
  } catch (error) {
    console.error("Erro ao remover item:", error);
    showNotification("Erro ao remover item.", "error");
  } finally {
    hideLoading();
    isProcessing = false;
    isModalOpen = false;
  }
}

async function playWatchLaterItem(item) {
  showLoading();
  let imdbIdToPlay = item.imdb_id;
  if (!imdbIdToPlay) {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/${item.type}/${item.id}/external_ids?api_key=${TMDB_API_KEY}`
      );
      if (!response.ok) throw new Error("Falha ao obter IDs externos");
      const externalIdsData = await response.json();
      imdbIdToPlay = externalIdsData?.imdb_id;
    } catch (err) {
      console.error("Erro ao obter IMDB ID:", err);
      hideLoading();
      showNotification(
        "Não foi possível obter os detalhes para reprodução.",
        "error"
      );
      return;
    }
  }
  hideLoading();

  if (imdbIdToPlay) {
    playMovie(
      imdbIdToPlay,
      item.type,
      item.title || item.name,
      item.poster_path
    );
  } else {
    showNotification(
      "ID do IMDb não encontrado. Não é possível reproduzir.",
      "error"
    );
  }
}

function playMovie(imdbId, type, title, poster) {
  if (!imdbId) {
    showNotification(
      "Não é possível reproduzir: ID do IMDb está faltando.",
      "error"
    );
    return;
  }
  const playerUrl = `player.html?imdbId=${imdbId}&type=${type}&title=${encodeURIComponent(
    title
  )}&poster=${encodeURIComponent(poster)}`;
  window.open(playerUrl, "_blank");
}

window.sortBy = function (sortByOption, buttonElement) {
  currentSortByGlobal = sortByOption;
  const sortButtonText = document.querySelector(
    '.filter-bar button[data-tooltip="Opções de Ordenação"]'
  );
  if (sortButtonText)
    sortButtonText.innerHTML = `Ordenar Por: <span style="font-weight:bold;">${
      (buttonElement || { textContent: sortByOption }).textContent
    }</span>`;
  applyFiltersAndSort();
  showNotification(
    `Ordenado por: ${
      (buttonElement || { textContent: sortByOption }).textContent
    }!`,
    "success"
  );
};

window.filterBy = function (filterType, buttonElement) {
  currentTypeFilterGlobal = filterType;
  const filterButtonText = document.getElementById("filter-type-button");
  if (filterButtonText)
    filterButtonText.innerHTML = `Filtro: <span style="font-weight:bold;">${
      (buttonElement || { textContent: filterType }).textContent
    }</span>`;

  document
    .querySelectorAll("#filter-type-dropdown button")
    .forEach((btn) => btn.classList.remove("active-filter"));
  if (buttonElement) buttonElement.classList.add("active-filter");
  else {
    const btnToActivate = document.querySelector(
      `#filter-type-dropdown button[data-filter-type="${filterType}"]`
    );
    if (btnToActivate) btnToActivate.classList.add("active-filter");
  }
  applyFiltersAndSort();
  showNotification(
    `Filtrado por: ${
      (buttonElement || { textContent: filterType }).textContent
    }!`,
    "success"
  );
};

window.toggleDropdown = function (button) {
  // Remove previous handler if exists
  if (window.__dropdownCloseHandler) {
    document.removeEventListener("click", window.__dropdownCloseHandler, true);
    window.__dropdownCloseHandler = null;
  }

  const allDropdowns = document.querySelectorAll(".dropdown-menu");
  const clickedDropdown = button.nextElementSibling;
  if (!clickedDropdown) return;

  const isActive = clickedDropdown.classList.contains("show");
  
  // Close all other dropdowns first
  allDropdowns.forEach((dropdown) => {
    dropdown.classList.remove("show");
    if (dropdown.previousElementSibling) {
      dropdown.previousElementSibling.setAttribute("aria-expanded", "false");
    }
  });

  if (!isActive) {
    clickedDropdown.classList.add("show");
    button.setAttribute("aria-expanded", "true");

    window.__dropdownCloseHandler = (e) => {
      if (!button.contains(e.target) && !clickedDropdown.contains(e.target)) {
        clickedDropdown.classList.remove("show");
        button.setAttribute("aria-expanded", "false");
        document.removeEventListener("click", window.__dropdownCloseHandler, true);
        window.__dropdownCloseHandler = null;
      }
    };
    document.addEventListener("click", window.__dropdownCloseHandler, true);
  }
};

window.scrollToTop = function () {
  window.scrollTo({ top: 0, behavior: "smooth" });
  showNotification("De volta ao topo!", "info");
};
window.showTutorial = function () {
  const m = document.getElementById("tutorial-modal");
  if (m && typeof m.showModal === "function") m.showModal();
  else if (m) m.style.display = "block";
};
window.closeTutorial = function () {
  const m = document.getElementById("tutorial-modal");
  if (m && typeof m.close === "function") m.close();
  else if (m) m.style.display = "none";
};

document.addEventListener("DOMContentLoaded", () => {
  // Apply theme immediately before loading content
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  }

  // Retrieve and parse watch later items with error handling
  try {
    const savedItems = localStorage.getItem("watchLater");
    console.log("Saved items from localStorage:", savedItems); // Debug log
    
    if (savedItems) {
      watchLaterItemsGlobal = JSON.parse(savedItems);
      if (!Array.isArray(watchLaterItemsGlobal)) {
        console.error("Saved items is not an array");
        watchLaterItemsGlobal = [];
      }
    } else {
      console.log("No saved items found");
      watchLaterItemsGlobal = [];
    }
    
    filteredItemsGlobal = [...watchLaterItemsGlobal];
    console.log("Loaded items:", watchLaterItemsGlobal); // Debug log
  } catch (error) {
    console.error("Error loading watch later items:", error);
    watchLaterItemsGlobal = [];
    filteredItemsGlobal = [];
  }

  // Display items immediately after loading
  applyFiltersAndSort();

  // Initialize theme toggle button
  const themeToggleButton = document.querySelector(".theme-toggle");
  if (themeToggleButton) {
    updateThemeButton(themeToggleButton, savedTheme === "dark");
    
    themeToggleButton.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-theme");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      updateThemeButton(themeToggleButton, isDark);
      showNotification(
        `Tema alterado para ${isDark ? "Escuro" : "Claro"}!`,
        "success"
      );
    });
  }

  // Apply filters and display items
  applyFiltersAndSort();

  const hamburgerButton = document.querySelector(".hamburger");
  const sidebarElement = document.querySelector(".sidebar");
  if (hamburgerButton && sidebarElement) {
    hamburgerButton.addEventListener("click", () => {
      sidebarElement.classList.toggle("active");
      hamburgerButton.setAttribute(
        "aria-expanded",
        sidebarElement.classList.contains("active")
      );
    });
  }

  const userProfileIcon = document.querySelector(
    ".user-profile .fa-user-circle"
  );
  const profileDropdownMenu = document.querySelector(".profile-dropdown");
  if (userProfileIcon && profileDropdownMenu) {
    userProfileIcon.addEventListener("click", (event) => {
      event.stopPropagation();
      const isActive = profileDropdownMenu.classList.toggle("active");
      userProfileIcon.setAttribute("aria-expanded", isActive);
    });
    document.addEventListener("click", (event) => {
      if (
        profileDropdownMenu.classList.contains("active") &&
        !userProfileIcon.contains(event.target) &&
        !profileDropdownMenu.contains(event.target)
      ) {
        profileDropdownMenu.classList.remove("active");
        userProfileIcon.setAttribute("aria-expanded", "false");
      }
    });
  }

  const backToTopButton = document.querySelector(".back-to-top");
  if (backToTopButton) {
    window.addEventListener("scroll", () =>
      backToTopButton.classList.toggle("active", window.scrollY > 300)
    );
  }

  const helpButton = document.querySelector(".help-button");
  if (helpButton) {
    helpButton.addEventListener("click", window.showTutorial);
  }

  const searchInputElement = document.getElementById("search-input");
  if (searchInputElement) {
    searchInputElement.addEventListener("input", (e) => {
      searchTermGlobal = e.target.value.trim().toLowerCase();
      applyFiltersAndSort();
    });
  }

  const styleSheet = document.createElement("style");
  if (!document.getElementById("removeCardAnimationStyleWatchLater")) {
    styleSheet.id = "removeCardAnimationStyleWatchLater";
    styleSheet.textContent = `
            @keyframes removeCardAnimation { 0% { opacity: 1; transform: scale(1) translateX(0); } 100% { opacity: 0; transform: scale(0.8) translateX(50px); height: 0; padding: 0 !important; margin: 0 !important; border: 0 !important; overflow: hidden; } }
            .watch-later-card.removing { animation: removeCardAnimation 0.4s ease-out forwards; }`;
    document.head.appendChild(styleSheet);
  }

  // Global escape handler
  window.__escapeHandler = (event) => {
    if (event.key === "Escape") {
      closeAllModals();
      event.preventDefault();
    }
  };
  document.addEventListener("keydown", window.__escapeHandler);

  // Cleanup function for page unload
  window.addEventListener("unload", () => {
    closeAllModals();
    document.removeEventListener("keydown", window.__escapeHandler);
    if (window.__dropdownCloseHandler) {
      document.removeEventListener("click", window.__dropdownCloseHandler, true);
    }
  });
});

// Add this new helper function
function updateThemeButton(button, isDark) {
  button.innerHTML = `<i class="fas fa-${isDark ? "sun" : "moon"}"></i>`;
  button.setAttribute(
    "data-tooltip",
    isDark ? "Mudar para Tema Claro" : "Mudar para Tema Escuro"
  );
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Função auxiliar para controle de operações
const processOperation = async (operation) => {
  if (isProcessing) return;
  try {
    isProcessing = true;
    await operation();
  } finally {
    isProcessing = false;
  }
};

async function openDetailsModal(item) {
  if (isProcessing) return;
  
  const modal = document.getElementById("details-modal");
  if (!modal) return;

  try {
    isProcessing = true;
    document.getElementById("details-title").textContent = "Loading...";
    document.getElementById("details-overview").textContent = "";
    document.getElementById("trailer-button").style.display = "none";
    modal.showModal();

    const itemId = item.id;
    let itemTypeForApiCall = item.type;
    if (!itemId || !itemTypeForApiCall) {
      throw new Error("Missing ID or type for API call.");
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/${itemTypeForApiCall}/${itemId}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=videos`
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch full details from API.");
    }

    const details = await response.json();
    console.log("API Response:", details); // Para debug

    const title = details.title || details.name || "Sem título";
    document.getElementById("details-title").textContent = title;
    document.getElementById("details-poster").src = details.poster_path
      ? `${IMAGE_BASE_URL}${details.poster_path}`
      : "https://via.placeholder.com/300x450?text=Sem+Poster";
    document.getElementById("details-poster").alt = `${title} Poster`;
    document.getElementById("details-overview").textContent =
      details.overview || "Sem descrição disponível.";
    document.getElementById("details-rating").textContent =
      (details.vote_average ? details.vote_average.toFixed(1) : "N/A") + "/10";
    document.getElementById("details-release").textContent =
      details.release_date || details.first_air_date || "Desconhecido";

    // Lógica do trailer
    const trailer =
      details.videos?.results.find(
        (v) => v.type === "Trailer" && v.site === "YouTube"
      ) || details.videos?.results.find((v) => v.site === "YouTube");
    
    console.log("Trailer encontrado:", trailer); // Para debug
    
    currentTrailerKey = trailer ? trailer.key : "";
    const trailerButton = document.getElementById("trailer-button");
    if (trailerButton) {
      console.log("Estado do botão:", currentTrailerKey ? "mostrar" : "esconder"); // Para debug
      trailerButton.style.display = currentTrailerKey ? "inline-block" : "none";
    }
  } catch (error) {
    console.error("Error fetching details:", error);
    showNotification("Não foi possível carregar os detalhes deste item.", "error");
    if (modal && modal.hasAttribute("open")) modal.close();
  } finally {
    isProcessing = false;
  }
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
    showNotification("Não há trailer disponível para este item.", "info");
  }
}

function closeTrailerModal() {
  const iframe = document.getElementById("trailer-iframe");
  const modal = document.getElementById("trailer-modal");
  if (iframe) iframe.src = "";
  if (modal && modal.hasAttribute("open")) modal.close();
}

// --- FIM MODIFICAÇÕES ---