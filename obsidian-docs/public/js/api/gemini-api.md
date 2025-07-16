# `gemini-api.js`

**Google Gemini AI Integration**

This module provides an interface to the Google Gemini AI for generating content, specifically for creating movie and TV show synopses.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#GeminiApi|GeminiApi]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#fetchApiKeys|fetchApiKeys]]
  - [[#callGeminiAPI|callGeminiAPI]]
  - [[#generateSynopsis|generateSynopsis]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- None

---

## Class

### `GeminiApi`

A class that encapsulates the logic for interacting with the Gemini AI API.

---

## Methods

### `constructor`

Initializes the `GeminiApi` class.

```javascript
constructor() {
    this.apiKey = null;
    this.apiUrl = null;
    this.fetchApiKeys();
}
```

- **Behavior**:
  - Initializes `apiKey` and `apiUrl` to `null`.
  - Calls `fetchApiKeys` to asynchronously retrieve the API key.

### `fetchApiKeys`

Fetches the Gemini API key from the backend.

```javascript
async fetchApiKeys() {
    try {
        const response = await fetch("/api/keys");
        const keys = await response.json();
        this.apiKey = keys.gemini_api_key;
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;
    } catch (error) {
        console.error("Error fetching API keys:", error);
    }
}
```

- **Behavior**:
  - Makes a `fetch` request to the `/api/keys` endpoint on the backend.
  - Parses the JSON response and sets the `apiKey` and `apiUrl` properties.

### `callGeminiAPI`

Calls the Gemini AI API with a given prompt.

```javascript
async callGeminiAPI(prompt) {
    // ... implementation ...
}
```

- **Input**: `prompt` - The text prompt to send to the AI.
- **Behavior**:
  - Constructs a payload with the prompt.
  - Makes a `POST` request to the Gemini API.
  - Handles errors, including blocked requests.
  - Returns the generated text from the AI.

### `generateSynopsis`

Generates a synopsis for a given title.

```javascript
async generateSynopsis(title) {
    const prompt = `Provide a compelling, one-paragraph synopsis for the following title: "${title}".`;
    return this.callGeminiAPI(prompt);
}
```

- **Input**: `title` - The title of the movie or TV show.
- **Behavior**:
  - Creates a specific prompt for generating a synopsis.
  - Calls `callGeminiAPI` with the prompt.

---

## Related Documentation
- [[tmdb-api]]
- [[Frontend Overview]]
