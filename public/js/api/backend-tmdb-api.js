/**
 * Backend TMDB API integration
 * This module communicates with our backend which handles TMDB API requests
 */
export class BackendTMDBApi {
	constructor() {
		this.imageBaseUrl = "https://image.tmdb.org/t/p";
	}

	async fetchFromBackend(endpoint, params = {}) {
		const url = new URL(`/api/tmdb/${endpoint}`, window.location.origin);
		for (const key in params) {
			url.searchParams.append(key, params[key]);
		}

		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Backend API Error (${response.status}): ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error(`Backend API Error for endpoint ${endpoint}:`, error);
			throw error;
		}
	}

	// Search methods
	async searchMovie(query) {
		return this.fetchFromBackend("search", { query, type: "movie" });
	}

	async searchTV(query) {
		return this.fetchFromBackend("search", { query, type: "tv" });
	}

	// Details methods
	async getMovieDetails(id, appendToResponse = "") {
		const params = appendToResponse ? { append_to_response: appendToResponse } : {};
		return this.fetchFromBackend(`movie/${id}`, params);
	}

	async getTVDetails(id, appendToResponse = "") {
		const params = appendToResponse ? { append_to_response: appendToResponse } : {};
		return this.fetchFromBackend(`tv/${id}`, params);
	}

	// Season details
	async getTVSeason(tvId, seasonNumber) {
		return this.fetchFromBackend(`tv/${tvId}/season/${seasonNumber}`);
	}

	// Genre methods
	async getMovieGenres() {
		return this.fetchFromBackend("genres/movie");
	}

	async getTVGenres() {
		return this.fetchFromBackend("genres/tv");
	}

	// Trending methods
	async getTrending(mediaType = "all", timeWindow = "day") {
		return this.fetchFromBackend(`trending/${mediaType}/${timeWindow}`);
	}

	// Discover methods
	async discover(mediaType, params = {}) {
		return this.fetchFromBackend(`discover/${mediaType}`, params);
	}

	// Image URL methods
	getImageUrl(path, size = "w500") {
		if (!path) {
            return this.getPlaceholderImage();
        }
        return `/api/tmdb/image/${size}${path}`;
	}

	getPlaceholderImage(width = 400, height = 600, text = "No+Image") {
		return `/api/placeholder?width=${width}&height=${height}&text=${text}`;
	}
}
