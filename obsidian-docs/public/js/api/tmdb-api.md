# `tmdb-api.js`

**The Movie Database (TMDB) API Integration**

This module provides a robust interface to the TMDB API, including rate limiting, error handling, and convenience methods for common API calls.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#TMDBApi|TMDBApi]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#fetchApiKeys|fetchApiKeys]]
  - [[#processApiQueue|processApiQueue]]
  - [[#fetchFromTMDB|fetchFromTMDB]]
  - [[#Convenience Methods|Convenience Methods]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- None

---

## Class

### `TMDBApi`

A class that encapsulates the logic for interacting with the TMDB API.

---

## Methods

### `constructor`

Initializes the `TMDBApi` class.

```javascript
constructor(baseUrl = "https://api.themoviedb.org/3") {
    this.apiKey = null;
    this.baseUrl = baseUrl;
    this.imageBaseUrl = "https://image.tmdb.org/t/p";
    this.apiQueue = [];
    this.isFetching = false;
    this.fetchDelay = 2; // ms between calls
    this.fetchApiKeys();
}
```

- **Behavior**:
  - Sets the base URL for the TMDB API.
  - Initializes an API queue to handle rate limiting.
  - Sets a delay between API calls to avoid exceeding rate limits.
  - Calls `fetchApiKeys` to asynchronously retrieve the API key.

### `fetchApiKeys`

Fetches the TMDB API key from the backend.

```javascript
async fetchApiKeys() {
    try {
        const response = await fetch("/api/keys");
        const keys = await response.json();
        this.apiKey = keys.tmdb_api_key;
    } catch (error) {
        console.error("Error fetching API keys:", error);
    }
}
```

- **Behavior**:
  - Makes a `fetch` request to the `/api/keys` endpoint on the backend.
  - Parses the JSON response and sets the `apiKey` property.

### `processApiQueue`

Processes the API queue, making one request at a time with a delay.

```javascript
async processApiQueue() {
    // ... implementation ...
}
```

- **Behavior**:
  - If the queue is empty or a request is already in progress, it does nothing.
  - It takes the next request from the queue and makes the API call.
  - It handles errors and resolves or rejects the promise associated with the request.
  - It uses `setTimeout` to create a delay before processing the next request.

### `fetchFromTMDB`

Adds a request to the API queue.

```javascript
fetchFromTMDB(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        this.apiQueue.push({ endpoint, params, resolve, reject });
        this.processApiQueue();
    });
}
```

- **Input**:
  - `endpoint`: The API endpoint to call (e.g., `"search/movie"`).
  - `params`: An object of query parameters.
- **Behavior**:
  - Creates a `Promise` for the request.
  - Pushes the request details to the `apiQueue`.
  - Calls `processApiQueue` to start processing the queue.

### Convenience Methods

The class provides several convenience methods for common API calls, such as:

- `searchMovie(query)`
- `searchTV(query)`
- `getMovieDetails(id)`
- `getTVDetails(id)`
- `getTrending()`
- `discover(mediaType, params)`

These methods simply call `fetchFromTMDB` with the appropriate endpoint and parameters.

---

## Related Documentation
- [[gemini-api]]
- [[Frontend Overview]]
