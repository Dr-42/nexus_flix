# `video-response-parser.js`

**Binary Video Response Parser**

This module provides a parser for the binary video data received from the backend. It is responsible for extracting video, audio, and subtitle data from the raw `ArrayBuffer`.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#VideoResponseParser|VideoResponseParser]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#readUint32|readUint32]]
  - [[#readBigUint64|readBigUint64]]
  - [[#readBytes|readBytes]]
  - [[#parse|parse]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- None

---

## Class

### `VideoResponseParser`

A class that parses the binary video response.

---

## Methods

### `constructor`

Initializes the `VideoResponseParser` class with an `ArrayBuffer`.

### `readUint32`

Helper method to read a 32-bit unsigned integer from the `ArrayBuffer`.

### `readBigUint64`

Helper method to read a 64-bit unsigned integer from the `ArrayBuffer`.

### `readBytes`

Helper method to read a specified number of bytes from the `ArrayBuffer`.

### `parse`

Parses the binary data and extracts the video, audio, and subtitle tracks.

---

## Related Documentation
- [[video-player]]
- [[Frontend Overview]]
