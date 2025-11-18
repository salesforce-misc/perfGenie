/**
 * API Progress Bar Component
 * A thin, configurable progress bar for REST API calls
 * Supports multiple progress bar instances on the same page
 * 
 * Usage:
 *   // Start default progress bar at top of page
 *   ProgressBar.start({ position: 'top' });
 *   
 *   // Start progress bar with specific ID
 *   ProgressBar.start({ id: 'myProgressBar', position: 'top' });
 *   
 *   // Start progress bar inside a div with specific ID
 *   ProgressBar.start({ id: 'bar1', container: 'myDivId', position: 'top' });
 *   
 *   // Start progress bar with animated running icon at tip
 *   ProgressBar.start({ showIcon: true });
 *   
 *   // Start progress bar with custom emoji icon
 *   ProgressBar.start({ showIcon: true, icon: '⚡' });
 *   
 *   // Start progress bar with custom image/GIF icon
 *   ProgressBar.start({ 
 *     showIcon: true, 
 *     icon: { type: 'image', value: 'path/to/running.gif' } 
 *   });
 *   
 *   // Start progress bar with icon starting from top-left
 *   ProgressBar.start({ 
 *     showIcon: true, 
 *     iconStartPosition: 'top',  // 'top' or 'bottom' (default: 'bottom')
 *     splash: true  // Show splash effect when icon touches progress bar (optional, default: false)
 *   });
 *   
 *   // Stop default progress bar
 *   ProgressBar.stop();
 * 
 *   // Stop specific progress bar
 *   ProgressBar.stop('myProgressBar');
 * 
 *   // Stop with crash explosion effect (default)
 *   ProgressBar.stop({ id: 'myProgressBar', explode: true });
 * 
 *   // Stop with celebration explosion effect
 *   ProgressBar.stop({ id: 'myProgressBar', explode: true, celebrate: true });
 * 
 *   // Stop default progress bar with crash explosion
 *   ProgressBar.stop({ explode: true });
 * 
 *   // Stop default progress bar with celebration explosion
 *   ProgressBar.stop({ explode: true, celebrate: true });
 * 
 *   // Set container for specific instance
 *   ProgressBar.setContainer('myDivId', 'myProgressBar');
 *   
 *   // Set position for specific instance
 *   ProgressBar.setPosition('bottom', 'myProgressBar');
 */

