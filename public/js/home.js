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

const TMDB_API_KEY = "f0609e6638ef2bc5b31313a712e7a8a4";
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
  if (type === "movie") {
    const poster = item.poster_path
      ? `${IMAGE_BASE_URL}${item.poster_path}`
      : "https://via.placeholder.com/500x750?text=No+Poster";
    const titleText = item.title || item.name || "Untitled";
    playMovie(item.imdb_id, "movie", titleText, poster);
  } else if (type === "tv" || type === "series") {
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
        const itemJSON = JSON.stringify(item).replace(/'/g, "'");
        return `
                <article class="movie-card" style="--i: ${index + 1};">
                    <img src="${poster}" alt="${titleText} Poster">
                    <div class="carousel-item-overlay">
                        <button class="play-btn" data-item='${itemJSON}'>Play</button>
                        <button class="details-btn" data-item='${itemJSON}'>View Details</button>
                        <button class="watch-later-btn" data-item='${itemJSON}'>Add to Watch Later</button>
                    </div>
                    <div class="carousel-item-content">
                        <h3>${titleText}</h3>
                        <p>Rating: ${
                          item.vote_average
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
      const itemData = JSON.parse(itemDataString);
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
        const itemJSON = JSON.stringify(item).replace(/'/g, "'");
        return `
            <div class="carousel-item" style="--i: ${index + 1};">
                <img src="${poster}" alt="${titleText} Poster">
                <div class="carousel-item-overlay">
                    <button class="play-btn" data-item='${itemJSON}'>Play</button>
                    <button class="details-btn" data-item='${itemJSON}'>View Details</button>
                    <button class="watch-later-btn" data-item='${itemJSON}'>Add to Watch Later</button>
                </div>
                <div class="carousel-item-content">
                    <h3>${titleText}</h3>
                    <p>Rating: ${
                      item.vote_average ? item.vote_average.toFixed(1) : "N/A"
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
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${seriesData.id}?api_key=${TMDB_API_KEY}&language=en-US`
    );
    if (!response.ok) throw new Error("Failed to fetch series details.");
    const details = await response.json();

    seasonsList.innerHTML = details.seasons
      .filter((season) => season.season_number > 0)
      .map(
        (season) =>
          `<button onclick="fetchEpisodes(${seriesData.id}, ${season.season_number}, '${seriesData.imdb_id}', this)">${season.name}</button>`
      )
      .join("");
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

async function fetchEpisodes(seriesId, seasonNumber, seriesImdbId, seasonButton) {
  const episodesList = document.getElementById('episodes-list');
  const seasonsContainer = document.querySelector('.seasons-container');
  const episodesContainer = document.querySelector('.episodes-container');
  
  episodesList.innerHTML = '<div class="loading-spinner active"><i class="fas fa-spinner fa-spin"></i></div>';

  document.querySelectorAll('#seasons-list button').forEach(btn => btn.classList.remove('active'));
  if (seasonButton) seasonButton.classList.add('active');

  try {
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

    const poster = seasonDetails.poster_path 
      ? `${IMAGE_BASE_URL}${seasonDetails.poster_path}`
      : 'https://via.placeholder.com/500x750?text=No+Poster';

    episodesList.innerHTML = seasonDetails.episodes.map((episode) => {
      const title = `${episode.episode_number}. ${episode.name}`;
      const fullTitle = `${seasonDetails.name} - ${title}`;
      return `
        <button class="episode-button" 
                data-imdb-id="${seriesImdbId}" 
                data-type="series" 
                data-title="${fullTitle.replace(/"/g, '"')}" 
                data-poster="${poster}" 
                data-season="${seasonNumber}" 
                data-episode="${episode.episode_number}">
          <span>${title}</span>
          <i class="fas fa-play play-icon"></i>
        </button>`;
    }).join('');

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

function addToWatchLater(itemData, type) {
  const itemType =
    itemData.media_type || type || (itemData.title ? "movie" : "tv");
  const title = itemData.title || itemData.name || "Untitled";
  if (!watchLaterList.some((item) => item.id === itemData.id)) {
    watchLaterList.push({
      id: itemData.id,
      title: title,
      imdb_id: itemData.imdb_id || null,
      poster_path: itemData.poster_path,
      type: itemType,
      rating: itemData.vote_average,
      overview: itemData.overview,
      release_date: itemData.release_date || itemData.first_air_date,
      addedDate: new Date().toISOString(),
    });
    localStorage.setItem("watchLater", JSON.stringify(watchLaterList));
    showNotification(`${title} added to Watch Later!`, "success");
  } else {
    showNotification(`${title} is already in Watch Later.`, "info");
  }
}

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

document.addEventListener("DOMContentLoaded", () => {
  fetchMovies("movie/now_playing", "new-movies", "movie");
  fetchMovies("tv/on_the_air", "new-series", "tv");
  fetchMovies("movie/popular", "popular-movies", "movie");
  fetchMovies("tv/popular", "popular-series", "tv");
  setupSearchBar();
  setupSeriesModalEventListeners();

  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
      const isDark = document.body.classList.contains("dark-theme");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      themeToggle.innerHTML = `<i class="fas fa-${
        isDark ? "sun" : "moon"
      }"></i>`;
    });
    if (localStorage.getItem("theme") === "dark") {
      document.body.classList.add("dark-theme");
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
  }

  const helpButton = document.querySelector(".help-button");
  if (helpButton)
    helpButton.addEventListener("click", () =>
      document.getElementById("tutorial-modal").showModal()
    );

    const getStartedButton = document.getElementById("get-started-button");
  if (getStartedButton) {
    getStartedButton.addEventListener("click", () => {
      showTutorial();
      const tutorialModal = document.getElementById("tutorial-modal");
      if (tutorialModal && tutorialModal.hasAttribute("open")) {
        tutorialModal.close();
      }
    });
  }

  async function fetchData() {
    try {
      const response = await fetch('https://api.consumet.org/movies/flixhq/home');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      if (data && data.hasOwnProperty('streams') && Array.isArray(data.streams)) {
        return {
          success: true,
          data: data.streams,
          cacheInfo: {
            maxAge: data.cacheMaxAge,
            staleRevalidate: data.staleRevalidate,
            staleError: data.staleError
          }
        };
      } else {
        console.warn('Unexpected data structure:', data);
        return { success: false, error: 'Invalid data structure' };
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      return { success: false, error: error.message };
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      showLoadingSpinner();
      const result = await fetchData();
      
      if (result.success && result.data) {
        displayMovies(result.data);
      } else {
        showError('Não foi possível carregar o conteúdo.');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Erro ao carregar conteúdo.');
    } finally {
      hideLoadingSpinner();
    }
  });
});