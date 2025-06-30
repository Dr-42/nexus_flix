/**
 * Global Theme Manager
 * Manages both global app themes and video player themes
 */

export const globalThemes = [
    // Original themes
    { name: 'Default', class: 'theme-base', description: 'Classic dark theme', category: 'base' },
    { name: 'Material', class: 'theme-material', description: 'Material design inspired', category: 'base' },
    { name: 'Glass', class: 'theme-glass', description: 'Glassmorphism effect', category: 'base' },
    
    // Video player inspired global themes
    { name: 'Midnight', class: 'theme-midnight', description: 'Deep blue darkness', category: 'color' },
    { name: 'Crimson', class: 'theme-crimson', description: 'Bold red elegance', category: 'color' },
    { name: 'Emerald', class: 'theme-emerald', description: 'Natural green vibes', category: 'color' },
    { name: 'Golden', class: 'theme-golden', description: 'Luxurious gold shine', category: 'color' },
    { name: 'Arctic', class: 'theme-arctic', description: 'Cool ice blue', category: 'color' },
    { name: 'Neon', class: 'theme-neon', description: 'Electric cyber glow', category: 'color' },
    { name: 'Royal', class: 'theme-royal', description: 'Majestic purple', category: 'color' },
    { name: 'Copper', class: 'theme-copper', description: 'Warm bronze tones', category: 'color' },
    { name: 'Monochrome', class: 'theme-monochrome', description: 'Classic black & white', category: 'color' },
    
    // New additional themes
    { name: 'Ocean', class: 'theme-ocean', description: 'Deep sea blues', category: 'nature' },
    { name: 'Forest', class: 'theme-forest', description: 'Woodland greens', category: 'nature' },
    { name: 'Sunset', class: 'theme-sunset', description: 'Warm sunset colors', category: 'nature' },
    { name: 'Aurora', class: 'theme-aurora', description: 'Northern lights magic', category: 'nature' },
    { name: 'Volcanic', class: 'theme-volcanic', description: 'Fiery lava tones', category: 'nature' },
    { name: 'Cosmic', class: 'theme-cosmic', description: 'Space-inspired colors', category: 'nature' }
];

export const videoPlayerThemes = [
    { name: 'Midnight', class: 'vjs-midnight-skin', description: 'Deep blue darkness' },
    { name: 'Crimson', class: 'vjs-crimson-skin', description: 'Bold red elegance' },
    { name: 'Emerald', class: 'vjs-emerald-skin', description: 'Natural green vibes' },
    { name: 'Golden', class: 'vjs-golden-skin', description: 'Luxurious gold shine' },
    { name: 'Arctic', class: 'vjs-arctic-skin', description: 'Cool ice blue' },
    { name: 'Neon', class: 'vjs-neon-skin', description: 'Electric cyber glow' },
    { name: 'Royal', class: 'vjs-royal-skin', description: 'Majestic purple' },
    { name: 'Copper', class: 'vjs-copper-skin', description: 'Warm bronze tones' },
    { name: 'Monochrome', class: 'vjs-monochrome-skin', description: 'Classic black & white' },
    { name: 'Ocean', class: 'vjs-ocean-skin', description: 'Deep sea blues' },
    { name: 'Forest', class: 'vjs-forest-skin', description: 'Woodland greens' },
    { name: 'Sunset', class: 'vjs-sunset-skin', description: 'Warm sunset colors' },
    { name: 'Aurora', class: 'vjs-aurora-skin', description: 'Northern lights magic' },
    { name: 'Volcanic', class: 'vjs-volcanic-skin', description: 'Fiery lava tones' },
    { name: 'Cosmic', class: 'vjs-cosmic-skin', description: 'Space-inspired colors' }
];

export class ThemeManager {
    constructor() {
        this.currentGlobalTheme = 'theme-base';
        this.currentVideoTheme = 'vjs-midnight-skin';
        this.appContainer = document.getElementById('app-container');
        this.loadSavedThemes();
    }

    // Global theme management
    applyGlobalTheme(themeClass) {
        // Remove all global theme classes
        globalThemes.forEach(theme => {
            this.appContainer.classList.remove(theme.class);
        });
        
        // Apply new theme
        this.appContainer.classList.add(themeClass);
        this.currentGlobalTheme = themeClass;
        this.saveGlobalTheme(themeClass);
        
        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('globalThemeChanged', {
            detail: { theme: themeClass }
        }));
    }

    // Video player theme management
    applyVideoTheme(themeClass, player = null) {
        this.currentVideoTheme = themeClass;
        this.saveVideoTheme(themeClass);
        
        // Apply to current video player if exists
        if (player) {
            videoPlayerThemes.forEach(theme => {
                player.removeClass(theme.class);
            });
            player.addClass(themeClass);
        }
        
        // Apply to video element in DOM if exists
        const videoElement = document.getElementById('video-player');
        if (videoElement) {
            videoPlayerThemes.forEach(theme => {
                videoElement.classList.remove(theme.class);
            });
            videoElement.classList.add(themeClass);
        }
        
        // Dispatch event for video player components
        document.dispatchEvent(new CustomEvent('videoThemeChanged', {
            detail: { theme: themeClass }
        }));
    }

    // Get current themes
    getCurrentGlobalTheme() {
        return this.currentGlobalTheme;
    }

    getCurrentVideoTheme() {
        return this.currentVideoTheme;
    }

    // Theme persistence
    saveGlobalTheme(themeClass) {
        try {
            localStorage.setItem('globalTheme', themeClass);
        } catch (error) {
            console.warn('Could not save global theme:', error);
        }
    }

    saveVideoTheme(themeClass) {
        try {
            localStorage.setItem('videoPlayerTheme', themeClass);
        } catch (error) {
            console.warn('Could not save video theme:', error);
        }
    }

    loadSavedThemes() {
        try {
            // Load global theme
            const savedGlobalTheme = localStorage.getItem('globalTheme');
            if (savedGlobalTheme && globalThemes.some(theme => theme.class === savedGlobalTheme)) {
                this.applyGlobalTheme(savedGlobalTheme);
            } else {
                this.applyGlobalTheme('theme-base');
            }

            // Load video theme
            const savedVideoTheme = localStorage.getItem('videoPlayerTheme');
            if (savedVideoTheme && videoPlayerThemes.some(theme => theme.class === savedVideoTheme)) {
                this.currentVideoTheme = savedVideoTheme;
            }
        } catch (error) {
            console.warn('Could not load saved themes:', error);
        }
    }

    // Get themes by category
    getThemesByCategory(category) {
        return globalThemes.filter(theme => theme.category === category);
    }

    // Get all categories
    getCategories() {
        return [...new Set(globalThemes.map(theme => theme.category))];
    }
}

// Create global instance
export const themeManager = new ThemeManager();