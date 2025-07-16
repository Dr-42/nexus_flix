# `page-manager.js`

**Manages the Content of Each Page**

This module is responsible for loading and managing the content of the different pages in the application, such as the dashboard, movies page, and series page.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#PageManager|PageManager]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#initialize|initialize]]
  - [[#loadAllContent|loadAllContent]]
  - [[#loadDashboard|loadDashboard]]
  - [[#loadMoviesPage|loadMoviesPage]]
  - [[#loadLocalMovies|loadLocalMovies]]
  - [[#loadSeriesPage|loadSeriesPage]]
  - [[#loadLocalSeries|loadLocalSeries]]
  - [[#fetchAndPopulateGenres|fetchAndPopulateGenres]]
  - [[#setupFilterListeners|setupFilterListeners]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `tmdbApi`: To fetch data from the TMDB API.
- `mediaCardRenderer`: To render the media cards.
- `localLibraryManager`: To access the local media library.

---

## Class

### `PageManager`

A class that encapsulates all the logic for managing page content.

---

## Methods

### `constructor`

Initializes the `PageManager` class.

### `initialize`

Initializes the page manager by fetching genres and loading all content.

### `loadAllContent`

Loads the content for all pages.

### `loadDashboard`

Loads the content for the dashboard, including featured, popular, and anime sections.

### `loadMoviesPage`

Loads the content for the movies page, taking into account the selected filters.

### `loadLocalMovies`

Loads the movies from the local library that match the selected filters.

### `loadSeriesPage`

Loads the content for the series page, taking into account the selected filters.

### `loadLocalSeries`

Loads the series from the local library that match the selected filters.

### `fetchAndPopulateGenres`

Fetches the movie and TV show genres from the TMDB API and populates the genre filter dropdowns.

### `setupFilterListeners`

Sets up event listeners for the filter controls on the movies and series pages.

---

## Related Documentation
- [[tmdb-api]]
- [[media-card-renderer]]
- [[local-library-manager]]
- [[Frontend Overview]]
