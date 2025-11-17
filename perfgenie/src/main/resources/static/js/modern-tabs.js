/*
 * Modern Tabs Component - Reusable JavaScript
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Initialize modern tabs component
 * @param {string|HTMLElement} containerSelector - CSS selector or DOM element for the tabs container
 * @param {Object} options - Configuration options
 * @param {string} options.urlParam - URL parameter name to read initial tab from (default: null)
 * @param {boolean|string} options.hashParam - If true, check URL hash for initial tab (default: true if no urlParam). If string, treat hash as URLSearchParams with this key.
 * @param {string} options.initialTab - Explicit initial tab ID to activate (overrides URL param/hash)
 * @param {Function} options.onTabChange - Callback function called when tab changes (receives tabId)
 * @param {Function} options.onTabActivate - Callback function called when tab is activated (receives tabId, panelElement)
 * @param {Function} options.getUrlParameter - Custom function to get URL parameter (default: uses window.location.search)
 * @param {Function} options.updateUrl - Custom function to update URL (default: no-op)
 * @returns {Object} - Tabs API object with methods: switchTab(tabId), getActiveTabId()
 */
function initModernTabs(containerSelector, options) {
    // Validate containerSelector first
    if (!containerSelector) {
        console.error('[ModernTabs Component] ERROR: containerSelector is missing or undefined!', {
            containerSelector: containerSelector,
            type: typeof containerSelector,
            stack: new Error().stack
        });
        return null;
    }
    
    options = options || {};
    
    // Get container element
    const container = typeof containerSelector === 'string' 
        ? document.querySelector(containerSelector)
        : containerSelector;
    
    if (!container) {
        console.warn('[ModernTabs Component] Container not found:', containerSelector);
        return null;
    }
    
    // Generate instance ID for this tabs instance (for debugging and isolation)
    const instanceId = (container.id || 'tabs') + '-' + Math.random().toString(36).substr(2, 9);
    container._modernTabsInstanceId = instanceId;
    
    // Make isUpdatingHash instance-specific
    container._isUpdatingHash = false;
    
    // Scoped query selectors within container
    const tabButtons = container.querySelectorAll('.modern-tabs-nav-button');
    const tabPanels = container.querySelectorAll('.modern-tab-panel');
    
    if (tabButtons.length === 0 || tabPanels.length === 0) {
        console.warn('[ModernTabs Component] [' + instanceId + '] Tab buttons or panels not found in container:', containerSelector);
        return null;
    }
    
    // Helper function to get URL parameter
    const getUrlParam = options.getUrlParameter || function(paramName) {
        try {
            if (typeof window.urlParams !== 'undefined') {
                return window.urlParams.get(paramName);
            }
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(paramName);
        } catch(e) {
            // Fallback for older browsers
            const url = window.location.search.substring(1);
            const urlVars = url.split('&');
            for (let i = 0; i < urlVars.length; i++) {
                const param = urlVars[i].split('=');
                if (param[0] === paramName) {
                    return decodeURIComponent(param[1]);
                }
            }
            return null;
        }
    };
    
    // Helper function to update URL
    const updateUrlParam = options.updateUrl || function(paramName, value) {
        // Default no-op - can be overridden
    };
    
    // Flag to prevent hashchange handler from reacting to our own hash updates (instance-specific)
    const isUpdatingHash = function() {
        return container._isUpdatingHash || false;
    };
    const setIsUpdatingHash = function(value) {
        container._isUpdatingHash = value;
    };
    
    /**
     * Switch to a specific tab
     * @param {string} tabId - The ID of the tab panel to show
     * @param {boolean} skipHashUpdate - If true, skip updating URL hash (used for default first tab)
     */
    function switchTab(tabId, skipHashUpdate) {
        console.log('[ModernTabs Component] [' + instanceId + '] switchTab ENTRY:', {
            tabId: tabId,
            skipHashUpdate: skipHashUpdate,
            containerId: container.id,
            tabIdType: typeof tabId,
            tabIdTruthy: !!tabId
        });
        
        if (!tabId) {
            console.warn('[ModernTabs Component] [' + instanceId + '] switchTab called without tabId');
            return;
        }
        
        // Re-query buttons and panels from container to get fresh references (in case DOM changed)
        const currentTabButtons = container.querySelectorAll('.modern-tabs-nav-button');
        const currentTabPanels = container.querySelectorAll('.modern-tab-panel');
        
        console.log('[ModernTabs Component] [' + instanceId + '] switchTab DOM query:', {
            buttonsFound: currentTabButtons.length,
            panelsFound: currentTabPanels.length,
            searchingForTabId: tabId,
            buttonIds: Array.from(currentTabButtons).map(btn => {
                return btn.getAttribute('href')?.substring(1) || btn.getAttribute('data-tab-target');
            }),
            panelIds: Array.from(currentTabPanels).map(panel => panel.id)
        });
        
        // Remove active class from all buttons and panels
        currentTabButtons.forEach(btn => {
            if (btn) {
                btn.classList.remove('active');
                // Force remove any inline styles that might override
                btn.style.backgroundColor = '';
                btn.style.background = '';
                btn.style.backgroundImage = '';
                btn.style.color = '';
                btn.style.boxShadow = '';
                btn.style.border = '';
                btn.style.borderRadius = '';
                btn.style.backdropFilter = '';
                btn.style.webkitBackdropFilter = '';
                btn.style.fontWeight = '';
                btn.style.textShadow = '';
            }
        });
        currentTabPanels.forEach(panel => {
            if (panel) panel.classList.remove('active');
        });
        
        // Find and activate the target tab button
        let buttonFound = false;
        currentTabButtons.forEach(button => {
            if (!button) return;
            const targetId = button.getAttribute('href')?.substring(1) || 
                           button.getAttribute('data-tab-target');
            if (targetId === tabId) {
                button.classList.add('active');
                // Force apply iPhone 16 glassmorphism style via inline style as backup
                button.style.background = 'rgba(90, 159, 212, 0.25)';
                button.style.backgroundImage = 'linear-gradient(135deg, rgba(90, 159, 212, 0.3) 0%, rgba(127, 192, 232, 0.2) 50%, rgba(90, 159, 212, 0.3) 100%), linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)';
                button.style.backdropFilter = 'blur(20px) saturate(180%)';
                button.style.webkitBackdropFilter = 'blur(20px) saturate(180%)';
                button.style.border = '1px solid rgba(255, 255, 255, 0.5)';
                button.style.borderRadius = '8px';
                button.style.boxShadow = '0 4px 16px rgba(90, 159, 212, 0.4), 0 2px 8px rgba(90, 159, 212, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1px 0 rgba(0, 0, 0, 0.1)';
                button.style.color = '#ffffff';
                button.style.fontWeight = '700';
                button.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3), 0 0 8px rgba(90, 159, 212, 0.5), 0 2px 4px rgba(0, 0, 0, 0.2)';
                buttonFound = true;
            }
        });
        
        // Activate the target panel
        const targetPanel = document.getElementById(tabId);
        console.log('[ModernTabs Component] [' + instanceId + '] switchTab panel activation:', {
            tabId: tabId,
            targetPanelFound: !!targetPanel,
            targetPanelId: targetPanel ? targetPanel.id : 'null',
            targetPanelInContainer: targetPanel ? container.contains(targetPanel) : false,
            buttonFound: buttonFound
        });
        
        if (targetPanel) {
            targetPanel.classList.add('active');
            console.log('[ModernTabs Component] [' + instanceId + '] Activated panel:', tabId);
        } else {
            console.warn('[ModernTabs Component] [' + instanceId + '] Tab panel not found:', tabId);
        }
        
        if (!buttonFound) {
            console.warn('[ModernTabs Component] [' + instanceId + '] Tab button not found for:', tabId);
        } else {
            console.log('[ModernTabs Component] [' + instanceId + '] Activated button for:', tabId);
        }
        
        // Call onTabChange callback
        if (options.onTabChange && typeof options.onTabChange === 'function') {
            setTimeout(() => options.onTabChange(tabId), 0);
        }
        
        // Trigger activate event
        const event = new CustomEvent('tabActivate', {
            detail: {
                newTab: tabId,
                newPanel: targetPanel
            }
        });
        container.dispatchEvent(event);
        
        // Call onTabActivate callback
        if (options.onTabActivate && typeof options.onTabActivate === 'function') {
            setTimeout(() => options.onTabActivate(tabId, targetPanel), 0);
        }
        
        // Automatically update URL hash when tab is switched programmatically (jQuery UI tabs behavior)
        // Skip hash update if skipHashUpdate is true (used for default first tab on initial load)
        // Only update hash if:
        // - skipHashUpdate is not true, AND
        // - hashParam is not explicitly false, AND
        // - urlParam is not provided (if urlParam is provided, it takes precedence)
        if (!skipHashUpdate && !options.urlParam && options.hashParam !== false) {
            // Check if hash needs updating (only if different from current hash)
            const currentHash = window.location.hash.substring(1);
            if (currentHash !== tabId) {
                // Set flag to prevent hashchange handler from reacting
                setIsUpdatingHash(true);
                // Update URL hash without triggering page scroll
                if (window.history && window.history.replaceState) {
                    const newUrl = window.location.pathname + window.location.search + '#' + tabId;
                    window.history.replaceState(null, '', newUrl);
                } else {
                    // Fallback for older browsers
                    window.location.hash = tabId;
                }
                // Reset flag after a short delay (hashchange fires asynchronously)
                setTimeout(() => {
                    setIsUpdatingHash(false);
                }, 0);
            }
        }
    }
    
    /**
     * Get currently active tab ID
     * @returns {string|null} - The ID of the active tab panel or null if none
     */
    function getActiveTabId() {
        const activePanel = container.querySelector('.modern-tab-panel.active');
        return activePanel ? activePanel.id : null;
    }
    
    // Determine which tab to activate on initialization
    // Priority: initialTab > urlParam > hash (default, like jQuery UI) > first tab
    let tabToActivate = null;
    
    // Helper function to validate that a tab exists within this container
    const isValidTabInContainer = function(tabId) {
        if (!tabId) return false;
        const targetPanel = document.getElementById(tabId);
        // Check if panel exists AND is within this container
        return targetPanel && container.contains(targetPanel);
    };
    
    // 1. Check options.initialTab if provided (highest priority - explicit override)
    if (options.initialTab) {
        if (isValidTabInContainer(options.initialTab)) {
            tabToActivate = options.initialTab;
        } else {
            console.warn('[ModernTabs] Initial tab specified in options not found in this container:', options.initialTab);
        }
    }
    
    // 2. Check URL parameter if urlParam option is provided
    if (!tabToActivate && options.urlParam) {
        const urlTabId = getUrlParam(options.urlParam);
        if (urlTabId) {
            // Validate that the tab exists in this container
            if (isValidTabInContainer(urlTabId)) {
                tabToActivate = urlTabId;
            } else {
                console.warn('[ModernTabs] Tab from URL parameter not found in this container:', urlTabId);
            }
        }
    }
    
    // 3. Check URL hash (default behavior like jQuery UI tabs)
    // Only check hash if:
    // - hashParam is not explicitly false, AND
    // - urlParam is not provided (if urlParam is provided, it takes precedence unless hashParam is explicitly true)
    if (!tabToActivate) {
        const shouldCheckHash = options.hashParam !== false && 
                               (options.hashParam === true || !options.urlParam);
        
        if (shouldCheckHash) {
            // Check URL hash (jQuery UI tabs default behavior)
            const hash = window.location.hash;
            if (hash && hash.length > 1) {
                const hashTabId = hash.substring(1);
                // Validate that the tab exists in this container
                if (isValidTabInContainer(hashTabId)) {
                    tabToActivate = hashTabId;
                }
            }
        } else if (options.hashParam && typeof options.hashParam === 'string') {
            // Custom hash parameter name (e.g., if hash contains something like #tab=zing)
            // This is for future extensibility
            const hash = window.location.hash;
            if (hash && hash.length > 1) {
                const hashParams = new URLSearchParams(hash.substring(1));
                const hashTabId = hashParams.get(options.hashParam);
                if (hashTabId) {
                    // Validate that the tab exists in this container
                    if (isValidTabInContainer(hashTabId)) {
                        tabToActivate = hashTabId;
                    }
                }
            }
        }
    }
    
    // Set first tab as active by default if none is active and no URL parameter/hash
    const hasActive = Array.from(tabButtons).some(btn => btn.classList.contains('active'));
    const hasActivePanel = Array.from(tabPanels).some(panel => panel.classList.contains('active'));
    console.log('[ModernTabs Component] Tab activation decision:', {
        hasActiveButton: hasActive,
        hasActivePanel: hasActivePanel,
        hasActive: hasActive || hasActivePanel,
        tabButtonsCount: tabButtons.length,
        tabPanelsCount: tabPanels.length,
        tabToActivate: tabToActivate,
        firstTabId: tabPanels[0]?.id,
        firstPanelElement: tabPanels[0]
    });
    
    if (!hasActive && tabButtons.length > 0 && tabPanels.length > 0) {
        if (tabToActivate) {
            console.log('[ModernTabs Component] Activating tab from URL/hash/options:', tabToActivate);
            // Activate tab from URL parameter, hash, or initialTab option
            switchTab(tabToActivate);
            // Update URL if updateUrl is provided and urlParam is set
            if (options.urlParam && updateUrlParam) {
                updateUrlParam(options.urlParam, tabToActivate);
            }
        } else {
            // Default to first tab - use switchTab to ensure consistency
            // Skip hash update when defaulting to first tab (don't add hash if URL has none)
            const firstTabId = tabPanels[0]?.id;
            console.log('[ModernTabs Component] No tab to activate from URL/hash/options, defaulting to first tab:', {
                firstTabId: firstTabId,
                firstPanelElement: tabPanels[0],
                willCallSwitchTab: !!firstTabId,
                skipHashUpdate: true
            });
            if (firstTabId) {
                switchTab(firstTabId, true); // Pass true to skip hash update
            } else {
                console.warn('[ModernTabs Component] First tab panel has no ID, cannot activate');
            }
        }
    } else if (tabToActivate && !hasActive) {
        console.log('[ModernTabs Component] Tab to activate exists but no active tab yet:', tabToActivate);
        // URL parameter/hash/initialTab exists but no tab is active yet
        switchTab(tabToActivate);
        if (options.urlParam && updateUrlParam) {
            updateUrlParam(options.urlParam, tabToActivate);
        }
    } else {
        console.log('[ModernTabs Component] Tab activation skipped:', {
            reason: hasActive ? 'Tab already active' : (tabButtons.length === 0 ? 'No tab buttons' : 'No tab panels'),
            hasActive: hasActive,
            tabButtonsCount: tabButtons.length,
            tabPanelsCount: tabPanels.length
        });
    }
    
    // Add click handlers to tab buttons
    // Use event delegation on the container to handle clicks (more reliable than cloning)
    container.addEventListener('click', function(e) {
        // Check if the clicked element is a tab button or inside one
        const button = e.target.closest('.modern-tabs-nav-button');
        if (!button) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Get target ID from the button
        const clickedTargetId = button.getAttribute('href')?.substring(1) || 
                              button.getAttribute('data-tab-target');
        
        if (!clickedTargetId) {
            console.warn('[ModernTabs] No target ID found for tab button', button);
            return;
        }
        
        // Switch to the selected tab
        // Note: switchTab will automatically update the hash if hashParam is enabled
        switchTab(clickedTargetId);
        
        // Update URL if urlParam option is provided
        if (options.urlParam && updateUrlParam) {
            updateUrlParam(options.urlParam, clickedTargetId);
        }
        // Hash is automatically updated by switchTab, so no need to update here
    });
    
    // Listen for hash changes (browser back/forward, external hash changes)
    // Only listen if hashParam is not false and urlParam is not provided
    if (!options.urlParam && options.hashParam !== false) {
        const handleHashChange = function() {
            // Ignore hash changes that we triggered ourselves
            if (isUpdatingHash()) {
                return;
            }
            
            const hash = window.location.hash;
            if (hash && hash.length > 1) {
                const hashTabId = hash.substring(1);
                // Validate that the tab exists
                const targetPanel = document.getElementById(hashTabId);
                if (targetPanel && container.contains(targetPanel)) {
                    // Only switch if it's different from current active tab
                    const currentActiveId = getActiveTabId();
                    if (currentActiveId !== hashTabId) {
                        switchTab(hashTabId);
                    }
                }
            } else {
                // If hash is empty, activate first tab
                const currentActiveId = getActiveTabId();
                if (!currentActiveId && tabPanels.length > 0) {
                    const firstTabId = tabPanels[0]?.id;
                    if (firstTabId) {
                        switchTab(firstTabId);
                    }
                }
            }
        };
        
        // Listen for hashchange events
        window.addEventListener('hashchange', handleHashChange);
        
        // Store cleanup function on container for potential future use
        container._hashChangeHandler = handleHashChange;
    }
    
    // Return API object
    return {
        switchTab: switchTab,
        getActiveTabId: getActiveTabId,
        container: container
    };
}

// Explicitly assign to window for global access
if (typeof window !== 'undefined') {
    window.initModernTabs = initModernTabs;
}

