/**
 * Page management for movies, series, and dashboard content
 */
export class PageManager {
  constructor(tmdbApi, mediaCardRenderer, localLibraryManager) {
    this.tmdbApi = tmdbApi;
    this.mediaCardRenderer = mediaCardRenderer;
    this.localLibraryManager = localLibraryManager;
    this.movieGenres = [];
    this.tvGenres = [];
    
    this.setupFilterListeners();
  }

  async initialize() {
    await this.fetchAndPopulateGenres();
    await this.loadAllContent();
  }

  async loadAllContent() {
    await this.loadDashboard();
    await this.loadMoviesPage();
    await this.loadSeriesPage();
  }

  async loadDashboard() {
    await this.mediaCardRenderer.populateGrid(
      "trending/all/day", 
      "featured-grid", 
      this.mediaCardRenderer.createFeaturedCard
    );
    await this.mediaCardRenderer.populateGrid(
      "trending/all/week", 
      "popular-grid", 
      this.mediaCardRenderer.createMediaCard
    );
    await this.mediaCardRenderer.populateGrid(
      "discover/tv", 
      "anime-grid", 
      this.mediaCardRenderer.createMediaCard, 
      {
        with_genres: "16",
        with_keywords: "210024", // Specific keyword for anime
        sort_by: "popularity.desc",
      }
    );
  }

  async loadMoviesPage() {
    const grid = document.getElementById("movies-grid");
    grid.innerHTML = `<div class="grid-loader"><div class="loader"></div></div>`;

    const inLibraryFilterBtn = document.getElementById("movies-in-library-filter");
    const inLibraryOnly = inLibraryFilterBtn.dataset.active === "true";
    const genre = document.getElementById("movies-genre-filter").value;
    const sortBy = document.getElementById("movies-sort-by").value;

    if (inLibraryOnly) {
      this.loadLocalMovies(genre, sortBy);
      return;
    }

    const params = {
      language: "en-US",
      page: 1,
      sort_by: sortBy,
      "vote_count.gte": sortBy === "vote_average.desc" ? 300 : 10,
    };
    if (genre) {
      params.with_genres = genre;
    }

    await this.mediaCardRenderer.populateGrid(
      "discover/movie",
      "movies-grid",
      this.mediaCardRenderer.createMediaCard,
      params,
    );
  }

  loadLocalMovies(genre, sortBy) {
    const grid = document.getElementById("movies-grid");
    let movies = this.localLibraryManager.getLocalMovies();
    
    if (genre) {
      movies = movies.filter((m) => m.genre_ids.includes(parseInt(genre)));
    }
    
    const sortedMovies = this.localLibraryManager.sortLocalMedia(movies, sortBy);
    grid.innerHTML = sortedMovies.length > 0
      ? sortedMovies.map(movie => this.mediaCardRenderer.createMediaCard(movie)).join("")
      : `<p class="col-span-full text-[color:var(--text-secondary)]">No movies in your library match the criteria.</p>`;
    lucide.createIcons();
  }

  async loadSeriesPage() {
    const grid = document.getElementById("series-grid");
    grid.innerHTML = `<div class="grid-loader"><div class="loader"></div></div>`;

    const inLibraryFilterBtn = document.getElementById("series-in-library-filter");
    const inLibraryOnly = inLibraryFilterBtn.dataset.active === "true";
    const genre = document.getElementById("series-genre-filter").value;
    const sortBy = document.getElementById("series-sort-by").value;

    if (inLibraryOnly) {
      this.loadLocalSeries(genre, sortBy);
      return;
    }

    const params = {
      language: "en-US",
      page: 1,
      sort_by: sortBy,
      "vote_count.gte": sortBy === "vote_average.desc" ? 150 : 10,
    };
    if (genre) {
      params.with_genres = genre;
    }

    await this.mediaCardRenderer.populateGrid(
      "discover/tv", 
      "series-grid", 
      this.mediaCardRenderer.createMediaCard, 
      params
    );
  }

  loadLocalSeries(genre, sortBy) {
    const grid = document.getElementById("series-grid");
    let series = this.localLibraryManager.getLocalSeries();
    
    if (genre) {
      series = series.filter((s) => s.genre_ids.includes(parseInt(genre)));
    }
    
    const sortedSeries = this.localLibraryManager.sortLocalMedia(series, sortBy);
    grid.innerHTML = sortedSeries.length > 0
      ? sortedSeries.map(show => this.mediaCardRenderer.createMediaCard(show)).join("")
      : `<p class="col-span-full text-[color:var(--text-secondary)]">No series in your library match the criteria.</p>`;
    lucide.createIcons();
  }

  async fetchAndPopulateGenres() {
    try {
      const [movieGenresData, tvGenresData] = await Promise.all([
        this.tmdbApi.fetchFromBackend("genres/movie"),
        this.tmdbApi.fetchFromBackend("genres/tv"),
      ]);
      this.movieGenres = movieGenresData.genres;
      this.tvGenres = tvGenresData.genres;

      const movieGenreSelect = document.getElementById("movies-genre-filter");
      const seriesGenreSelect = document.getElementById("series-genre-filter");

      this.movieGenres.forEach((genre) => {
        movieGenreSelect.innerHTML += `<option value="${genre.id}">${genre.name}</option>`;
      });
      this.tvGenres.forEach((genre) => {
        seriesGenreSelect.innerHTML += `<option value="${genre.id}">${genre.name}</option>`;
      });
    } catch (error) {
      console.error("Failed to fetch genres:", error);
    }
  }

  setupFilterListeners() {
    const movieControls = document.getElementById("movies-controls");
    const seriesControls = document.getElementById("series-controls");
    const moviesInLibraryBtn = document.getElementById("movies-in-library-filter");
    const seriesInLibraryBtn = document.getElementById("series-in-library-filter");

    movieControls?.addEventListener("change", (e) => {
      if (e.target.matches("select")) {
        this.loadMoviesPage();
      }
    });

    moviesInLibraryBtn?.addEventListener("click", () => {
      const isActive = moviesInLibraryBtn.dataset.active === "true";
      moviesInLibraryBtn.dataset.active = !isActive;
      this.loadMoviesPage();
    });

    seriesControls?.addEventListener("change", (e) => {
      if (e.target.matches("select")) {
        this.loadSeriesPage();
      }
    });

    seriesInLibraryBtn?.addEventListener("click", () => {
      const isActive = seriesInLibraryBtn.dataset.active === "true";
      seriesInLibraryBtn.dataset.active = !isActive;
      this.loadSeriesPage();
    });
  }
}

