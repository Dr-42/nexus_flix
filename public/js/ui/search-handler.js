/**
 * Search functionality for both TMDB and local content
 */
export class SearchHandler {
  constructor(tmdbApi, mediaCardRenderer, localMovies, localSeries) {
    this.tmdbApi = tmdbApi;
    this.mediaCardRenderer = mediaCardRenderer;
    this.localMovies = localMovies;
    this.localSeries = localSeries;
    this.searchTimeout = null;
    
    this.initializeSearchInput();
  }

  initializeSearchInput() {
    const searchInput = document.getElementById("search-input");
    const searchResultsContainer = document.getElementById("search-results");
    const pageContentWrapper = document.getElementById("page-content-wrapper");

    searchInput.addEventListener("keyup", (e) => {
      clearTimeout(this.searchTimeout);
      const query = e.target.value.trim();
      
      if (query.length > 2) {
        searchResultsContainer.innerHTML = `<div class="flex justify-center items-center h-40"><div class="loader"></div></div>`;
        pageContentWrapper.classList.add("hidden");
        searchResultsContainer.classList.remove("hidden");
        this.searchTimeout = setTimeout(() => this.performSearch(query), 500);
      } else {
        searchResultsContainer.innerHTML = "";
        pageContentWrapper.classList.remove("hidden");
        searchResultsContainer.classList.add("hidden");
      }
    });
  }

  async performSearch(query) {
    const searchResultsContainer = document.getElementById("search-results");
    
    try {
      // Search TMDB
      const tmdbMoviesPromise = this.tmdbApi.searchMovie(query);
      const tmdbSeriesPromise = this.tmdbApi.searchTV(query);

      // Search Local Library
      const localMovieResults = this.localMovies.filter((m) =>
        m.title.toLowerCase().includes(query.toLowerCase()),
      );
      const localSeriesResults = this.localSeries.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase()),
      );

      const [tmdbMovies, tmdbSeries] = await Promise.all([
        tmdbMoviesPromise,
        tmdbSeriesPromise,
      ]);
      const tmdbResults = [...tmdbMovies.results, ...tmdbSeries.results].sort(
        (a, b) => b.popularity - a.popularity,
      );

      let resultsHTML = "";

      // Display local results first
      if (localMovieResults.length > 0 || localSeriesResults.length > 0) {
        resultsHTML += `<h3 class="text-2xl font-bold mb-4 pl-2">In Your Library</h3>`;
        resultsHTML +=
          '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">';
        resultsHTML += [...localMovieResults, ...localSeriesResults]
          .map(item => this.mediaCardRenderer.createMediaCard(item))
          .join("");
        resultsHTML += "</div>";
      }

      // Display TMDB results
      if (tmdbResults.length > 0) {
        resultsHTML += `<h3 class="text-2xl font-bold mt-8 mb-4 pl-2">TMDB Results</h3>`;
        resultsHTML +=
          '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">';
        resultsHTML += tmdbResults.slice(0, 18)
          .map(item => this.mediaCardRenderer.createMediaCard(item))
          .join("");
        resultsHTML += "</div>";
      }

      if (resultsHTML === "") {
        searchResultsContainer.innerHTML = `<div class="text-center p-8 text-[color:var(--text-secondary)]">No results found for "${query}".</div>`;
      } else {
        searchResultsContainer.innerHTML = resultsHTML;
      }
      lucide.createIcons();
    } catch (error) {
      searchResultsContainer.innerHTML = `<div class="text-center p-8 text-red-400">Error during search: ${error.message}</div>`;
    }
  }

  updateLocalData(localMovies, localSeries) {
    this.localMovies = localMovies;
    this.localSeries = localSeries;
  }
}

