# Project Overview

**NexusFlix** is a sophisticated media streaming application that combines local media library management with external content discovery and real-time video transcoding capabilities.

## 🎯 Core Purpose

NexusFlix serves as a **personal media server** that:
- Streams local video files with on-the-fly transcoding
- Integrates with TMDB for rich metadata
- Provides AI-powered content recommendations via Gemini
- Offers a modern, responsive web interface

## ✨ Key Features

### 🎬 Media Streaming
- **Real-time transcoding** using FFmpeg with NVIDIA GPU acceleration
- **Multi-format support** for various video/audio codecs
- **Subtitle support** with WebVTT parsing
- **Adaptive streaming** with configurable quality

### 📚 Library Management
- **Automatic media discovery** from configured directories
- **Metadata enrichment** via TMDB API integration
- **Local database** for fast access and offline capability
- **Smart categorization** (Movies, TV Series, Anime)

### 🔍 Content Discovery
- **TMDB integration** for trending content and metadata
- **Advanced search** across local and external sources
- **Genre filtering** and sorting options
- **AI-powered recommendations** using Gemini API

### 🎨 User Experience
- **Modern responsive design** with Tailwind CSS
- **Multiple themes** including glass morphism effects
- **Intuitive navigation** with sidebar and page management
- **Modal-based interactions** for detailed views

## 🏗️ Architecture Highlights

### Backend (Rust + Axum)
- **High-performance** async web server
- **Modular design** with separate concerns
- **FFmpeg integration** for video processing
- **RESTful API** design

### Frontend (Modern JavaScript)
- **ES6 modules** for clean code organization
- **Component-based architecture** for reusability
- **Event-driven communication** between modules
- **Progressive enhancement** approach

## 🔧 Technical Requirements

### System Dependencies
- **Rust** (2021 edition)
- **FFmpeg** with NVIDIA codec support (NVENC/NVDEC)
- **NVIDIA GPU** with proper drivers
- **Modern web browser** with ES6 support

### API Keys Required
- **TMDB API Key** for movie/TV metadata
- **Gemini API Key** for AI-powered features

## 📊 Performance Characteristics

- **GPU-accelerated transcoding** for optimal performance
- **Streaming architecture** for minimal memory usage
- **Async processing** for concurrent requests
- **Efficient caching** of metadata and thumbnails

## 🎯 Target Use Cases

1. **Home Media Server** - Stream personal video collection
2. **Content Discovery** - Find new movies and shows
3. **Media Organization** - Manage and categorize content
4. **Multi-device Access** - Web-based interface works everywhere

---

## Related Documentation
- [[System Architecture]] - Detailed technical architecture
- [[Technology Stack]] - Complete technology overview
- [[Backend Overview]] - Server-side implementation
- [[Frontend Overview]] - Client-side architecture