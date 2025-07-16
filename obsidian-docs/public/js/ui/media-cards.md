# `media-cards.js`

**UI Components for Media Cards**

This module is responsible for creating the HTML for the media cards that are displayed throughout the application.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#MediaCardRenderer|MediaCardRenderer]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#createMediaCard|createMediaCard]]
  - [[#createFeaturedCard|createFeaturedCard]]
  - [[#populateGrid|populateGrid]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `tmdbApi`: To get the image URLs for the media cards.
- `localFileDatabase`: To check if a media item is in the local library.

---

## Class

### `MediaCardRenderer`

A class that encapsulates all the logic for creating media cards.

---

## Methods

### `constructor`

Initializes the `MediaCardRenderer` class.

### `createMediaCard`

Creates the HTML for a standard media card.

### `createFeaturedCard`

Creates the HTML for a featured media card, which is larger and has more information.

### `populateGrid`

Populates a grid with media cards by fetching data from the TMDB API and using the specified card creator function.

---

## Related Documentation
- [[tmdb-api]]
- [[local-library-manager]]
- [[Frontend Overview]]