(function() {
    'use strict';

    // Store multiple progress bar instances by ID
    const progressBarInstances = {};
    let defaultId = 'default';

    /**
     * Inject CSS styles into the page
     */
    function injectStyles() {
        if (document.getElementById('progressbar-styles')) {
            return; // Styles already injected
        }

        const style = document.createElement('style');
        style.id = 'progressbar-styles';
        style.textContent = `
            /* Thin progress bar - full width, configurable position */
            .api-progress-bar {
                position: fixed;
                left: 0;
                width: 100%;
                height: 2px;
                background-color: transparent;
                z-index: 9999;
                display: none;
            }

            /* When inside a container div */
            .api-progress-bar.inside-container {
                position: absolute;
                left: 0;
                width: 100%;
            }

            /* Position: top (default) - for fixed position */
            .api-progress-bar.position-top {
                top: 0;
                bottom: auto;
            }

            /* Position: bottom - for fixed position */
            .api-progress-bar.position-bottom {
                top: auto;
                bottom: 0;
            }

            /* Position: top - for inside container */
            .api-progress-bar.inside-container.position-top {
                top: 0;
                bottom: auto;
            }

            /* Position: bottom - for inside container */
            .api-progress-bar.inside-container.position-bottom {
                top: auto;
                bottom: 0;
            }

            .api-progress-line {
                height: 100%;
                width: 0%;
                background: linear-gradient(to right, #00aaff, #44ccff, #cc7700);
                transition: width 0.5s ease, background 0.3s ease;
                box-shadow: 0 0 8px rgba(0, 170, 255, 0.4);
                position: relative; /* Needed for absolute positioning of icon */
            }

            .api-progress-bar.active .api-progress-line {
                width: 100%;
                animation: progressbar-shimmer 2.5s infinite;
            }

            @keyframes progressbar-shimmer {
                0% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.75;
                }
                100% {
                    opacity: 1;
                }
            }

            /* Running icon at progress bar tip - fixed position (viewport) */
            .api-progress-icon {
                position: fixed;
                left: 0;
                top: 50%;
                transform: translateY(-50%) translateX(-50%);
                font-size: 16px;
                line-height: 1;
                z-index: 99999; /* Very high z-index to appear on top of all page content */
                pointer-events: none;
                transition: left 0.4s ease, top 0.4s ease;
                white-space: nowrap;
            }

            /* Icon position: top-left (viewport) - aligned with progress bar top */
            .api-progress-icon.icon-start-top {
                top: 0;
                transform: translateX(-50%) translateY(-50%);
            }

            /* Icon position: bottom-left (viewport, default) - aligned with progress bar bottom */
            .api-progress-icon.icon-start-bottom {
                top: auto;
                bottom: 0;
                transform: translateX(-50%) translateY(50%);
            }

            /* Icon inside container - absolute positioning relative to container */
            /* When icon is inside a container, it uses absolute positioning */
            /* The container will have position: relative */

            /* Icon jump animation - starts above/below and jumps onto progress bar */
            /* Note: Top position now uses smooth glide-down effect instead of jump animation */
            .api-progress-icon.icon-jumping {
                animation: none; /* Disable bounce during jump */
            }

            /* Jump animation for top position - disabled in favor of smooth glide-down */
            /* Keeping for backward compatibility but not used when iconStartPosition: 'top' */
            .api-progress-icon.icon-start-top.icon-jumping {
                animation: none; /* Top position uses JavaScript-based glide-down, not CSS animation */
            }

            /* Jump animation for bottom position */
            .api-progress-icon.icon-start-bottom.icon-jumping {
                animation: progressbar-icon-jump-bottom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }

            @keyframes progressbar-icon-jump-bottom {
                0% {
                    /* Start position - below progress bar (1px progress bar + offset) */
                    transform: translateX(-50%) translateY(calc(50% + var(--jump-distance)));
                    opacity: 0.8;
                }
                40% {
                    /* Mid jump - reaching progress bar level */
                    transform: translateX(-50%) translateY(calc(50% - var(--jump-distance) * 0.15));
                    opacity: 1;
                }
                60% {
                    /* Landing on progress bar - slight overshoot bounce */
                    transform: translateX(-50%) translateY(calc(50% - 2px));
                    opacity: 1;
                }
                80% {
                    /* Settling */
                    transform: translateX(-50%) translateY(50%);
                    opacity: 1;
                }
                100% {
                    /* Settled on progress bar */
                    transform: translateX(-50%) translateY(50%);
                    opacity: 1;
                }
            }

            /* Icon bounce animation for top position (after glide-down completes) */
            .api-progress-icon.icon-start-top:not(.icon-jumping) {
                animation: progressbar-icon-bounce-top 0.6s infinite ease-in-out;
            }

            @keyframes progressbar-icon-bounce-top {
                0%, 100% {
                    transform: translateX(-50%) translateY(-50%) translateY(0);
                }
                50% {
                    transform: translateX(-50%) translateY(-50%) translateY(3px);
                }
            }

            /* Icon bounce animation for bottom position (after jump, default) */
            .api-progress-icon.icon-start-bottom:not(.icon-jumping) {
                animation: progressbar-icon-bounce-bottom 0.6s infinite ease-in-out;
            }

            @keyframes progressbar-icon-bounce-bottom {
                0%, 100% {
                    transform: translateX(-50%) translateY(50%) translateY(0);
                }
                50% {
                    transform: translateX(-50%) translateY(50%) translateY(-3px);
                }
            }

            /* Icon styles for different types */
            .api-progress-icon.emoji {
                font-size: 18px;
            }

            .api-progress-icon.image {
                width: 20px;
                height: 20px;
                object-fit: contain;
            }

            .api-progress-icon.hidden {
                display: none;
            }

            /* Explosion effect - crash style */
            .api-progress-explosion {
                position: absolute;
                pointer-events: none;
                z-index: 10001;
            }

            .api-progress-explosion-particle {
                position: absolute;
                pointer-events: none;
                opacity: 1;
            }

            /* Fire/debris particles */
            .api-progress-explosion-particle.fire {
                width: 6px;
                height: 6px;
                border-radius: 50% 50% 50% 0;
                background: radial-gradient(circle, var(--particle-color-inner) 0%, var(--particle-color-outer) 100%);
                box-shadow: 0 0 8px var(--particle-color-inner), 0 0 12px var(--particle-color-outer);
            }

            /* Smoke particles */
            .api-progress-explosion-particle.smoke {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: radial-gradient(circle, var(--particle-color-inner) 0%, transparent 70%);
                opacity: 0.8;
            }

            /* Debris particles */
            .api-progress-explosion-particle.debris {
                width: 3px;
                height: 3px;
                background: var(--particle-color);
                border-radius: 1px;
            }

            @keyframes progressbar-explosion-fire {
                0% {
                    transform: scale(0) translate(0, 0) rotate(0deg);
                    opacity: 1;
                }
                20% {
                    opacity: 1;
                    transform: scale(1.2) translate(calc(var(--explode-x) * 0.3), calc(var(--explode-y) * 0.3)) rotate(180deg);
                }
                100% {
                    transform: scale(0.8) translate(var(--explode-x), var(--explode-y)) rotate(360deg);
                    opacity: 0;
                }
            }

            @keyframes progressbar-explosion-smoke {
                0% {
                    transform: scale(0) translate(0, 0);
                    opacity: 0.8;
                }
                30% {
                    opacity: 0.6;
                    transform: scale(1.5) translate(calc(var(--explode-x) * 0.4), calc(var(--explode-y) * 0.4));
                }
                100% {
                    transform: scale(2.5) translate(calc(var(--explode-x) * 0.8), calc(var(--explode-y) * 0.8));
                    opacity: 0;
                }
            }

            @keyframes progressbar-explosion-debris {
                0% {
                    transform: scale(1) translate(0, 0) rotate(0deg);
                    opacity: 1;
                }
                15% {
                    opacity: 1;
                    transform: scale(1.1) translate(calc(var(--explode-x) * 0.2), calc(var(--explode-y) * 0.2)) rotate(90deg);
                }
                100% {
                    transform: scale(0.5) translate(var(--explode-x), var(--explode-y)) rotate(720deg);
                    opacity: 0;
                }
            }

            .api-progress-explosion-particle.fire {
                animation: progressbar-explosion-fire 2.5s ease-out forwards;
            }

            .api-progress-explosion-particle.smoke {
                animation: progressbar-explosion-smoke 3.5s ease-out forwards;
            }

            .api-progress-explosion-particle.debris {
                animation: progressbar-explosion-debris 2.8s ease-out forwards;
            }

            /* Celebration particles (sparkles) */
            .api-progress-explosion-particle.celebration {
                width: 4px;
                height: 4px;
                border-radius: 50%;
                pointer-events: none;
                opacity: 1;
            }

            @keyframes progressbar-explosion-celebration {
                0% {
                    transform: scale(0) translate(0, 0) rotate(0deg);
                    opacity: 0;
                }
                10% {
                    transform: scale(1.2) translate(0, -10px) rotate(180deg);
                    opacity: 1;
                }
                30% {
                    transform: scale(1.1) translate(calc(var(--explode-x) * 0.3), calc(var(--explode-y) * 0.3 - 15px)) rotate(360deg);
                    opacity: 1;
                }
                60% {
                    transform: scale(1) translate(calc(var(--explode-x) * 0.6), calc(var(--explode-y) * 0.6 - 8px)) rotate(540deg);
                    opacity: 0.9;
                }
                100% {
                    transform: scale(0.8) translate(var(--explode-x), calc(var(--explode-y) - 5px)) rotate(720deg);
                    opacity: 0;
                }
            }

            .api-progress-explosion-particle.celebration {
                animation: progressbar-explosion-celebration 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            }

            /* Splash effect - water droplets */
            .api-progress-splash {
                position: absolute;
                pointer-events: none;
                z-index: 9998; /* Behind icon (10000) so icon appears in front like surfboard */
            }

            .api-progress-splash-particle {
                position: absolute;
                pointer-events: none;
                opacity: 1;
            }

            /* Water droplet particles */
            .api-progress-splash-particle.droplet {
                width: 4px;
                height: 4px;
                border-radius: 50% 50% 50% 0;
                background: radial-gradient(circle, var(--droplet-color-inner) 0%, var(--droplet-color-outer) 100%);
                box-shadow: 0 0 4px var(--droplet-color-inner);
            }

            /* Water splash particles */
            .api-progress-splash-particle.splash {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: radial-gradient(circle, var(--droplet-color-inner) 0%, transparent 70%);
                opacity: 0.7;
            }

            @keyframes progressbar-splash-droplet {
                0% {
                    transform: scale(0) translate(0, 0) rotate(0deg);
                    opacity: 1;
                }
                20% {
                    opacity: 1;
                    transform: scale(1.2) translate(calc(var(--splash-x) * 0.3), calc(var(--splash-y) * 0.3)) rotate(90deg);
                }
                100% {
                    transform: scale(0.8) translate(var(--splash-x), var(--splash-y)) rotate(360deg);
                    opacity: 0;
                }
            }

            @keyframes progressbar-splash-splash {
                0% {
                    transform: scale(0) translate(0, 0);
                    opacity: 0.7;
                }
                30% {
                    opacity: 0.6;
                    transform: scale(1.5) translate(calc(var(--splash-x) * 0.4), calc(var(--splash-y) * 0.4));
                }
                100% {
                    transform: scale(2.0) translate(calc(var(--splash-x) * 0.6), calc(var(--splash-y) * 0.6));
                    opacity: 0;
                }
            }

            .api-progress-splash-particle.droplet {
                animation: progressbar-splash-droplet 1.2s ease-out forwards;
            }

            .api-progress-splash-particle.splash {
                animation: progressbar-splash-splash 1.5s ease-out forwards;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Get or create a progress bar instance
     * @param {string} id - Unique identifier for the progress bar instance
     * @returns {object} Instance object with element references
     */
    function getOrCreateInstance(id) {
        if (progressBarInstances[id]) {
            return progressBarInstances[id];
        }

        // Create new instance
        const progressBarElement = document.createElement('div');
        progressBarElement.id = 'apiProgressBar-' + id;
        progressBarElement.className = 'api-progress-bar position-top';

        const progressLineElement = document.createElement('div');
        progressLineElement.id = 'apiProgressLine-' + id;
        progressLineElement.className = 'api-progress-line';

        // Create icon element for running animation at tip
        // Icon is appended to body for fixed positioning relative to viewport
        // When inside container, it will be moved to the container
        const progressIconElement = document.createElement('div');
        progressIconElement.id = 'apiProgressIcon-' + id;
        progressIconElement.className = 'api-progress-icon hidden';
        
        // Append to body initially (will be moved to container if needed)
        document.body.appendChild(progressIconElement);
        
        progressBarElement.appendChild(progressLineElement);
        document.body.appendChild(progressBarElement);

        // Store instance
        progressBarInstances[id] = {
            id: id,
            progressBarElement: progressBarElement,
            progressLineElement: progressLineElement,
            progressIconElement: progressIconElement,
            progressAnimation: null,
            currentContainer: null,
            startCount: 0,  // Counter for number of times start() was called
            showIcon: false,  // Whether to show the running icon
            splashEnabled: false,  // Whether to show splash effect when icon touches progress bar
            splashShown: false  // Track if splash has already been shown
        };

        return progressBarInstances[id];
    }

    /**
     * Initialize the component
     */
    function init() {
        injectStyles();
        // No longer creates default instance - instances are created on demand
    }

    /**
     * Set the container div for the progress bar
     * @param {string|HTMLElement|null} containerIdOrElement - ID selector string, DOM element, or null to reset to fixed position
     * @param {string} id - Progress bar instance ID (optional, defaults to 'default')
     */
    function setContainer(containerIdOrElement, id) {
        id = id || defaultId;
        const instance = getOrCreateInstance(id);
        const progressBarElement = instance.progressBarElement;

        // Remove from current container if any
        if (instance.currentContainer && progressBarElement.parentNode !== document.body) {
            if (progressBarElement.parentNode === instance.currentContainer) {
                instance.currentContainer.removeChild(progressBarElement);
            }
            instance.currentContainer = null;
        }

        // If container is null, reset to fixed position
        if (!containerIdOrElement) {
            if (progressBarElement.parentNode !== document.body) {
                document.body.appendChild(progressBarElement);
            }
            progressBarElement.classList.remove('inside-container');
            instance.currentContainer = null;
            
            // Move icon back to body for fixed positioning
            if (instance.progressIconElement && instance.progressIconElement.parentNode !== document.body) {
                document.body.appendChild(instance.progressIconElement);
                // Change icon back to fixed positioning when on body
                instance.progressIconElement.style.position = 'fixed';
                instance.progressIconElement.style.zIndex = '99999';
            }
            return;
        }

        // Get container element
        let containerElement = null;
        if (typeof containerIdOrElement === 'string') {
            containerElement = document.getElementById(containerIdOrElement);
            if (!containerElement) {
                console.error('ProgressBar: Container not found:', containerIdOrElement);
                return;
            }
        } else if (containerIdOrElement instanceof HTMLElement) {
            containerElement = containerIdOrElement;
        } else {
            console.error('ProgressBar: Invalid container parameter. Expected string ID or HTMLElement.');
            return;
        }

        // Ensure container has relative positioning
        const computedStyle = window.getComputedStyle(containerElement);
        if (computedStyle.position === 'static') {
            containerElement.style.position = 'relative';
        }

        // Remove from body if it's there
        if (progressBarElement.parentNode === document.body) {
            document.body.removeChild(progressBarElement);
        }

        // Move progress bar into container
        containerElement.appendChild(progressBarElement);
        progressBarElement.classList.add('inside-container');
        instance.currentContainer = containerElement;
        
        // Move icon into container for absolute positioning relative to container
        if (instance.progressIconElement) {
            if (instance.progressIconElement.parentNode !== containerElement) {
                containerElement.appendChild(instance.progressIconElement);
                // Change icon to absolute positioning when inside container
                instance.progressIconElement.style.position = 'absolute';
                instance.progressIconElement.style.zIndex = '99999'; /* Very high z-index to appear on top of all page content */
            }
        }
    }

    /**
     * Set the position of the progress bar
     * @param {string} position - 'top' or 'bottom' (default: 'top')
     * @param {string} id - Progress bar instance ID (optional, defaults to 'default')
     */
    function setPosition(position, id) {
        id = id || defaultId;
        const instance = getOrCreateInstance(id);
        const progressBarElement = instance.progressBarElement;

        // Remove existing position classes
        progressBarElement.classList.remove('position-top', 'position-bottom');

        // Add new position class
        if (position === 'bottom') {
            progressBarElement.classList.add('position-bottom');
        } else {
            progressBarElement.classList.add('position-top');
        }
    }

    /**
     * Start the API progress bar
     * @param {string|object} options - Position string ('top'/'bottom') or options object
     *   - id: Unique identifier for this progress bar instance (optional, defaults to 'default')
     *   - position: 'top' or 'bottom' (optional, default: 'top')
     *   - container: container ID string, HTMLElement, or null/undefined (optional, default: null for fixed position)
     *   - showIcon: boolean to show animated icon at progress tip (optional, default: false)
     *   - icon: string or object for icon customization (optional)
     *     - If string: emoji character (e.g., '🏃', '🚶', '⚡')
     *     - If object: { type: 'emoji'|'image', value: 'emoji_char'|'image_url' }
     *   - iconStartPosition: 'top' or 'bottom' (optional, default: 'bottom') - where icon starts from left
     *   - splash: boolean (optional, default: false) - show splash effect when icon touches progress bar
     */
    function start(options) {
        init();

        // Handle options parameter
        let position = null;
        let container = null;
        let id = defaultId;
        let showIcon = false;
        let iconConfig = null;
        let iconStartPosition = 'bottom'; // Default: start from bottom-left
        let splashEnabled = false; // Default: no splash effect

        if (typeof options === 'string') {
            // Legacy: simple string is position
            position = options;
        } else if (typeof options === 'object' && options !== null) {
            // New: object with id, position, container, showIcon, icon, iconStartPosition, and/or splash
            id = options.id || defaultId;
            position = options.position || null;
            container = options.container !== undefined ? options.container : null;
            showIcon = options.showIcon === true;
            iconConfig = options.icon || null;
            iconStartPosition = options.iconStartPosition === 'top' ? 'top' : 'bottom';
            splashEnabled = options.splash === true; // Enable splash effect
        }

        // Get or create instance
        const instance = getOrCreateInstance(id);
        const progressBarElement = instance.progressBarElement;
        const progressLineElement = instance.progressLineElement;
        const progressIconElement = instance.progressIconElement;

        // Initialize startCount if it doesn't exist (backward compatibility)
        if (typeof instance.startCount === 'undefined') {
            instance.startCount = 0;
        }

        // Update icon configuration
        instance.showIcon = showIcon;
        instance.iconStartPosition = iconStartPosition;
        instance.splashEnabled = splashEnabled;
        instance.splashShown = false; // Reset splash state when starting
        instance.lastWidth = 0; // Track previous width for velocity calculation
        instance.lastSplashTime = 0; // Track last splash time for continuous effects
        instance.iconLanded = false; // Track if icon has landed after jump
        
        // Setup icon if enabled
        if (showIcon) {
            setupIcon(instance, iconConfig, iconStartPosition);
        } else {
            // Hide icon if disabled
            progressIconElement.classList.add('hidden');
        }

        // Increment start counter FIRST (tracks how many times start was called)
        // This ensures counter is updated even if multiple calls happen concurrently
        instance.startCount++;

        // If progress bar is already running, just update container/position and return
        // Don't restart - let it continue running
        if (instance.progressAnimation) {
            // Update container if provided
            if (container !== null) {
                setContainer(container, id);
            }
            
            // Update position if provided
            if (position) {
                setPosition(position, id);
            }
            
            // Update icon if showIcon changed
            if (showIcon) {
                setupIcon(instance, iconConfig, iconStartPosition);
            } else {
                progressIconElement.classList.add('hidden');
            }
            
            // Already running, just increment counter and return
            return;
        }

        // Progress bar is not running - start it now
        
        // Set container if provided
        if (container !== null) {
            setContainer(container, id);
        }

        // Set position if provided
        if (position) {
            setPosition(position, id);
        }

        // Start the animation from beginning

        // Show progress bar IMMEDIATELY (before any other operations)
        progressBarElement.style.display = 'block';
        
        // Reset progress bar state completely (important for restart)
        progressBarElement.classList.remove('active');
        
        // Force immediate reset - disable transition temporarily for instant reset
        const originalTransition = progressLineElement.style.transition || '';
        progressLineElement.style.transition = 'none';
        progressLineElement.style.width = '0%';
        
        // Initialize gradient at start (bright blue to orange gradient from left to right)
        progressLineElement.style.background = 'linear-gradient(to right, #00aaff, #44ccff, #cc7700)';
        progressLineElement.style.boxShadow = '0 0 8px rgba(0, 170, 255, 0.4)';
        
        // Force a reflow to ensure the reset is applied
        void progressLineElement.offsetWidth;
        
        // Helper function to calculate gradient color based on progress
        function getProgressGradient(progressPercent) {
            // Always show bright blue to orange gradient from left to right
            // Left side: bright blue, Right side: more orange
            // This creates a consistent bright blue-to-orange gradient across the progress bar width
            
            const startColor = '#00aaff'; // Bright blue on the left
            const midColor = '#44ccff'; // Light bright blue in the middle
            const endColor = '#cc7700'; // Dull orange on the right
            
            // Create horizontal gradient spanning the full width (left to right)
            // Bright blue on left, transitioning to orange on right
            return `linear-gradient(to right, ${startColor}, ${midColor}, ${endColor})`;
        }
        
        // Helper function to interpolate between two hex colors
        function interpolateColor(color1, color2, factor) {
            // Remove # if present
            color1 = color1.replace('#', '');
            color2 = color2.replace('#', '');
            
            // Convert to RGB
            const r1 = parseInt(color1.substring(0, 2), 16);
            const g1 = parseInt(color1.substring(2, 4), 16);
            const b1 = parseInt(color1.substring(4, 6), 16);
            
            const r2 = parseInt(color2.substring(0, 2), 16);
            const g2 = parseInt(color2.substring(2, 4), 16);
            const b2 = parseInt(color2.substring(4, 6), 16);
            
            // Interpolate
            const r = Math.round(r1 + (r2 - r1) * factor);
            const g = Math.round(g1 + (g2 - g1) * factor);
            const b = Math.round(b1 + (b2 - b1) * factor);
            
            // Convert back to hex
            return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }
        
        // Helper function to get shadow color based on progress
        function getShadowColor(progressPercent) {
            // Since gradient shows bright blue-to-orange across width, keep shadow bright blue
            // The gradient itself shows the color transition from left to right
            return '#00aaff66'; // Bright blue shadow with transparency (hex alpha ~40%)
        }
        
        // Animate progress with very fast initial movement, covers most distance quickly, moves continuously until near end
        // Moves very fast initially to cover ~75% quickly, then slows down but continues moving until ~98%
        let width = 0;
        
        // Function to update progress (extracted so we can call it immediately)
        function updateProgress() {
            // Continue moving until just before end (98%) - keeps moving continuously
            if (width < 98) {
                let increment = 0;
                
                // Phase 1: Very fast movement (0-70%) - covers most distance quickly
                if (width < 70) {
                    // Fast linear progression: starts at ~25% per interval, decreases linearly to ~5%
                    const remainingDistance = 70 - width;
                    increment = 5 + (remainingDistance / 70) * 20; // 5% to 25% per interval
                }
                // Phase 2: Medium speed (70-80%)
                else if (width < 80) {
                    // Slower: ~2-3% per interval
                    increment = 2.5 - ((width - 70) / 10) * 1.5; // 2.5% to 1% per interval
                }
                // Phase 3: Slow movement (80-95%) - continues moving but very slowly
                else if (width < 95) {
                    // Very slow: ~0.3-0.8% per interval
                    increment = 0.8 - ((width - 80) / 15) * 0.5; // 0.8% to 0.3% per interval
                }
                // Phase 4: Extremely slow movement (95-98%) - almost at end but still moving
                else {
                    // Extremely slow: ~0.1-0.3% per interval, but always at least 1px worth
                    increment = 0.3 - ((width - 95) / 3) * 0.2; // 0.3% to 0.1% per interval
                }
                
                // Calculate minimum increment in pixels to ensure at least 1px movement
                const containerWidth = progressBarElement.offsetWidth || window.innerWidth;
                const minIncrementPixels = 1; // At least 1px movement
                const minIncrementPercent = (minIncrementPixels / containerWidth) * 100;
                
                // Ensure minimum visible movement (always moves at least 1px per interval)
                if (increment < minIncrementPercent) {
                    increment = minIncrementPercent;
                }
                
                // Add some randomness for natural feel (±15% variation)
                increment = increment * (0.85 + Math.random() * 0.3);
                
                // Ensure final increment is always at least 1px worth
                increment = Math.max(increment, minIncrementPercent);
                
                width += increment;
                width = Math.min(width, 98); // Cap at 98% (continues moving until just before end)
                
                // Calculate velocity (increment per interval, normalized)
                const velocity = increment; // Already in percentage units
                
                // Update progress bar width
                progressLineElement.style.width = width + '%';
                
                // Update gradient color based on progress
                const gradient = getProgressGradient(width);
                progressLineElement.style.background = gradient;
                
                // Update shadow color to match gradient
                const shadowColor = getShadowColor(width);
                progressLineElement.style.boxShadow = `0 0 8px ${shadowColor}`;
                
                // Update icon position if enabled
                if (instance.showIcon && progressIconElement) {
                    // Position icon to follow the progress bar tip
                    // Calculate icon position based on viewport width (for fixed) or container width (for inside container)
                    const isInsideContainer = progressBarElement.classList.contains('inside-container');
                    const iconStartPosition = instance.iconStartPosition || 'bottom';
                    
                    // Get progress bar Y position for top start position glide-down effect
                    let progressBarY = null;
                    if (iconStartPosition === 'top') {
                        const progressBarRect = progressBarElement.getBoundingClientRect();
                        progressBarY = progressBarRect.top + progressBarRect.height / 2;
                    }
                    
                    if (isInsideContainer) {
                        // Inside container: position relative to container width (percentage)
                        progressIconElement.style.left = width + '%';
                        
                        // For top start position: glide down from 40px above to progress bar level
                        if (iconStartPosition === 'top' && progressBarY !== null) {
                            // Calculate how much the icon should move down based on progress
                            // Start at 40px above, gradually reduce to 0 (touch progress bar)
                            // Use progress percentage to interpolate: 0% = 40px above, reaches progress bar as it moves
                            const startOffset = 40; // Start 40px above
                            const glideProgress = Math.min(width / 100, 1); // 0 to 1 based on progress
                            // Use easing function for smoother glide: faster at start, slower near end
                            const easedProgress = 1 - Math.pow(1 - glideProgress, 2); // Ease-out curve
                            const currentOffset = startOffset * (1 - easedProgress); // Reduce from 40px to 0px
                            
                            // Calculate icon's current Y position relative to container
                            const containerRect = instance.currentContainer.getBoundingClientRect();
                            const iconRelativeY = progressBarY - containerRect.top;
                            const iconY = iconRelativeY - currentOffset;
                            
                            // Check if icon just touched the progress bar (more lenient threshold) and show splash
                            // Trigger splash when offset is small enough (within 8px) OR when progress is sufficient (>= 3%)
                            if (instance.splashEnabled && !instance.iconLanded) {
                                const shouldSplash = currentOffset <= 8 || (width >= 3 && easedProgress >= 0.05);
                                if (shouldSplash) {
                                    // Icon just touched the progress bar - show splash effect
                                    createSplashEffect(instance, progressBarY, isInsideContainer);
                                    instance.iconLanded = true; // Mark that icon has landed
                                    instance.lastSplashTime = Date.now(); // Reset splash timer for continuous effects
                                }
                            }
                            
                            // Continuous splash effects based on velocity while icon is on progress bar
                            // Only show splash if icon is actually on the progress bar (not in the air)
                            if (instance.splashEnabled && instance.iconLanded && currentOffset <= 5) {
                                const currentTime = Date.now();
                                const timeSinceLastSplash = currentTime - instance.lastSplashTime;
                                // Faster movement = more frequent splashes
                                // High velocity (>5% per interval) = splash every 200ms
                                // Medium velocity (2-5%) = splash every 400ms
                                // Low velocity (<2%) = splash every 800ms
                                const splashInterval = velocity > 5 ? 200 : (velocity > 2 ? 400 : 800);
                                
                                if (timeSinceLastSplash >= splashInterval) {
                                    // Create splash effect scaled by velocity (velocity decreases = smaller splash)
                                    createSplashEffect(instance, progressBarY, isInsideContainer, velocity);
                                    instance.lastSplashTime = currentTime;
                                }
                            }
                            
                            // Ensure smooth transition by enabling CSS transition
                            progressIconElement.style.transition = 'left 0.4s ease, top 0.4s ease';
                            progressIconElement.style.top = iconY + 'px';
                            progressIconElement.style.transform = 'translateX(-50%) translateY(-50%)';
                        } else if (iconStartPosition === 'bottom' && instance.iconLanded) {
                            // For bottom position: continuous splash effects based on velocity while icon is on progress bar
                            // Verify icon is actually on the progress bar (check actual icon position)
                            if (instance.splashEnabled) {
                                const progressBarRect = progressBarElement.getBoundingClientRect();
                                const progressBarY = progressBarRect.top + progressBarRect.height / 2;
                                const iconRect = progressIconElement.getBoundingClientRect();
                                const iconY = iconRect.top + iconRect.height / 2;
                                // Check if icon is close to progress bar (within 2px) - not in the air
                                const iconDistanceFromBar = Math.abs(iconY - progressBarY);
                                
                                if (iconDistanceFromBar <= 2) {
                                    const currentTime = Date.now();
                                    const timeSinceLastSplash = currentTime - instance.lastSplashTime;
                                    // Faster movement = more frequent splashes
                                    // High velocity (>5% per interval) = splash every 200ms
                                    // Medium velocity (2-5%) = splash every 400ms
                                    // Low velocity (<2%) = splash every 800ms
                                    const splashInterval = velocity > 5 ? 200 : (velocity > 2 ? 400 : 800);
                                    
                                    if (timeSinceLastSplash >= splashInterval) {
                                        // Create splash effect scaled by velocity (velocity decreases = smaller splash)
                                        createSplashEffect(instance, progressBarY, isInsideContainer, velocity);
                                        instance.lastSplashTime = currentTime;
                                    }
                                }
                            }
                        }
                    } else {
                        // Fixed position: calculate based on viewport width (pixels)
                        const viewportWidth = window.innerWidth;
                        const iconPosition = (viewportWidth * width) / 100;
                        progressIconElement.style.left = iconPosition + 'px';
                        
                        // For top start position: glide down from 40px above to progress bar level
                        if (iconStartPosition === 'top' && progressBarY !== null) {
                            // Calculate how much the icon should move down based on progress
                            // Start at 40px above, gradually reduce to 0 (touch progress bar)
                            const startOffset = 40; // Start 40px above
                            const glideProgress = Math.min(width / 100, 1); // 0 to 1 based on progress
                            // Use easing function for smoother glide: faster at start, slower near end
                            const easedProgress = 1 - Math.pow(1 - glideProgress, 2); // Ease-out curve
                            const currentOffset = startOffset * (1 - easedProgress); // Reduce from 40px to 0px
                            
                            // Check if icon just touched the progress bar (more lenient threshold) and show splash
                            // Trigger splash when offset is small enough (within 8px) OR when progress is sufficient (>= 3%)
                            if (instance.splashEnabled && !instance.iconLanded) {
                                const shouldSplash = currentOffset <= 8 || (width >= 3 && easedProgress >= 0.05);
                                if (shouldSplash) {
                                    // Icon just touched the progress bar - show splash effect
                                    createSplashEffect(instance, progressBarY, isInsideContainer);
                                    instance.iconLanded = true; // Mark that icon has landed
                                    instance.lastSplashTime = Date.now(); // Reset splash timer for continuous effects
                                }
                            }
                            
                            // Continuous splash effects based on velocity while icon is on progress bar
                            // Only show splash if icon is actually on the progress bar (not in the air)
                            if (instance.splashEnabled && instance.iconLanded && currentOffset <= 5) {
                                const currentTime = Date.now();
                                const timeSinceLastSplash = currentTime - instance.lastSplashTime;
                                // Faster movement = more frequent splashes
                                // High velocity (>5% per interval) = splash every 200ms
                                // Medium velocity (2-5%) = splash every 400ms
                                // Low velocity (<2%) = splash every 800ms
                                const splashInterval = velocity > 5 ? 200 : (velocity > 2 ? 400 : 800);
                                
                                if (timeSinceLastSplash >= splashInterval) {
                                    // Create splash effect scaled by velocity (velocity decreases = smaller splash)
                                    createSplashEffect(instance, progressBarY, isInsideContainer, velocity);
                                    instance.lastSplashTime = currentTime;
                                }
                            }
                            
                            // Ensure smooth transition by enabling CSS transition
                            progressIconElement.style.transition = 'left 0.4s ease, top 0.4s ease';
                            progressIconElement.style.top = (progressBarY - currentOffset) + 'px';
                            progressIconElement.style.transform = 'translateX(-50%) translateY(-50%)';
                        } else if (iconStartPosition === 'bottom' && instance.iconLanded) {
                            // For bottom position: continuous splash effects based on velocity while icon is on progress bar
                            // Verify icon is actually on the progress bar (check actual icon position)
                            if (instance.splashEnabled) {
                                const progressBarRect = progressBarElement.getBoundingClientRect();
                                const progressBarY = progressBarRect.top + progressBarRect.height / 2;
                                const iconRect = progressIconElement.getBoundingClientRect();
                                const iconY = iconRect.top + iconRect.height / 2;
                                // Check if icon is close to progress bar (within 2px) - not in the air
                                const iconDistanceFromBar = Math.abs(iconY - progressBarY);
                                
                                if (iconDistanceFromBar <= 2) {
                                    const currentTime = Date.now();
                                    const timeSinceLastSplash = currentTime - instance.lastSplashTime;
                                    // Faster movement = more frequent splashes
                                    // High velocity (>5% per interval) = splash every 200ms
                                    // Medium velocity (2-5%) = splash every 400ms
                                    // Low velocity (<2%) = splash every 800ms
                                    const splashInterval = velocity > 5 ? 200 : (velocity > 2 ? 400 : 800);
                                    
                                    if (timeSinceLastSplash >= splashInterval) {
                                        // Create splash effect scaled by velocity (velocity decreases = smaller splash)
                                        createSplashEffect(instance, progressBarY, isInsideContainer, velocity);
                                        instance.lastSplashTime = currentTime;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Re-enable transition and start animation smoothly
        requestAnimationFrame(function() {
            // Re-enable transition for smooth animation
            progressLineElement.style.transition = originalTransition || 'width 0.5s ease, background 0.3s ease';
            
            // Start with a tiny initial width smoothly (prevents jerk)
            const containerWidth = progressBarElement.offsetWidth || window.innerWidth;
            const initialWidthPercent = Math.max((1 / containerWidth) * 100, 0.1); // At least 1px or 0.1%
            width = initialWidthPercent;
            progressLineElement.style.width = width + '%';
            
            // Position icon at initial position if enabled (starts at left edge of viewport/container)
            if (instance.showIcon && progressIconElement) {
                const isInsideContainer = progressBarElement.classList.contains('inside-container');
                const iconStartPosition = instance.iconStartPosition || 'bottom';
                
                if (isInsideContainer) {
                    // Inside container: start at 0% (left edge of container)
                    progressIconElement.style.left = '0%';
                    
                    // For top start position: position 40px above progress bar initially
                    if (iconStartPosition === 'top') {
                        const progressBarRect = progressBarElement.getBoundingClientRect();
                        const progressBarY = progressBarRect.top + progressBarRect.height / 2;
                        const containerRect = instance.currentContainer.getBoundingClientRect();
                        const iconRelativeY = progressBarY - containerRect.top;
                        const startY = iconRelativeY - 40; // 40px above progress bar
                        
                        progressIconElement.style.top = startY + 'px';
                        progressIconElement.style.transform = 'translateX(-50%) translateY(-50%)';
                    }
                } else {
                    // Fixed position: start at 0px (left edge of viewport)
                    progressIconElement.style.left = '0px';
                    
                    // For top start position: position 40px above progress bar initially
                    if (iconStartPosition === 'top') {
                        const progressBarRect = progressBarElement.getBoundingClientRect();
                        const progressBarY = progressBarRect.top + progressBarRect.height / 2;
                        const startY = progressBarY - 40; // 40px above progress bar
                        
                        progressIconElement.style.top = startY + 'px';
                        progressIconElement.style.transform = 'translateX(-50%) translateY(-50%)';
                    }
                }
                
                // Only trigger jump animation for bottom start position
                // Top position uses smooth glide-down effect instead
                if (iconStartPosition !== 'top') {
                    setTimeout(function() {
                        triggerIconJump(instance);
                    }, 50);
                }
            }
            
            // Force another frame to ensure smooth start
            requestAnimationFrame(function() {
                // Start animation after transition is fully enabled
                updateProgress();
                
                // Then continue with interval updates
                instance.progressAnimation = setInterval(function() {
                    updateProgress();
                }, 400); // Update every 400ms for smoother and faster animation
            });
        });
    }

    /**
     * Setup the running icon at the progress bar tip
     * @param {object} instance - Progress bar instance
     * @param {string|object|null} iconConfig - Icon configuration (emoji string, image URL, or config object)
     * @param {string} iconStartPosition - 'top' or 'bottom' - where icon starts from left
     */
    function setupIcon(instance, iconConfig, iconStartPosition) {
        const progressIconElement = instance.progressIconElement;
        if (!progressIconElement) {
            return;
        }

        // Remove existing icon classes
        progressIconElement.classList.remove('emoji', 'image', 'hidden', 'icon-start-top', 'icon-start-bottom');
        
        // Default icon if none provided
        let iconType = 'emoji';
        let iconValue = '🏃'; // Default running emoji

        // Determine icon type and value
        if (iconConfig) {
            if (typeof iconConfig === 'string') {
                // Simple string - treat as emoji
                iconType = 'emoji';
                iconValue = iconConfig;
            } else if (typeof iconConfig === 'object' && iconConfig.type) {
                // Config object with type and value
                iconType = iconConfig.type || 'emoji';
                iconValue = iconConfig.value || '🏃';
            }
        }

        // Set icon content
        if (iconType === 'image') {
            // Image icon
            const img = document.createElement('img');
            img.src = iconValue;
            img.alt = 'Progress';
            img.className = 'api-progress-icon image';
            img.style.cssText = 'width: 20px; height: 20px; object-fit: contain;';
            
            // Clear existing content and add image
            progressIconElement.innerHTML = '';
            progressIconElement.appendChild(img);
            progressIconElement.classList.add('image');
        } else {
            // Emoji icon (default)
            progressIconElement.textContent = iconValue;
            progressIconElement.classList.add('emoji');
        }

        // Set icon start position (top or bottom)
        if (iconStartPosition === 'top') {
            progressIconElement.classList.add('icon-start-top');
        } else {
            progressIconElement.classList.add('icon-start-bottom');
        }
        
        // Show the icon
        progressIconElement.classList.remove('hidden');
        
        // Icon position will be initialized in the start() function based on container type
        // Don't set it here - it will be set when the progress bar starts
    }

    /**
     * Create splash effect when icon touches progress bar (like surfboard hitting water)
     * @param {object} instance - Progress bar instance
     * @param {number} progressBarY - Y position of progress bar center
     * @param {boolean} isInsideContainer - Whether progress bar is inside a container
     * @param {boolean|number} subtleOrVelocity - If boolean: whether this is a subtle splash. If number: velocity value for scaling splash intensity
     */
    function createSplashEffect(instance, progressBarY, isInsideContainer, subtleOrVelocity) {
        // Determine if this is a subtle splash or velocity-based
        let subtle = false;
        let velocity = null;
        
        if (typeof subtleOrVelocity === 'boolean') {
            subtle = subtleOrVelocity;
        } else if (typeof subtleOrVelocity === 'number') {
            velocity = subtleOrVelocity;
        }
        const progressIconElement = instance.progressIconElement;
        const progressBarElement = instance.progressBarElement;
        
        if (!progressIconElement) {
            return;
        }

        // Get icon position - splash should appear 10px behind (to the left of) the icon
        const iconRect = progressIconElement.getBoundingClientRect();
        const iconX = iconRect.left + iconRect.width / 2;
        const splashOffsetX = -10; // 10px behind (to the left) of icon
        
        // Create splash container
        const splashContainer = document.createElement('div');
        splashContainer.className = 'api-progress-splash';
        
        // Calculate splash position based on container type
        if (isInsideContainer && instance.currentContainer) {
            // Inside container: use absolute positioning relative to container
            const containerRect = instance.currentContainer.getBoundingClientRect();
            const iconCenterX = iconRect.left - containerRect.left + iconRect.width / 2;
            const splashX = iconCenterX + splashOffsetX; // 10px behind icon
            const splashY = progressBarY - containerRect.top;
            
            splashContainer.style.position = 'absolute';
            splashContainer.style.left = splashX + 'px';
            splashContainer.style.top = splashY + 'px';
            splashContainer.style.transform = 'translate(-50%, -50%)';
            instance.currentContainer.appendChild(splashContainer);
        } else {
            // Fixed position: use fixed positioning relative to viewport
            const splashX = iconX + splashOffsetX; // 10px behind icon
            splashContainer.style.position = 'fixed';
            splashContainer.style.left = splashX + 'px';
            splashContainer.style.top = progressBarY + 'px'; // Splash at progress bar level
            splashContainer.style.transform = 'translate(-50%, -50%)';
            document.body.appendChild(splashContainer);
        }
        
        // Water droplet colors (blue/cyan tones)
        const dropletColors = [
            { inner: '#4fc3f7', outer: '#29b6f6' },
            { inner: '#81d4fa', outer: '#4fc3f7' },
            { inner: '#b3e5fc', outer: '#81d4fa' },
            { inner: '#e1f5fe', outer: '#b3e5fc' }
        ];
        
        // Adjust particle count based on velocity or subtle mode
        // Velocity scale: More aggressive scaling - velocity has bigger impact on splash size
        // Minimum: Always at least 2 droplets and 2 splash particles (never 0)
        let dropletCount, splashCount;
        if (velocity !== null) {
            // Scale based on velocity with more aggressive reduction
            // Use logarithmic-style scaling for more pronounced effect
            if (velocity > 15) {
                dropletCount = 12; // Full splash
                splashCount = 8;
            } else if (velocity > 8) {
                dropletCount = 8; // Large splash (reduced from 10)
                splashCount = 6; // Reduced from 7
            } else if (velocity > 4) {
                dropletCount = 5; // Medium splash (reduced from 7)
                splashCount = 4; // Reduced from 5
            } else if (velocity > 1) {
                dropletCount = 3; // Small splash (reduced from 4)
                splashCount = 2; // Reduced from 3
            } else {
                // Very slow or stopped - minimum splash (never 0)
                dropletCount = 2; // Minimum droplets
                splashCount = 2; // Minimum splash particles
            }
        } else {
            // Use subtle mode (boolean)
            dropletCount = subtle ? 6 : 12;
            splashCount = subtle ? 4 : 8;
        }
        
        // Create water droplet particles (upward and outward)
        for (let i = 0; i < dropletCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'api-progress-splash-particle droplet';
            
            // Random angle for droplet direction (more upward bias)
            const baseAngle = (Math.PI * 2 * i) / dropletCount;
            const angleVariation = Math.random() * 0.5 - 0.25;
            const angle = baseAngle + angleVariation;
            
            // More droplets go upward (negative y)
            // Scale distance based on velocity or subtle mode
            // More aggressive scaling with minimum distance (never 0)
            let distance;
            if (velocity !== null) {
                // Scale distance based on velocity with more aggressive reduction
                if (velocity > 15) {
                    distance = 15 + Math.random() * 25; // 15-40px (full)
                } else if (velocity > 8) {
                    distance = 10 + Math.random() * 15; // 10-25px (large, reduced from 12-30px)
                } else if (velocity > 4) {
                    distance = 6 + Math.random() * 10; // 6-16px (medium, reduced from 8-20px)
                } else if (velocity > 1) {
                    distance = 3 + Math.random() * 6; // 3-9px (small, reduced from 5-13px)
                } else {
                    // Very slow or stopped - minimum distance (never 0)
                    distance = 2 + Math.random() * 4; // 2-6px (minimum)
                }
            } else {
                // Use subtle mode (boolean)
                distance = subtle ? (8 + Math.random() * 12) : (15 + Math.random() * 25);
            }
            const x = Math.cos(angle) * distance;
            // Upward bias - most droplets go up
            const y = Math.sin(angle) * distance - (Math.random() * 10 + 5); // More negative = upward
            
            // Set CSS custom properties for animation
            particle.style.setProperty('--splash-x', x + 'px');
            particle.style.setProperty('--splash-y', y + 'px');
            
            // Random droplet color
            const dropletColor = dropletColors[Math.floor(Math.random() * dropletColors.length)];
            particle.style.setProperty('--droplet-color-inner', dropletColor.inner);
            particle.style.setProperty('--droplet-color-outer', dropletColor.outer);
            
            // Random delay for staggered effect
            particle.style.animationDelay = (Math.random() * 0.1) + 's';
            
            splashContainer.appendChild(particle);
        }
        
        // Create splash particles (spread outward)
        for (let i = 0; i < splashCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'api-progress-splash-particle splash';
            
            // Random angle for splash direction (outward spread)
            const angle = (Math.PI * 2 * i) / splashCount + (Math.random() * 0.8 - 0.4);
            // Scale distance based on velocity or subtle mode
            // More aggressive scaling with minimum distance (never 0)
            let distance;
            if (velocity !== null) {
                // Scale distance based on velocity with more aggressive reduction
                if (velocity > 15) {
                    distance = 10 + Math.random() * 20; // 10-30px (full)
                } else if (velocity > 8) {
                    distance = 7 + Math.random() * 12; // 7-19px (large, reduced from 8-23px)
                } else if (velocity > 4) {
                    distance = 4 + Math.random() * 7; // 4-11px (medium, reduced from 5-15px)
                } else if (velocity > 1) {
                    distance = 2 + Math.random() * 4; // 2-6px (small, reduced from 3-9px)
                } else {
                    // Very slow or stopped - minimum distance (never 0)
                    distance = 1 + Math.random() * 3; // 1-4px (minimum)
                }
            } else {
                // Use subtle mode (boolean)
                distance = subtle ? (5 + Math.random() * 10) : (10 + Math.random() * 20);
            }
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            // Set CSS custom properties
            particle.style.setProperty('--splash-x', x + 'px');
            particle.style.setProperty('--splash-y', y + 'px');
            
            // Random splash color
            const splashColor = dropletColors[Math.floor(Math.random() * dropletColors.length)];
            particle.style.setProperty('--droplet-color-inner', splashColor.inner);
            particle.style.setProperty('--droplet-color-outer', splashColor.outer);
            
            // Random delay
            particle.style.animationDelay = (Math.random() * 0.15) + 's';
            
            splashContainer.appendChild(particle);
        }
        
        // Remove splash container after animation completes
        setTimeout(function() {
            if (splashContainer && splashContainer.parentNode) {
                splashContainer.parentNode.removeChild(splashContainer);
            }
        }, 1600); // 1.5s animation + 0.1s buffer
    }

    /**
     * Trigger icon jump animation onto progress bar (like surfboard jumping onto wave)
     * @param {object} instance - Progress bar instance
     */
    function triggerIconJump(instance) {
        const progressIconElement = instance.progressIconElement;
        const progressBarElement = instance.progressBarElement;
        
        if (!progressIconElement || !instance.showIcon) {
            return;
        }

        // Get icon position preference
        const iconStartPosition = instance.iconStartPosition || 'bottom';
        
        // Set jump distance CSS variable for animation
        // Icon starts offset from progress bar (18px above/below), then jumps onto it
        const jumpDistance = 18; // Distance to jump (18px) - like surfboard jumping onto wave
        progressIconElement.style.setProperty('--jump-distance', jumpDistance + 'px');
        
        // Add jump animation class to trigger the jump animation
        progressIconElement.classList.add('icon-jumping');
        
        // For bottom position: trigger splash effect when jump animation completes (icon lands on progress bar)
        if (iconStartPosition === 'bottom' && instance.splashEnabled) {
            // Wait for jump animation to complete, then show splash
            setTimeout(function() {
                if (instance.splashEnabled) {
                    const progressBarRect = progressBarElement.getBoundingClientRect();
                    const progressBarY = progressBarRect.top + progressBarRect.height / 2;
                    const isInsideContainer = progressBarElement.classList.contains('inside-container');
                    createSplashEffect(instance, progressBarY, isInsideContainer);
                    instance.iconLanded = true; // Mark that icon has landed
                    instance.lastSplashTime = Date.now(); // Reset splash timer for continuous effects
                }
            }, 800); // Match animation duration (0.8s) - splash after icon lands
        }
        
        // Remove jump class after animation completes to allow bounce animation
        setTimeout(function() {
            if (progressIconElement) {
                progressIconElement.classList.remove('icon-jumping');
            }
        }, 800); // Match animation duration (0.8s)
    }

    /**
     * Stop the API progress bar
     * @param {string|object} idOrOptions - Progress bar instance ID (string) or options object
     *   - id: Progress bar instance ID (optional, defaults to 'default')
     *   - explode: boolean to show explosion effect before closing (optional, default: false)
     *   - celebrate: boolean to use celebration style instead of crash (optional, default: false, only used when explode: true)
     */
    function stop(idOrOptions) {
        // Handle parameter: can be string (id) or object (options)
        let id = defaultId;
        let explode = false;
        let celebrate = false;
        
        if (typeof idOrOptions === 'string') {
            // Legacy: simple string is id
            id = idOrOptions;
        } else if (typeof idOrOptions === 'object' && idOrOptions !== null) {
            // New: object with id, explode, and/or celebrate
            id = idOrOptions.id || defaultId;
            explode = idOrOptions.explode === true;
            celebrate = idOrOptions.celebrate === true;
        } else if (idOrOptions === undefined || idOrOptions === null) {
            // No parameter: use default
            id = defaultId;
        }
        
        const instance = progressBarInstances[id];
        
        if (!instance) {
            return; // Instance doesn't exist
        }

        // Initialize startCount if it doesn't exist (backward compatibility)
        if (typeof instance.startCount === 'undefined') {
            instance.startCount = 1; // Assume one start if undefined (legacy instance)
        }
        
        // Decrement start counter
        instance.startCount--;
        
        // Only stop if counter reaches 0 (all starts have been stopped)
        if (instance.startCount > 0) {
            // Still have active starts, don't stop yet
            return;
        }
        
        // Ensure counter doesn't go negative (safety check)
        if (instance.startCount < 0) {
            instance.startCount = 0;
        }

        const progressBarElement = instance.progressBarElement;
        const progressLineElement = instance.progressLineElement;
        const progressIconElement = instance.progressIconElement;

        // Clear animation
        if (instance.progressAnimation) {
            clearInterval(instance.progressAnimation);
            instance.progressAnimation = null;
        }

        // If explode option is enabled
        if (explode) {
            if (celebrate) {
                // Celebration: Move icon to end first, then celebrate
                // Complete the progress bar to 100%
                progressLineElement.style.width = '100%';
                
                // Move icon to end position if enabled
                if (instance.showIcon && progressIconElement) {
                    const isInsideContainer = progressBarElement.classList.contains('inside-container');
                    
                    if (isInsideContainer) {
                        // Inside container: move to 100%
                        progressIconElement.style.left = '100%';
                    } else {
                        // Fixed position: move to viewport width
                        const viewportWidth = window.innerWidth;
                        progressIconElement.style.left = viewportWidth + 'px';
                    }
                    
                    // Wait for icon to reach end, then hide icon and celebrate
                    setTimeout(function() {
                        // Hide icon just before explosion
                        if (progressIconElement) {
                            progressIconElement.classList.add('hidden');
                        }
                        createExplosion(instance, celebrate, function() {
                            // Hide after celebration completes
                            hideProgressBar(instance, id);
                        });
                    }, 400); // Wait for icon to reach end (matches transition duration)
                } else {
                    // No icon, just celebrate immediately
                    createExplosion(instance, celebrate, function() {
                        // Hide after celebration completes
                        hideProgressBar(instance, id);
                    });
                }
            } else {
                // Crash: Stop icon where it is, then crash explode
                // Don't move progress bar to 100%, keep it at current position
                // Get current progress width
                const currentWidth = progressLineElement.offsetWidth;
                const containerWidth = progressBarElement.offsetWidth || window.innerWidth;
                const currentPercent = (currentWidth / containerWidth) * 100;
                
                // Stop progress bar at current position
                progressLineElement.style.width = currentPercent + '%';
                
                // Icon stays at current position (no need to move it)
                // Hide icon just before crash explosion
                if (instance.showIcon && progressIconElement) {
                    progressIconElement.classList.add('hidden');
                }
                // Show crash explosion immediately at icon's current position
                createExplosion(instance, celebrate, function() {
                    // Hide after crash explosion completes
                    hideProgressBar(instance, id);
                });
            }
        } else {
            // No explosion: Complete progress bar and hide
            progressLineElement.style.width = '100%';
            
            // Move icon to end if enabled
            if (instance.showIcon && progressIconElement) {
                const isInsideContainer = progressBarElement.classList.contains('inside-container');
                
                if (isInsideContainer) {
                    progressIconElement.style.left = '100%';
                } else {
                    const viewportWidth = window.innerWidth;
                    progressIconElement.style.left = viewportWidth + 'px';
                }
            }
            
            // Hide after a short delay (no explosion)
            setTimeout(function() {
                hideProgressBar(instance, id);
            }, 300);
        }
    }

    /**
     * Create explosion effect at the progress bar tip
     * @param {object} instance - Progress bar instance
     * @param {boolean} celebrate - Use celebration style (true) or crash style (false)
     * @param {function} callback - Callback to execute after explosion completes
     */
    function createExplosion(instance, celebrate, callback) {
        const progressBarElement = instance.progressBarElement;
        const progressLineElement = instance.progressLineElement;
        const progressIconElement = instance.progressIconElement;
        
        // Get the position of the progress bar tip
        const isInsideContainer = progressBarElement.classList.contains('inside-container');
        const progressBarRect = progressBarElement.getBoundingClientRect();
        const progressLineRect = progressLineElement.getBoundingClientRect();
        
        // Calculate explosion position (at the tip of the progress bar)
        let explosionX, explosionY;
        
        if (isInsideContainer) {
            // Inside container: use percentage-based position
            const progressWidth = progressLineRect.width;
            explosionX = progressLineRect.left + progressWidth;
            explosionY = progressLineRect.top + progressLineRect.height / 2;
        } else {
            // Fixed position: use viewport-based position
            const progressWidth = progressLineRect.width;
            explosionX = progressLineRect.left + progressWidth;
            explosionY = progressBarRect.top + progressBarRect.height / 2;
        }
        
        // Create explosion container
        const explosionContainer = document.createElement('div');
        explosionContainer.className = 'api-progress-explosion';
        explosionContainer.style.position = 'fixed';
        explosionContainer.style.left = explosionX + 'px';
        explosionContainer.style.top = explosionY + 'px';
        explosionContainer.style.transform = 'translate(-50%, -50%)';
        document.body.appendChild(explosionContainer);
        
        if (celebrate) {
            // Create celebration explosion particles (sparkles)
            createCelebrationExplosion(explosionContainer, callback);
        } else {
            // Create crash explosion particles (fire, smoke, debris)
            createCrashExplosion(explosionContainer, callback);
        }
    }

    /**
     * Create celebration pop-up effect (sparkles)
     * @param {HTMLElement} explosionContainer - Container element for particles
     * @param {function} callback - Callback to execute after animation completes
     */
    function createCelebrationExplosion(explosionContainer, callback) {
        const particleCount = 16; // More particles for richer effect
        const colors = ['#00aaff', '#44ccff', '#ff7700', '#ffaa00', '#ffffff', '#ffcc44', '#ffdd88', '#aaffff', '#ff99cc', '#99ff99'];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'api-progress-explosion-particle celebration';
            
            // Create more upward and gentle spread pattern (less explosive, more celebratory)
            // Particles prefer to go upward and outward with gentle spread
            const baseAngle = (Math.PI * 2 * i) / particleCount;
            const angleVariation = Math.random() * 0.6 - 0.3; // Smaller variation for gentler spread
            const angle = baseAngle + angleVariation;
            
            // Distance: shorter for more compact, gentle pop-up effect
            // Make some particles go more upward (y is more negative)
            const horizontalDistance = (20 + Math.random() * 30) * Math.abs(Math.cos(angle)); // 20-50px horizontal
            const verticalDistance = (15 + Math.random() * 25) * Math.abs(Math.sin(angle)); // 15-40px vertical, but prefer upward
            
            // Adjust for upward bias - particles should pop up more than spread out
            const x = Math.cos(angle) * horizontalDistance;
            // Make upward movement more prominent (negative y = upward)
            const y = Math.sin(angle) * verticalDistance - (Math.random() * 10 + 5); // Extra upward bias
            
            // Set CSS custom property for animation
            particle.style.setProperty('--explode-x', x + 'px');
            particle.style.setProperty('--explode-y', y + 'px');
            
            // Random color from celebration colors
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.style.backgroundColor = color;
            particle.style.boxShadow = `0 0 8px ${color}, 0 0 16px ${color}`;
            
            // Random size variation (slightly larger for better visibility)
            const size = 4 + Math.random() * 4;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';
            
            // Staggered delay for cascading pop-up effect
            particle.style.animationDelay = (Math.random() * 0.15) + 's';
            
            explosionContainer.appendChild(particle);
        }
        
        // Remove explosion container after animation completes
        setTimeout(function() {
            if (explosionContainer && explosionContainer.parentNode) {
                explosionContainer.parentNode.removeChild(explosionContainer);
            }
            if (callback) {
                callback();
            }
        }, 2700); // 2.5s animation + 0.2s buffer
    }

    /**
     * Create crash explosion (fire, smoke, debris)
     * @param {HTMLElement} explosionContainer - Container element for particles
     * @param {function} callback - Callback to execute after explosion completes
     */
    function createCrashExplosion(explosionContainer, callback) {
        const fireCount = 8;
        const smokeCount = 6;
        const debrisCount = 10;
        
        // Fire colors (orange to red)
        const fireColors = [
            { inner: '#ff6b00', outer: '#ff4400' },
            { inner: '#ff8800', outer: '#ff6600' },
            { inner: '#ffaa00', outer: '#ff7700' },
            { inner: '#ff4400', outer: '#cc2200' }
        ];
        
        // Smoke colors (gray to black)
        const smokeColors = [
            { inner: '#666666', outer: '#333333' },
            { inner: '#888888', outer: '#444444' },
            { inner: '#555555', outer: '#222222' },
            { inner: '#444444', outer: '#111111' }
        ];
        
        // Debris colors (dark gray, brown, black)
        const debrisColors = ['#333333', '#444444', '#555555', '#2a2a2a', '#1a1a1a', '#3d2914'];
        
        // Create fire particles (fast, bright, orange/red)
        for (let i = 0; i < fireCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'api-progress-explosion-particle fire';
            
            // Random angle for particle direction (more concentrated burst)
            const angle = (Math.PI * 2 * i) / fireCount + (Math.random() * 0.8 - 0.4);
            const distance = 25 + Math.random() * 35; // Distance 25-60px
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            // Set CSS custom properties for animation
            particle.style.setProperty('--explode-x', x + 'px');
            particle.style.setProperty('--explode-y', y + 'px');
            
            // Random fire color
            const fireColor = fireColors[Math.floor(Math.random() * fireColors.length)];
            particle.style.setProperty('--particle-color-inner', fireColor.inner);
            particle.style.setProperty('--particle-color-outer', fireColor.outer);
            
            // Random delay for staggered effect
            particle.style.animationDelay = (Math.random() * 0.1) + 's';
            
            explosionContainer.appendChild(particle);
        }
        
        // Create smoke particles (slow, large, gray)
        for (let i = 0; i < smokeCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'api-progress-explosion-particle smoke';
            
            // Random angle, more spread out
            const angle = (Math.PI * 2 * i) / smokeCount + (Math.random() * 1.0 - 0.5);
            const distance = 20 + Math.random() * 30; // Distance 20-50px (shorter than fire)
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            // Set CSS custom properties
            particle.style.setProperty('--explode-x', x + 'px');
            particle.style.setProperty('--explode-y', y + 'px');
            
            // Random smoke color
            const smokeColor = smokeColors[Math.floor(Math.random() * smokeColors.length)];
            particle.style.setProperty('--particle-color-inner', smokeColor.inner);
            particle.style.setProperty('--particle-color-outer', smokeColor.outer);
            
            // Random delay
            particle.style.animationDelay = (Math.random() * 0.15) + 's';
            
            explosionContainer.appendChild(particle);
        }
        
        // Create debris particles (small, dark, fast)
        for (let i = 0; i < debrisCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'api-progress-explosion-particle debris';
            
            // Random angle, full 360 spread
            const angle = (Math.PI * 2 * i) / debrisCount + (Math.random() * 1.2 - 0.6);
            const distance = 35 + Math.random() * 45; // Distance 35-80px
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            // Set CSS custom properties
            particle.style.setProperty('--explode-x', x + 'px');
            particle.style.setProperty('--explode-y', y + 'px');
            
            // Random debris color
            const debrisColor = debrisColors[Math.floor(Math.random() * debrisColors.length)];
            particle.style.setProperty('--particle-color', debrisColor);
            
            // Random delay
            particle.style.animationDelay = (Math.random() * 0.1) + 's';
            
            explosionContainer.appendChild(particle);
        }
        
        // Remove explosion container after animation completes
        setTimeout(function() {
            if (explosionContainer && explosionContainer.parentNode) {
                explosionContainer.parentNode.removeChild(explosionContainer);
            }
            if (callback) {
                callback();
            }
        }, 3700); // 3.5s animation (smoke is longest) + 0.2s buffer
    }

    /**
     * Hide the progress bar and clean up
     * @param {object} instance - Progress bar instance
     * @param {string} id - Progress bar instance ID
     */
    function hideProgressBar(instance, id) {
        const progressBarElement = instance.progressBarElement;
        const progressLineElement = instance.progressLineElement;
        
        if (progressBarElement && progressBarInstances[id]) {
            progressBarElement.classList.remove('active');
            progressBarElement.style.display = 'none';
            progressLineElement.style.width = '0%';
            // Hide icon as well
            if (instance.progressIconElement) {
                instance.progressIconElement.classList.add('hidden');
            }
        }
    }

    /**
     * Reset the progress bar (stop and reset to initial state)
     * @param {string} id - Progress bar instance ID (optional, defaults to 'default')
     */
    function reset(id) {
        id = id || defaultId;
        const instance = progressBarInstances[id];
        if (instance) {
            // Reset the counter to force immediate stop
            instance.startCount = 0;
        }
        stop(id);
        if (instance) {
            instance.progressBarElement.classList.remove('active');
            instance.progressLineElement.style.width = '0%';
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export public API
    window.ProgressBar = {
        start: start,
        stop: stop,
        reset: reset,
        setContainer: setContainer,
        setPosition: setPosition,
        init: init
    };

})();

