/**
 * UI components for rendering media cards and featured content
 */
export class MediaCardRenderer {
  constructor(tmdbApi, localFileDatabase) {
    this.tmdbApi = tmdbApi;
    this.localFileDatabase = localFileDatabase;
  }

  createMediaCard(item) {
    const title = item.title || item.name;
    const posterPath = this.tmdbApi.getImageUrl(item.poster_path) || 
                      this.tmdbApi.getPlaceholderImage();
    const itemType = item.media_type || (item.title ? "movie" : "tv");
    const dbKey = `${itemType}-${item.id}`;
    const isInLocal = !!this.localFileDatabase[dbKey];

    return `
      <div class="media-card group overflow-hidden relative shadow-lg aspect-[2/3]" data-id="${item.id}" data-type="${itemType}">
        <img src="${posterPath}" alt="${title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onerror="this.onerror=null;this.src='${this.tmdbApi.getPlaceholderImage(400, 600, 'Image+Error')}';">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h4 class="font-bold text-white text-lg drop-shadow-md">${title}</h4>
          <button class="details-btn mt-2 text-sm bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-md hover:bg-white/30 transition-colors w-full">Details</button>
        </div>
        ${isInLocal ? '<div class="local-indicator">In Library</div>' : ""}
      </div>
    `;
  }

  createFeaturedCard(item) {
    const title = item.title || item.name;
    const backdropPath = this.tmdbApi.getImageUrl(item.backdrop_path, "w1280") || 
                        this.tmdbApi.getPlaceholderImage(1280, 720);
    const itemType = item.media_type || (item.title ? "movie" : "tv");

    return `
      <div class="media-card group overflow-hidden relative shadow-lg aspect-video flex flex-col justify-end p-6" data-id="${item.id}" data-type="${itemType}">
        <img src="${backdropPath}" alt="${title}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 z-0" onerror="this.onerror=null;this.src='${this.tmdbApi.getPlaceholderImage(1280, 720, 'Image+Error')}';">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10"></div>
        <div class="relative z-20">
          <h2 class="text-4xl font-bold text-white drop-shadow-lg">${title}</h2>
          <p class="mt-2 max-w-2xl text-gray-200 line-clamp-2">${item.overview}</p>
          <button class="details-btn mt-4 text-md bg-white/20 backdrop-blur-sm text-white px-5 py-2.5 rounded-lg hover:bg-white/30 transition-colors font-semibold">
            View Details
          </button>
        </div>
      </div>
    `;
  }

  async populateGrid(endpoint, gridId, cardCreator, params = {}) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    grid.innerHTML = `<div class="grid-loader"><div class="loader"></div></div>`;
    
    try {
      const data = await this.tmdbApi.fetchFromBackend(endpoint, params);
      if (data.results.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-[color:var(--text-secondary)]">No results found for the selected criteria.</p>`;
        return;
      }
      grid.innerHTML = data.results.slice(0, 18).map(item => cardCreator.call(this, item)).join("");
      lucide.createIcons();
    } catch (error) {
      console.error(`Failed to load ${gridId}:`, error);
      grid.innerHTML = `<div class="col-span-full text-center text-red-400 p-4 bg-red-900/50 rounded-lg">
        <p class="font-semibold">Error loading content.</p>
        <p class="text-sm">${error.message}</p>
      </div>`;
    }
  }
}

