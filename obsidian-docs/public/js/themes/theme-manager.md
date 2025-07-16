# `theme-manager.js`

**Global and Video Player Theme Management**

This module manages the themes for both the global application and the video player. It allows for dynamic theme switching and persists the user's theme preferences in local storage.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Constants|Constants]]
  - [[#globalThemes|globalThemes]]
  - [[#videoPlayerThemes|videoPlayerThemes]]
- [[#Class|Class]]
  - [[#ThemeManager|ThemeManager]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#applyGlobalTheme|applyGlobalTheme]]
  - [[#applyVideoTheme|applyVideoTheme]]
  - [[#getCurrentGlobalTheme|getCurrentGlobalTheme]]
  - [[#getCurrentVideoTheme|getCurrentVideoTheme]]
  - [[#saveGlobalTheme|saveGlobalTheme]]
  - [[#saveVideoTheme|saveVideoTheme]]
  - [[#loadSavedThemes|loadSavedThemes]]
  - [[#getThemesByCategory|getThemesByCategory]]
  - [[#getCategories|getCategories]]
- [[#Global Instance|Global Instance]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- None

---

## Constants

### `globalThemes`

An array of objects representing the available global themes.

### `videoPlayerThemes`

An array of objects representing the available video player themes.

---

## Class

### `ThemeManager`

A class that encapsulates all theme management logic.

---

## Methods

### `constructor`

Initializes the `ThemeManager` class.

### `applyGlobalTheme`

Applies a global theme to the application.

### `applyVideoTheme`

Applies a theme to the video player.

### `getCurrentGlobalTheme`

Returns the currently active global theme.

### `getCurrentVideoTheme`

Returns the currently active video player theme.

### `saveGlobalTheme`

Saves the selected global theme to local storage.

### `saveVideoTheme`

Saves the selected video player theme to local storage.

### `loadSavedThemes`

Loads the saved themes from local storage.

### `getThemesByCategory`

Returns an array of themes for a given category.

### `getCategories`

Returns an array of all available theme categories.

---

## Global Instance

A global instance of the `ThemeManager` is created and exported, making it easy to access from other modules.

```javascript
export const themeManager = new ThemeManager();
```

---

## Related Documentation
- [[settings-modal]]
- [[Frontend Overview]]
