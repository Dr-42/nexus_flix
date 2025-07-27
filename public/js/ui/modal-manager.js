import { VideoPlayer } from "../video-player/video-player.js";

/**
 * Modal management for media details and video player
 */
export class ModalManager {
  constructor(tmdbApi, localFileDatabase) {
    this.tmdbApi = tmdbApi;
    this.localFileDatabase = localFileDatabase;

    this.modal = document.getElementById("details-modal");
    this.modalContent = document.getElementById("modal-content");
    this.videoPlayerModal = document.getElementById("video-player-modal");
    this.videoPlayerContent = document.getElementById("video-player-content");
    this.videoCloseBtn = document.getElementById("video-close-btn");
    this.videoErrorOverlay = document.getElementById("video-error-overlay");

    // Note: nexusPlayer is now a global variable for compatibility

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Details modal close
    this.modal.addEventListener("click", (e) => {
      if (e.target.closest(".modal-close-btn") || e.target === this.modal) {
        this.hideModal();
      }
    });

    // Video player modal close
    if (this.videoCloseBtn) {
      this.videoCloseBtn.addEventListener("click", (e) => {
        console.log("Close button clicked");
        e.preventDefault();
        e.stopPropagation();
        this.hideVideoPlayer();
      });
    } else {
      console.warn("Video close button not found");
    }

    this.videoPlayerModal.addEventListener("click", (e) => {
      if (e.target === this.videoPlayerModal) {
        this.hideVideoPlayer();
      }
    });

    // Add keyboard shortcut to close video player
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        this.videoPlayerModal.classList.contains("visible")
      ) {
        this.hideVideoPlayer();
      }
    });
  }

  showModal() {
    this.modal.classList.add("visible");
  }

  hideModal() {
    this.modal.classList.remove("visible");
  }

  async showDetails(itemId, itemType) {
    this.showModal();
    this.modalContent.innerHTML = `<div class="flex justify-center items-center h-96"><div class="loader"></div></div>`;
    const dbKey = `${itemType}-${itemId}`;
    const localFiles = this.localFileDatabase[dbKey];

    try {
      const item = await this.tmdbApi.fetchFromBackend(`${itemType}/${itemId}`, {
        append_to_response: "credits,videos,recommendations",
      });

      const title = item.title || item.name;
      const backdropPath =
        this.tmdbApi.getImageUrl(item.backdrop_path, "w1280") || "";
      const posterPath =
        this.tmdbApi.getImageUrl(item.poster_path) ||
        this.tmdbApi.getPlaceholderImage();

      let seasonsHTML = "";
      if (itemType === "tv" && item.seasons) {
        seasonsHTML = await this.generateSeasonsHTML(item, itemId, localFiles);
      }

      this.modalContent.innerHTML = this.generateModalHTML(
        item,
        title,
        backdropPath,
        posterPath,
        localFiles,
        itemType,
        seasonsHTML,
      );
      lucide.createIcons();
    } catch (error) {
      console.error(`Failed to load details for ${itemType}/${itemId}:`, error);
      this.modalContent.innerHTML = `<div class="p-6 text-center text-red-400">Error loading details. ${error.message}</div>`;
    }
  }

  async generateSeasonsHTML(item, itemId, localFiles) {
    const seasonPromises = item.seasons
      .filter((s) => s.season_number > 0 && s.episode_count > 0) // Exclude "Specials" and empty seasons
      .map((s) => this.tmdbApi.fetchFromBackend(`tv/${itemId}/season/${s.season_number}`));
    const seasonsDetails = await Promise.all(seasonPromises);

    return (
      `<div class="space-y-2 mt-4">` +
      seasonsDetails
        .map((season) => {
          if (!season || !season.episodes) return "";
          return `
            <div>
              <button class="season-accordion-btn flex justify-between items-center">
                <span>${season.name}</span>
                <i data-lucide="chevron-down" class="w-5 h-5 transition-transform"></i>
              </button>
              <div class="episode-list bg-black/20 p-2 rounded-b-lg">
                <ul class="space-y-2">
                  ${season.episodes
                    .map((ep) => {
                      const episodeFile = localFiles
                        ? localFiles[
                            `${season.season_number}-${ep.episode_number}`
                          ]
                        : null;
                      return `
                        <li class="p-2 flex justify-between items-center rounded-md hover:bg-black/20">
                          <div class="flex-1 mr-4">
                            <span class="font-bold">${ep.episode_number}. ${ep.name}</span>
                            <p class="text-xs text-gray-400 mt-1 line-clamp-2">${ep.overview}</p>
                          </div>
                          <button class="play-episode-btn flex-shrink-0 px-3 py-1 rounded ${episodeFile ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 cursor-not-allowed"}" ${episodeFile ? `data-path="${episodeFile}"` : "disabled"}>Play</button>
                        </li>
                      `;
                    })
                    .join("")}
                </ul>
              </div>
            </div>
          `;
        })
        .join("") +
      `</div>`
    );
  }

  generateModalHTML(
    item,
    title,
    backdropPath,
    posterPath,
    localFiles,
    itemType,
    seasonsHTML,
  ) {
    const trailer = item.videos?.results.find(
      (video) => video.type === "Trailer" && video.site === "YouTube",
    );
    return `
      <div class="relative">
        <button class="modal-close-btn"><i data-lucide="x" class="w-6 h-6"></i></button>
        <img src="${backdropPath}" class="w-full h-48 md:h-80 object-cover" onerror="this.style.display='none'">
        <div class="absolute inset-0 bg-gradient-to-t from-[color:var(--bg-secondary)] via-[color:var(--bg-secondary)]/70 to-transparent"></div>
      </div>

      <div id="details-view" class="p-6 space-y-6 -mt-24 relative">
        <div class="flex flex-col md:flex-row gap-6">
          <img src="${posterPath}" class="w-1/3 max-w-[200px] h-auto rounded-lg shadow-2xl self-center md:self-start" onerror="this.onerror=null;this.src='${this.tmdbApi.getPlaceholderImage()}';">
          <div class="flex-1 pt-8">
            <h2 class="text-3xl lg:text-4xl font-bold text-[color:var(--text-primary)]">${title}</h2>
            <div class="flex items-center gap-4 mt-2 text-[color:var(--text-secondary)]">
              <span>${(item.release_date || item.first_air_date || "").substring(0, 4)}</span>
              <span class="flex items-center gap-1"><i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-current"></i> ${item.vote_average.toFixed(1)}</span>
              ${item.number_of_seasons ? `<span>${item.number_of_seasons} Seasons</span>` : ""}
            </div>
            <div class="flex flex-wrap gap-2 mt-4">
              ${item.genres.map((g) => `<span class="px-3 py-1 text-xs rounded-full bg-[color:var(--bg-tertiary)]">${g.name}</span>`).join("")}
            </div>
            ${localFiles && itemType === "movie" ? `<button class="play-movie-btn mt-4 w-full px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:opacity-90 transition-opacity" data-path="${localFiles}">Play Movie</button>` : ""}
          </div>
        </div>

        <div>
          <h3 class="font-semibold text-lg mb-2">Overview</h3>
          <p class="text-[color:var(--text-secondary)] leading-relaxed">${item.overview}</p>
          ${seasonsHTML}
        </div>

        ${
          trailer
            ? `
        <div class="pt-6 border-t border-[color:var(--border-color)]">
            <h3 class="font-semibold text-lg mb-4">Trailer</h3>
            <div class="aspect-video">
                <iframe 
                    src="https://www.youtube.com/embed/${trailer.key}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                    class="w-full h-full rounded-lg"
                ></iframe>
            </div>
        </div>
        `
            : ""
        }

        <div class="flex flex-wrap gap-4">
          ${
            this.localFileDatabase[`${itemType}-${item.id}`]
              ? `<button id="change-tmdb-btn" data-id="${item.id}" data-type="${itemType}" data-title="${title.replace(/"/g, "&quot;")}" class="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white font-semibold hover:opacity-90 transition-opacity">Change TMDB Match</button>`
              : ""
          }
        </div>

        <div id="similar-section" class="pt-6 border-t border-[color:var(--border-color)]">
          ${
            item.recommendations?.results.length > 0
              ? `
                <h3 class="font-semibold text-lg mb-4">Similar Titles</h3>
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">${item.recommendations.results
                  .slice(0, 6)
                  .map((rec) => this.createMediaCard(rec))
                  .join("")}</div>
              `
              : `<p class="text-center text-[color:var(--text-secondary)]">No similar titles found.</p>`
          }
        </div>
      </div>
      <div id="tmdb-change-interface" class="hidden p-6 space-y-4"></div>
    `;
  }

  createMediaCard(item) {
    // Simple media card for recommendations - could be extracted to MediaCardRenderer
    const title = item.title || item.name;
    const posterPath =
      this.tmdbApi.getImageUrl(item.poster_path) ||
      this.tmdbApi.getPlaceholderImage();
    const itemType = item.media_type || (item.title ? "movie" : "tv");

    return `
      <div class="media-card group overflow-hidden relative shadow-lg aspect-[2/3]" data-id="${item.id}" data-type="${itemType}">
        <img src="${posterPath}" alt="${title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h4 class="font-bold text-white text-sm drop-shadow-md">${title}</h4>
          <button class="details-btn mt-1 text-xs bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded-md hover:bg-white/30 transition-colors w-full">Details</button>
        </div>
      </div>
    `;
  }

  showVideoPlayer(filePath) {
    this.videoErrorOverlay.classList.add("hidden");
    this.videoErrorOverlay.classList.remove("flex");

    if (window.nexusPlayer && window.nexusPlayer.player) {
      window.nexusPlayer.player.dispose();
      window.nexusPlayer = null;
    }

    const existingPlayerEl = document.getElementById("video-player");
    if (existingPlayerEl) {
      existingPlayerEl.remove();
    }

    const videoEl = document.createElement("video");
    videoEl.id = "video-player";
    videoEl.className = "video-js vjs-midnight-skin vjs-big-play-centered";
    videoEl.style.width = "100%";
    videoEl.style.height = "100%";

    this.videoPlayerContent.insertBefore(videoEl, this.videoErrorOverlay);
    this.videoPlayerModal.classList.add("visible");

    // Ensure close button is working by re-adding event listener
    setTimeout(() => {
      const closeBtn = document.getElementById("video-close-btn");
      if (closeBtn) {
        // Remove any existing listeners and add a new one
        closeBtn.onclick = (e) => {
          console.log("Close button clicked via onclick");
          e.preventDefault();
          e.stopPropagation();
          this.hideVideoPlayer();
        };
        console.log("Close button event listener re-added");
      }
    }, 100);

    try {
      console.log("filePath:", filePath);
      window.nexusPlayer = new VideoPlayer("video-player", filePath);
    } catch (error) {
      console.error("Failed to initialize VideoPlayer:", error);
      this.videoErrorOverlay.classList.remove("hidden");
      this.videoErrorOverlay.classList.add("flex");
      lucide.createIcons();
    }
  }

  hideVideoPlayer() {
    this.videoPlayerModal.classList.remove("visible");
    if (window.nexusPlayer && window.nexusPlayer.player) {
      window.nexusPlayer.player.dispose();
      window.nexusPlayer = null;
    }
  }
}
