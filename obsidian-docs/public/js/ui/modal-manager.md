# `modal-manager.js`

**Modal Management for Media Details and Video Player**

This module is responsible for managing the modals that display media details and the video player.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#ModalManager|ModalManager]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#initializeEventListeners|initializeEventListeners]]
  - [[#showModal|showModal]]
  - [[#hideModal|hideModal]]
  - [[#showDetails|showDetails]]
  - [[#generateSeasonsHTML|generateSeasonsHTML]]
  - [[#generateModalHTML|generateModalHTML]]
  - [[#createMediaCard|createMediaCard]]
  - [[#showVideoPlayer|showVideoPlayer]]
  - [[#hideVideoPlayer|hideVideoPlayer]]
  - [[#handleAISynopsis|handleAISynopsis]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `tmdbApi`: To fetch media details from the TMDB API.
- `geminiApi`: To generate AI synopses.
- `localFileDatabase`: To check if a media item is in the local library.
- `VideoPlayer`: To play videos.

---

## Class

### `ModalManager`

A class that encapsulates all the logic for managing modals.

---

## Methods

### `constructor`

Initializes the `ModalManager` class.

### `initializeEventListeners`

Sets up event listeners for the modals.

### `showModal`

Shows the details modal.

### `hideModal`

Hides the details modal.

### `showDetails`

Shows the details for a media item in the modal.

### `generateSeasonsHTML`

Generates the HTML for the seasons of a TV show.

### `generateModalHTML`

Generates the HTML for the content of the details modal.

### `createMediaCard`

Creates the HTML for a media card used in the recommendations section.

### `showVideoPlayer`

Shows the video player modal and initializes the video player.

### `hideVideoPlayer`

Hides the video player modal and disposes of the video player.

### `handleAISynopsis`

Handles the generation of an AI synopsis for a media item.

---

## Related Documentation
- [[tmdb-api]]
- [[gemini-api]]
- [[local-library-manager]]
- [[video-player]]
- [[Frontend Overview]]
