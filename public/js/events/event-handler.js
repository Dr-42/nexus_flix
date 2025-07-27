/**
 * Global event handling and delegation
 */
export class EventHandler {
  constructor(modalManager, localLibraryManager, tmdbApi) {
    this.modalManager = modalManager;
    this.localLibraryManager = localLibraryManager;
    this.tmdbApi = tmdbApi;

    this.setupGlobalEventListeners();
  }

  setupGlobalEventListeners() {
    document.body.addEventListener("click", (e) => this.handleGlobalClick(e));

    // Listen for page changes
    document.addEventListener("pageChanged", (e) => {
      if (e.detail.page === "local-library") {
        this.localLibraryManager.renderLocalMedia();
      }
    });
  }

  async handleGlobalClick(e) {
    // Details button on media cards
    const detailsBtn = e.target.closest(".details-btn");
    if (detailsBtn) {
      const card = detailsBtn.closest("[data-id]");
      if (card) {
        await this.modalManager.showDetails(card.dataset.id, card.dataset.type);
      }
      return;
    }

    // Change TMDB Match button
    const changeTmdbBtn = e.target.closest("#change-tmdb-btn");
    if (changeTmdbBtn) {
      this.handleChangeTmdbMatch(changeTmdbBtn);
      return;
    }

    // Search button within the change TMDB interface
    const tmdbChangeSearchBtn = e.target.closest("#tmdb-change-search-btn");
    if (tmdbChangeSearchBtn) {
      const query = document
        .getElementById("tmdb-change-search-input")
        .value.trim();
      if (query) {
        await this.performTmdbChangeSearch(
          query,
          tmdbChangeSearchBtn.dataset.type,
          tmdbChangeSearchBtn.dataset.oldId,
        );
      }
      return;
    }

    // Cancel button within the change TMDB interface
    const cancelChangeBtn = e.target.closest("#cancel-tmdb-change-btn");
    if (cancelChangeBtn) {
      this.cancelTmdbChange();
      return;
    }

    // Select button for a new TMDB entry
    const selectNewTmdbBtn = e.target.closest(".select-new-tmdb-btn");
    if (selectNewTmdbBtn) {
      await this.handleSelectNewTmdb(selectNewTmdbBtn);
      return;
    }

    // Accordion toggle
    const accordionBtn = e.target.closest(".season-accordion-btn");
    if (accordionBtn) {
      this.toggleAccordion(accordionBtn);
      return;
    }

    // Play button
    const playBtn = e.target.closest(".play-episode-btn, .play-movie-btn");
    if (playBtn && playBtn.dataset.path) {
      this.modalManager.showVideoPlayer(playBtn.dataset.path);
      return;
    }
  }

  handleChangeTmdbMatch(changeTmdbBtn) {
    const itemId = changeTmdbBtn.dataset.id;
    const itemType = changeTmdbBtn.dataset.type;
    const itemTitle = changeTmdbBtn.dataset.title;

    const detailsView = document.getElementById("details-view");
    const changeInterfaceDiv = document.getElementById("tmdb-change-interface");

    detailsView.classList.add("hidden");
    changeInterfaceDiv.classList.remove("hidden");

    changeInterfaceDiv.innerHTML = `
      <h3 class="text-xl font-bold">Change TMDB Match for "${itemTitle}"</h3>
      <p class="text-sm text-[color:var(--text-secondary)]">Search for the correct title below. The current entry will be replaced.</p>
      <div class="relative flex gap-2">
        <input type="text" id="tmdb-change-search-input" placeholder="Search for new title..." class="search-input w-full pl-4 pr-4 py-2 rounded-lg text-base">
        <button id="tmdb-change-search-btn" data-old-id="${itemId}" data-type="${itemType}" class="px-4 py-2 rounded-lg bg-[color:var(--accent-primary)] text-white font-semibold">Search</button>
      </div>
      <div id="tmdb-change-results" class="mt-4 max-h-96 overflow-y-auto space-y-2 p-1"></div>
      <button id="cancel-tmdb-change-btn" class="mt-4 w-full px-4 py-2 rounded-lg bg-[color:var(--bg-tertiary)] hover:bg-[color:var(--border-color)] text-white font-semibold">Cancel</button>
    `;
    document.getElementById("tmdb-change-search-input").focus();
  }

