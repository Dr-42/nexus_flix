/**
 * TMDB API integration with rate limiting and error handling
 * This is kept for backward compatibility but no longer used in the application
 */
export class TMDBApi {
  constructor(baseUrl = "https://api.themoviedb.org/3") {
    this.apiKey = "YOUR_TMDB_API_KEY_HERE";
    this.baseUrl = baseUrl;
    this.imageBaseUrl = "https://image.tmdb.org/t/p";
    this.apiQueue = [];
    this.isFetching = false;
    this.fetchDelay = 2; // ms between calls
  }

  async processApiQueue() {
    if (this.apiQueue.length === 0 || this.isFetching) return;
    this.isFetching = true;

    const { endpoint, params, resolve, reject } = this.apiQueue.shift();

    try {
      if (!this.apiKey || this.apiKey === "YOUR_TMDB_API_KEY_HERE") {
        throw new Error(
          "TMDB API key is missing. Please add it to the script.",
        );
      }
      const url = new URL(`${this.baseUrl}/${endpoint}`);
      url.searchParams.append("api_key", this.apiKey);
      for (const key in params) {
        url.searchParams.append(key, params[key]);
      }
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          `TMDB API Error (${response.status}): ${response.statusText}`,
        );
      const data = await response.json();
      resolve(data);
    } catch (error) {
      console.error(`TMDB API Error for endpoint ${endpoint}:`, error);
      reject(error);
    }

    setTimeout(() => {
      this.isFetching = false;
      this.processApiQueue();
    }, this.fetchDelay);
  }

  fetchFromTMDB(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
      this.apiQueue.push({ endpoint, params, resolve, reject });
      this.processApiQueue();
    });
  }

  // Convenience methods for common API calls
  async searchMovie(query) {
    return this.fetchFromTMDB("search/movie", { query });
  }

  async searchTV(query) {
    return this.fetchFromTMDB("search/tv", { query });
  }

  async getMovieDetails(id, appendToResponse = "") {
    const params = appendToResponse ? { append_to_response: appendToResponse } : {};
    return this.fetchFromTMDB(`movie/${id}`, params);
  }

  async getTVDetails(id, appendToResponse = "") {
    const params = appendToResponse ? { append_to_response: appendToResponse } : {};
    return this.fetchFromTMDB(`tv/${id}`, params);
  }

  async getTVSeason(tvId, seasonNumber) {
    return this.fetchFromTMDB(`tv/${tvId}/season/${seasonNumber}`);
  }

  async getMovieGenres() {
    return this.fetchFromTMDB("genre/movie/list");
  }

  async getTVGenres() {
    return this.fetchFromTMDB("genre/tv/list");
  }

  async getTrending(mediaType = "all", timeWindow = "day") {
    return this.fetchFromTMDB(`trending/${mediaType}/${timeWindow}`);
  }

  async discover(mediaType, params = {}) {
    return this.fetchFromTMDB(`discover/${mediaType}`, params);
  }

  getImageUrl(path, size = "w500") {
    return path ? `${this.imageBaseUrl}/${size}${path}` : null;
  }

  getPlaceholderImage(width = 400, height = 600, text = "No+Image") {
    return `https://placehold.co/${width}x${height}/1f2937/ffffff?text=${text}`;
  }
}

