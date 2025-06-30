import { VideoPlayer } from '../video-player/video-player.js';
import { themeManager, videoPlayerThemes } from '../themes/theme-manager.js';

export class SettingsModal {
    constructor(player) {
        this.player = player;
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
                <h2>Video Player Themes</h2>
                <p class="vjs-modal-subtitle">Choose your preferred video player appearance</p>
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
                <button class="vjs-close-button">&times;</button>
            </div>
        `;
        return modal;
    }

    setupEventListeners() {
        this.modal.querySelector('.vjs-close-button').addEventListener('click', () => this.hide());
        this.modal.querySelectorAll('.vjs-layout-item').forEach(item => {
            item.addEventListener('click', () => {
                const layoutClass = item.getAttribute('data-class');
                this.updateActiveState(item);
                this.applyLayout(layoutClass);
                // Don't hide immediately, let user see the selection
                setTimeout(() => this.hide(), 300);
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

    applyLayout(layoutClass, savePreference = true) {
        // Use theme manager to apply the theme
        themeManager.applyVideoTheme(layoutClass, this.player);
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
