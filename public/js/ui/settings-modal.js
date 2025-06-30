import { VideoPlayer } from '../video-player/video-player.js';
import { themeManager, videoPlayerThemes } from '../themes/theme-manager.js';

export class SettingsModal {
    constructor(player) {
        this.player = player;
        this.selectedTheme = null;
        this.modal = this.createModal();
        this.player.el().appendChild(this.modal);
        this.setupEventListeners();
        
        // Load saved theme preference
        this.loadThemePreference();
    }

    createModal() {
        const modal = document.createElement('div');
        modal.className = 'vjs-settings-modal';
        modal.innerHTML = `
            <div class="vjs-settings-modal-content">
                <div class="settings-header">
                    <h2>Video Player Themes</h2>
                    <button class="vjs-close-button">&times;</button>
                </div>
                
                <div class="settings-body">
                    <div class="live-preview-section">
                        <h3>Live Preview</h3>
                        <div class="live-preview-container">
                            <div id="live-preview-player" class="live-preview-player vjs-midnight-skin">
                                <div class="preview-video-area">
                                    <div class="preview-play-button">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z"/>
                                        </svg>
                                    </div>
                                </div>
                                <div class="preview-control-bar">
                                    <div class="preview-controls">
                                        <button class="preview-btn">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M8 5v14l11-7z"/>
                                            </svg>
                                        </button>
                                        <div class="preview-time">0:00</div>
                                        <div class="preview-progress-container">
                                            <div class="preview-progress-bg">
                                                <div class="preview-progress-bar" style="width: 35%"></div>
                                            </div>
                                        </div>
                                        <div class="preview-time">2:45</div>
                                        <button class="preview-btn">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                                            </svg>
                                        </button>
                                        <button class="preview-btn">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <circle cx="12" cy="12" r="3"/>
                                                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                                            </svg>
                                        </button>
                                        <button class="preview-btn">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <p class="preview-description">This preview shows how the selected theme will look on your video player</p>
                        </div>
                    </div>
                    
                    <div class="theme-selection-section">
                        <h3>Available Themes</h3>
                        <p class="vjs-modal-subtitle">Click on any theme to see it in the live preview above</p>
                        <div class="vjs-layout-grid">
                            ${videoPlayerThemes.map(layout => `
                                <div class="vjs-layout-item" data-class="${layout.class}">
                                    <div class="vjs-layout-preview ${layout.class}">
                                        <div class="vjs-preview-controls">
                                            <div class="vjs-preview-play-btn"></div>
                                            <div class="vjs-preview-progress">
                                                <div class="vjs-preview-progress-bar"></div>
                                            </div>
                                            <div class="vjs-preview-volume"></div>
                                        </div>
                                    </div>
                                    <div class="vjs-layout-info">
                                        <span class="vjs-layout-name">${layout.name}</span>
                                        <span class="vjs-layout-description">${layout.description}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="settings-footer">
                    <button class="apply-theme-btn">Apply Selected Theme</button>
                    <button class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        return modal;
    }

    setupEventListeners() {
        // Close button
        this.modal.querySelector('.vjs-close-button').addEventListener('click', () => this.hide());
        
        // Cancel button
        this.modal.querySelector('.cancel-btn').addEventListener('click', () => this.hide());
        
        // Apply button
        this.modal.querySelector('.apply-theme-btn').addEventListener('click', () => {
            if (this.selectedTheme) {
                this.applyLayout(this.selectedTheme);
                this.hide();
            }
        });
        
        // Theme selection items
        this.modal.querySelectorAll('.vjs-layout-item').forEach(item => {
            item.addEventListener('click', () => {
                const layoutClass = item.getAttribute('data-class');
                this.selectedTheme = layoutClass;
                this.updateActiveState(item);
                this.updateLivePreview(layoutClass);
            });
        });
    }

    updateActiveState(selectedItem) {
        // Remove active class from all items
        this.modal.querySelectorAll('.vjs-layout-item').forEach(item => {
            item.classList.remove('active');
        });
        // Add active class to selected item
        selectedItem.classList.add('active');
    }

    updateLivePreview(layoutClass) {
        const livePreview = this.modal.querySelector('#live-preview-player');
        if (livePreview) {
            // Remove all theme classes
            videoPlayerThemes.forEach(theme => {
                livePreview.classList.remove(theme.class);
            });
            // Add the selected theme class
            livePreview.classList.add(layoutClass);
            
            // Force a repaint to ensure the changes are visible
            livePreview.style.display = 'none';
            livePreview.offsetHeight; // Trigger reflow
            livePreview.style.display = '';
            
            console.log('Live preview updated to:', layoutClass);
        }
    }

    applyLayout(layoutClass, savePreference = true) {
        // Remove all theme classes from the actual player
        videoPlayerThemes.forEach(theme => {
            this.player.removeClass(theme.class);
        });
        
        // Add the selected theme class to the actual player
        this.player.addClass(layoutClass);
        
        // Also update the video element directly for immediate effect
        const videoElement = this.player.el();
        if (videoElement) {
            videoPlayerThemes.forEach(theme => {
                videoElement.classList.remove(theme.class);
            });
            videoElement.classList.add(layoutClass);
        }
        
        // Use theme manager to save the preference
        if (savePreference) {
            themeManager.saveVideoTheme(layoutClass);
        }
        
        console.log('Applied video player theme:', layoutClass);
    }

    saveThemePreference(layoutClass) {
        try {
            localStorage.setItem('videoPlayerTheme', layoutClass);
        } catch (error) {
            console.warn('Could not save theme preference:', error);
        }
    }

    loadThemePreference() {
        try {
            const savedTheme = localStorage.getItem('videoPlayerTheme');
            if (savedTheme && videoPlayerThemes.some(layout => layout.class === savedTheme)) {
                this.applyLayout(savedTheme, false); // Don't save when loading
                return savedTheme;
            }
        } catch (error) {
            console.warn('Could not load theme preference:', error);
        }
        return null;
    }

    show() {
        this.modal.style.display = 'block';
        this.highlightCurrentTheme();
        this.initializeLivePreview();
    }

    initializeLivePreview() {
        // Set the live preview to show the current theme
        const currentTheme = videoPlayerThemes.find(layout => 
            this.player.hasClass(layout.class)
        );
        
        if (currentTheme) {
            this.selectedTheme = currentTheme.class;
            this.updateLivePreview(currentTheme.class);
        } else {
            // Default to midnight theme
            this.selectedTheme = 'vjs-midnight-skin';
            this.updateLivePreview('vjs-midnight-skin');
        }
    }

    highlightCurrentTheme() {
        // Find the currently applied theme
        const currentTheme = videoPlayerThemes.find(layout => 
            this.player.hasClass(layout.class)
        );
        
        if (currentTheme) {
            const currentItem = this.modal.querySelector(`[data-class="${currentTheme.class}"]`);
            if (currentItem) {
                this.updateActiveState(currentItem);
            }
        }
    }

    hide() {
        this.modal.style.display = 'none';
    }
}