  async performTmdbChangeSearch(query, type, oldId) {
    const resultsContainer = document.getElementById("tmdb-change-results");
    resultsContainer.innerHTML = `<div class="flex justify-center items-center h-20"><div class="loader"></div></div>`;

    try {
      const data = await this.tmdbApi.fetchFromBackend(`search/${type}`, {
        query,
      });
      if (data.results.length === 0) {
        resultsContainer.innerHTML = `<p class="text-center text-[color:var(--text-secondary)]">No results found.</p>`;
        return;
      }

      resultsContainer.innerHTML = data.results
        .map((result) => {
          const title = result.title || result.name;
          const year = (
            result.release_date ||
            result.first_air_date ||
            ""
          ).substring(0, 4);
          const posterPath =
            this.tmdbApi.getImageUrl(result.poster_path, "w92") ||
            this.tmdbApi.getPlaceholderImage(92, 138, "N/A");

          return `
            <div class="flex items-center gap-4 p-2 rounded-lg bg-[color:var(--bg-tertiary)]">
              <img src="${posterPath}" class="w-12 h-auto rounded" onerror="this.onerror=null;this.src='${this.tmdbApi.getPlaceholderImage(92, 138, "N/A")}';">
              <div class="flex-grow">
                <p class="font-semibold">${title}</p>
                <p class="text-sm text-[color:var(--text-secondary)]">${year}</p>
              </div>
              <button class="select-new-tmdb-btn px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm" data-new-id="${result.id}" data-old-id="${oldId}" data-type="${type}">
                Select
              </button>
            </div>
          `;
        })
        .join("");
    } catch (error) {
      resultsContainer.innerHTML = `<p class="text-center text-red-400">Error during search: ${error.message}</p>`;
    }
  }

  cancelTmdbChange() {
    const detailsView = document.getElementById("details-view");
    const changeInterfaceDiv = document.getElementById("tmdb-change-interface");
    changeInterfaceDiv.classList.add("hidden");
    detailsView.classList.remove("hidden");
    changeInterfaceDiv.innerHTML = ""; // Clean up
  }

  async handleSelectNewTmdb(selectNewTmdbBtn) {
    selectNewTmdbBtn.disabled = true;
    selectNewTmdbBtn.innerHTML = '<div class="loader-small mx-auto"></div>';

    const newId = selectNewTmdbBtn.dataset.newId;
    const oldId = selectNewTmdbBtn.dataset.oldId;
    const type = selectNewTmdbBtn.dataset.type;

    try {
      const newItemData = await this.tmdbApi.fetchFromBackend(`${type}/${newId}`);
      const localMovies = this.localLibraryManager.getLocalMovies();
      const localSeries = this.localLibraryManager.getLocalSeries();
      const localFileDatabase = this.localLibraryManager.getLocalFileDatabase();

      const localArray = type === "movie" ? localMovies : localSeries;
      const oldItemIndex = localArray.findIndex((item) => item.id == oldId);

      if (oldItemIndex === -1) {
        throw new Error(
          "Could not find the old item in the local library to replace.",
        );
      }

      const oldDbKey = `${type}-${oldId}`;
      const newDbKey = `${type}-${newId}`;
      if (localFileDatabase[oldDbKey]) {
        localFileDatabase[newDbKey] = localFileDatabase[oldDbKey];
        delete localFileDatabase[oldDbKey];
      }

      localArray.splice(oldItemIndex, 1, newItemData);

      // Update the local library manager
      this.localLibraryManager.updateLocalData(
        localMovies,
        localSeries,
        localFileDatabase,
      );
      await this.localLibraryManager.saveToServer();

      await this.modalManager.showDetails(newId, type);
      this.localLibraryManager.renderLocalMedia();

      // Trigger content reload
      const event = new CustomEvent("contentReload");
      document.dispatchEvent(event);
    } catch (error) {
      console.error("Failed to change TMDB entry:", error);
      alert(`Error: ${error.message}`);
      await this.modalManager.showDetails(oldId, type); // Revert to old view on failure
    }
  }

  toggleAccordion(accordionBtn) {
    const episodeList = accordionBtn.nextElementSibling;
    const icon = accordionBtn.querySelector("i");
    if (episodeList.style.maxHeight) {
      episodeList.style.maxHeight = null;
      icon.style.transform = "rotate(0deg)";
    } else {
      episodeList.style.maxHeight = episodeList.scrollHeight + "px";
    }
  }
}
