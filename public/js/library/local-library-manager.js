import { FileData } from '../video-player/video-metadata.js';

/**
 * Local library management for importing and organizing media files
 */
export class LocalLibraryManager {
  constructor(tmdbApi, mediaCardRenderer = null) {
    this.tmdbApi = tmdbApi;
    this.mediaCardRenderer = mediaCardRenderer;
    this.localMovies = [];
    this.localSeries = [];
    this.localFileDatabase = [];
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.importLibraryBtn = document.getElementById("import-library-btn");
    this.localStatus = document.getElementById("local-status");
    this.localMediaGrid = document.getElementById("local-media-grid");
    this.libraryTabs = document.getElementById("library-tabs");
    this.localLibrarySortBy = document.getElementById("local-library-sort-by");
  }

  setupEventListeners() {
    this.importLibraryBtn.addEventListener("click", () => this.importLibrary());
    this.libraryTabs.addEventListener("click", (e) => this.handleTabClick(e));
    this.localLibrarySortBy.addEventListener("change", () => this.renderLocalMedia());
  }

  handleTabClick(e) {
    if (e.target.classList.contains("library-tab")) {
      this.libraryTabs.querySelector(".active").classList.remove("active");
      e.target.classList.add("active");
      this.renderLocalMedia();
    }
  }

  async importLibrary() {
    try {
      const response = await fetch(`/file_list`);
      if (!response.ok) throw new Error("Failed to fetch files");

      const files = await response.json();
      const fileData = FileData.fromJsonArray(files);
      await this.handleLibrarySelection(fileData);
    } catch (error) {
      console.error("Failed to import library:", error);
      this.showStatus(`Error importing library: ${error.message}`, "error");
    }
  }

  async handleLibrarySelection(allFiles) {
    if (!allFiles || allFiles.length === 0) return;

    const files = Array.from(allFiles);
    this.showStatus("Analyzing folder structure and matching files... This may take a moment for large libraries.", "loading");

    const { moviesToProcess, seriesToProcess } = this.categorizeFiles(files);

    const moviePromises = Array.from(moviesToProcess.entries()).map(
      ([title, files]) => this.processMovie(title, files)
    );

    const seriesPromises = Array.from(seriesToProcess.entries()).map(
      ([title, files]) => this.processSeries(title, files)
    );

    const [movieResults, seriesResults] = await Promise.all([
      Promise.all(moviePromises),
      Promise.all(seriesPromises),
    ]);

    const newMovies = movieResults.filter(Boolean).filter(
      (newItem) => !this.localMovies.some((existing) => existing.id === newItem.id)
    );
    const newSeries = seriesResults.filter(Boolean).filter(
      (newItem) => !this.localSeries.some((existing) => existing.id === newItem.id)
    );

    this.localMovies = [...this.localMovies, ...newMovies];
    this.localSeries = [...this.localSeries, ...newSeries];

    await this.saveToServer();
    this.renderLocalMedia();

    this.showStatus(
      `Import complete. Added ${newMovies.length} movies and ${newSeries.length} series to your library.`,
      "success"
    );
  }

  categorizeFiles(files) {
    const moviesToProcess = new Map();
    const seriesToProcess = new Map();

    for (const file of files) {
      const filePath = file.filePath;
      const pathParts = filePath.split("/").filter(Boolean);
      if (pathParts.length < 2) continue;

      // Find the media type folder
      while (pathParts.length > 2) {
        if (
          pathParts[0].toLowerCase() === "movies" ||
          pathParts[0].toLowerCase() === "series"
        ) {
          break;
        } else {
          pathParts.shift();
        }
      }

      const typeFolder = pathParts[0].toLowerCase();
      const titleFolder = pathParts[1];

      let collection;
      if (typeFolder === "movies") {
        collection = moviesToProcess;
      } else if (
        typeFolder === "series" ||
        typeFolder === "tv" ||
        typeFolder === "tv shows"
      ) {
        collection = seriesToProcess;
      } else {
        continue;
      }

      if (!collection.has(titleFolder)) {
        collection.set(titleFolder, []);
      }
      collection.get(titleFolder).push(file);
    }

    return { moviesToProcess, seriesToProcess };
  }

  async processMovie(title, files) {
    try {
      const mediaInfo = await this.searchAndFetchFirstResult(title, "movie");
      if (!mediaInfo) return null;

      const videoFiles = files.filter((f) => f.type.startsWith("video/"));
      if (videoFiles.length === 0) return null;

      const largestVideo = videoFiles.reduce((largest, current) =>
        current.fileSize > largest.fileSize ? current : largest,
      );
      this.localFileDatabase[`movie-${mediaInfo.id}`] = largestVideo.filePath;
      return mediaInfo;
    } catch (error) {
      console.error(`Failed to process movie "${title}":`, error);
      return null;
    }
  }

