# `search-handler.js`

**Search Functionality**

This module handles the search functionality for both TMDB and the local library.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#SearchHandler|SearchHandler]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#initializeSearchInput|initializeSearchInput]]
  - [[#performSearch|performSearch]]
  - [[#updateLocalData|updateLocalData]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `tmdbApi`: To search for media on TMDB.
- `mediaCardRenderer`: To render the search results.
- `localMovies`, `localSeries`: To search the local library.

---

## Class

### `SearchHandler`

A class that encapsulates all the logic for handling searches.

---

## Methods

### `constructor`

Initializes the `SearchHandler` class.

### `initializeSearchInput`

Sets up the event listener for the search input.

### `performSearch`

Performs a search on both TMDB and the local library.

### `updateLocalData`

Updates the local library data used for searching.

---

## Related Documentation
- [[tmdb-api]]
- [[media-card-renderer]]
- [[Frontend Overview]]