  async processSeries(title, files) {
    try {
      const mediaInfo = await this.searchAndFetchFirstResult(title, "tv");
      if (!mediaInfo) return null;

      const episodeRegex = /S(\d{1,2})E(\d{1,3})/i;
      this.localFileDatabase[`tv-${mediaInfo.id}`] = {};

      for (const file of files) {
        const match = file.fileName.match(episodeRegex);
        if (match) {
          const seasonNum = parseInt(match[1], 10);
          const episodeNum = parseInt(match[2], 10);
          this.localFileDatabase[`tv-${mediaInfo.id}`][
            `${seasonNum}-${episodeNum}`
          ] = file.filePath;
        }
      }
      return mediaInfo;
    } catch (error) {
      console.error(`Failed to process series "${title}":`, error);
      return null;
    }
  }

  async searchAndFetchFirstResult(query, type) {
    try {
      const searchResults = await this.tmdbApi.fetchFromBackend(`search/${type}`, { query });
      if (searchResults.results && searchResults.results.length > 0) {
        return searchResults.results[0];
      }
      console.warn(`No TMDB results found for query: "${query}"`);
      return null;
    } catch (error) {
      console.error(`Failed to fetch details for "${query}":`, error);
      return null;
    }
  }

  async saveToServer() {
    const storageData = {
      movies: this.localMovies,
      series: this.localSeries,
      fileDatabase: this.localFileDatabase,
    };

    await fetch("/api/add-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(storageData),
    });
  }

  async loadFromServer() {
    try {
      const response = await fetch(`/api/get-media`);
      if (!response.ok) {
        console.warn("Could not fetch local media data. Starting with a fresh library.");
        return;
      }
      
      const data = await response.json();
      console.log("Fetched local media data:", data);

      if (data.movies) this.localMovies = data.movies;
      if (data.series) this.localSeries = data.series;
      if (data.fileDatabase) this.localFileDatabase = data.fileDatabase;

      this.renderLocalMedia();

      if (this.localMovies.length + this.localSeries.length > 0) {
        this.showStatus(
          `Library reloaded. Found ${this.localMovies.length} movies and ${this.localSeries.length} series.`,
          "success"
        );
      }
    } catch (error) {
      console.error("Error during startup data fetch:", error);
    }
  }

  renderLocalMedia() {
    const activeTab = this.libraryTabs.querySelector(".active");
    if (!activeTab) return;

    const filter = activeTab.dataset.filter;
    let mediaToRender = [];

    if (filter === "all") {
      mediaToRender = [...this.localMovies, ...this.localSeries];
    } else if (filter === "movie") {
      mediaToRender = this.localMovies;
    } else if (filter === "tv") {
      mediaToRender = this.localSeries;
    }

    const sortBy = this.localLibrarySortBy.value;
    const sortedMedia = this.sortLocalMedia(mediaToRender, sortBy);

    if (sortedMedia.length > 0) {
      this.localMediaGrid.innerHTML = sortedMedia
        .map(item => this.mediaCardRenderer ? this.mediaCardRenderer.createMediaCard(item) : '')
        .join("");
    } else {
      this.localMediaGrid.innerHTML = `<p class="col-span-full text-[color:var(--text-secondary)]">No local media of this type. Use the import button to add some.</p>`;
    }
    lucide.createIcons();
  }

  sortLocalMedia(mediaArray, sortBy) {
    return [...mediaArray].sort((a, b) => {
      switch (sortBy) {
        case "release_date.desc":
        case "first_air_date.desc":
          const dateA = new Date(a.release_date || a.first_air_date);
          const dateB = new Date(b.release_date || b.first_air_date);
          return dateB - dateA;
        case "vote_average.desc":
          return b.vote_average - a.vote_average;
        case "title.asc":
          const titleA = a.title || a.name || "";
          const titleB = b.title || b.name || "";
          return titleA.localeCompare(titleB);
        case "popularity.desc":
        default:
          return b.popularity - a.popularity;
      }
    });
  }

  showStatus(message, type = "info") {
    const statusClasses = {
      loading: "p-4 bg-[color:var(--bg-tertiary)] rounded-lg",
      success: "p-4 bg-green-900/50 text-green-300 rounded-lg",
      error: "p-4 bg-red-900/50 text-red-300 rounded-lg",
      info: "p-4 bg-blue-900/50 text-blue-300 rounded-lg"
    };

    const iconMap = {
      loading: '<div class="loader"></div>',
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };

    this.localStatus.innerHTML = `
      <div class="${statusClasses[type]}">
        <div class="flex items-center gap-4">
          ${iconMap[type]}
          <p>${message}</p>
        </div>
      </div>
    `;

    if (type !== "loading") {
      setTimeout(() => {
        this.localStatus.innerHTML = "";
      }, 6000);
    }
  }

  // Getters for external access
  getLocalMovies() { return this.localMovies; }
  getLocalSeries() { return this.localSeries; }
  getLocalFileDatabase() { return this.localFileDatabase; }

  // Update methods for external modifications
  updateLocalData(movies, series, fileDatabase) {
    if (movies) this.localMovies = [...movies];
    if (series) this.localSeries = [...series];
    if (fileDatabase) this.localFileDatabase = { ...fileDatabase };
  }
}

