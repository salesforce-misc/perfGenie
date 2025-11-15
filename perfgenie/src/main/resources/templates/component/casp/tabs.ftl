<style>
    /*
    * Copyright (c) 2022, Salesforce.com, Inc.
    * All rights reserved.
    * SPDX-License-Identifier: BSD-3-Clause
    * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
    */
    
    /* Override any jQuery UI styles */
    #tabs.ui-tabs,
    #tabs.ui-widget,
    #tabs.ui-widget-content {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
    }
    
    #tabs .ui-tabs-nav,
    #tabs ul.ui-tabs-nav {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
    }
    
    /* Modern Flex-based Tab Container - Transparent Background */
    .modern-tabs-container,
    #tabs.modern-tabs-container {
        display: flex !important;
        flex-direction: column;
        width: 100%;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
    }
    
    /* Feature Card Selection - No Tab Appearance */
    .modern-tabs-nav,
    #tabs .modern-tabs-nav,
    #tabs ul.modern-tabs-nav {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 24px;
        margin: 0 0 40px 0 !important;
        padding: 0 !important;
        list-style: none !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
    }
    
    /* Individual Feature Card */
    .modern-tabs-nav-item,
    #tabs .modern-tabs-nav-item,
    #tabs ul li.modern-tabs-nav-item {
        margin: 0 !important;
        padding: 0 !important;
        list-style: none !important;
        background: transparent !important;
        border: none !important;
        float: none !important;
    }
    
    .modern-tabs-nav-button,
    #tabs .modern-tabs-nav-button,
    #tabs a.modern-tabs-nav-button {
        display: block !important;
        padding: 0 !important;
        background: #ffffff !important;
        border: none !important;
        border-radius: 20px !important;
        color: #1e293b !important;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        text-decoration: none !important;
        box-sizing: border-box;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
        position: relative;
        overflow: hidden;
        width: 100% !important;
        float: none !important;
        margin: 0 !important;
    }
    
    /* Card Header Section */
    .modern-tabs-nav-button .card-header {
        padding: 32px 32px 24px 32px;
        background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
        border-bottom: none;
    }
    
    .modern-tabs-nav-button .card-title {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 8px 0;
        line-height: 1.3;
    }
    
    .modern-tabs-nav-button .card-description {
        font-size: 14px;
        color: #64748b;
        margin: 0;
        line-height: 1.5;
    }
    
    /* Card Footer Section */
    .modern-tabs-nav-button .card-footer {
        padding: 20px 32px;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .modern-tabs-nav-button .card-action {
        font-size: 14px;
        font-weight: 600;
        color: #3b82f6;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .modern-tabs-nav-button .card-action::after {
        content: '→';
        font-size: 18px;
        transition: transform 0.3s ease;
    }
    
    /* Hover State */
    .modern-tabs-nav-button:hover {
        border: none;
        box-shadow: 0 12px 32px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-6px);
    }
    
    .modern-tabs-nav-button:hover .card-header {
        background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
    }
    
    .modern-tabs-nav-button:hover .card-action::after {
        transform: translateX(4px);
    }
    
    /* Active State */
    .modern-tabs-nav-button.active {
        border: none;
        box-shadow: 0 16px 40px rgba(59, 130, 246, 0.3), 0 8px 16px rgba(0, 0, 0, 0.12);
        transform: translateY(-6px);
    }
    
    .modern-tabs-nav-button.active .card-header {
        background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 50%, #f8fafc 100%);
    }
    
    .modern-tabs-nav-button.active .card-title {
        color: #1e40af;
    }
    
    .modern-tabs-nav-button.active .card-action {
        color: #1e40af;
    }
    
    /* Active Badge */
    .modern-tabs-nav-button.active::before {
        content: 'Selected';
        position: absolute;
        top: 20px;
        right: 20px;
        padding: 6px 12px;
        background: #3b82f6;
        color: white;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
    }
    
    /* Tab Content Container */
    .modern-tabs-content {
        display: flex;
        flex-direction: column;
        width: 100%;
        position: relative;
    }
    
    /* Individual Tab Panel */
    .modern-tab-panel {
        display: none;
        width: 100%;
        padding: 0;
        animation: fadeIn 0.2s ease-in;
    }
    
    .modern-tab-panel.active {
        display: block;
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    /* Modern Accordion Styles */
    .modern-accordion {
        display: flex;
        flex-direction: column;
        width: 100%;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #ffffff;
        margin-bottom: 16px;
        overflow: hidden;
    }
    
    .modern-accordion-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        cursor: pointer;
        user-select: none;
        transition: background-color 0.2s ease;
        font-weight: 500;
        color: #374151;
    }
    
    .modern-accordion-header:hover {
        background: #f3f4f6;
    }
    
    .modern-accordion-header.active {
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .modern-accordion-icon {
        transition: transform 0.2s ease;
        color: #6b7280;
        font-size: 12px;
    }
    
    .modern-accordion-header.active .modern-accordion-icon {
        transform: rotate(180deg);
    }
    
    .modern-accordion-content {
        display: none;
        padding: 16px;
        background: #ffffff;
        animation: slideDown 0.2s ease-out;
    }
    
    .modern-accordion-content.active {
        display: block;
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            max-height: 0;
        }
        to {
            opacity: 1;
            max-height: 1000px;
        }
    }
</style>

<script>
    /*
    * Copyright (c) 2022, Salesforce.com, Inc.
    * All rights reserved.
    * SPDX-License-Identifier: BSD-3-Clause
    * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
    */
    
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize modern tabs
        initModernTabs();
        
        // Initialize modern accordion
        initModernAccordion();
    });
    
    /**
     * Initialize modern flex-based tabs
     */
    function initModernTabs() {
        const tabButtons = document.querySelectorAll('.modern-tabs-nav-button');
        const tabPanels = document.querySelectorAll('.modern-tab-panel');
        
        // Set first tab as active by default
        if (tabButtons.length > 0 && tabPanels.length > 0) {
            tabButtons[0].classList.add('active');
            tabPanels[0].classList.add('active');
        }
        
        // Add click handlers to tab buttons
        tabButtons.forEach((button, index) => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Get target panel ID from href or data attribute
                const targetId = this.getAttribute('href')?.substring(1) || 
                                this.getAttribute('data-tab-target') ||
                                tabPanels[index]?.id;
                
                // Switch to the selected tab
                switchTab(targetId);
                
                // Trigger activate event (similar to jQuery UI tabs activate)
                const event = new CustomEvent('tabActivate', {
                    detail: {
                        newTab: targetId,
                        newPanel: document.getElementById(targetId)
                    }
                });
                document.getElementById('tabs').dispatchEvent(event);
            });
        });
    }
    
    /**
     * Switch to a specific tab
     * @param {string} tabId - The ID of the tab panel to show
     */
    function switchTab(tabId) {
        const tabButtons = document.querySelectorAll('.modern-tabs-nav-button');
        const tabPanels = document.querySelectorAll('.modern-tab-panel');
        
        // Remove active class from all buttons and panels
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));
        
        // Find and activate the target tab button
        tabButtons.forEach(button => {
            const targetId = button.getAttribute('href')?.substring(1) || 
                           button.getAttribute('data-tab-target');
            if (targetId === tabId) {
                button.classList.add('active');
            }
        });
        
        // Activate the target panel
        const targetPanel = document.getElementById(tabId);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
    }
    
    /**
     * Initialize modern accordion
     */
    function initModernAccordion() {
        const accordionHeader = document.getElementById('dataview-header');
        const accordionContent = document.getElementById('dataview-content');
        
        if (accordionHeader && accordionContent) {
            // Start collapsed (active: false equivalent)
            accordionContent.classList.remove('active');
            
            accordionHeader.addEventListener('click', function() {
                const isActive = accordionContent.classList.contains('active');
                
                if (isActive) {
                    accordionContent.classList.remove('active');
                    accordionHeader.classList.remove('active');
                } else {
                    accordionContent.classList.add('active');
                    accordionHeader.classList.add('active');
                }
            });
        }
    }
    
    /**
     * Public API: Get currently active tab ID (for compatibility with existing code)
     */
    function getActiveTabId() {
        const activePanel = document.querySelector('.modern-tab-panel.active');
        return activePanel ? activePanel.id : null;
    }
    
    /**
     * Public API: Switch tab programmatically (for compatibility with existing code)
     */
    window.switchTab = switchTab;
    window.getActiveTabId = getActiveTabId;
</script>

<!-- Modern Accordion for Data Explorer -->
<div class="modern-accordion" id="dataview">
    <div class="modern-accordion-header" id="dataview-header">
        <span style="width:100%;padding-top: 2px !important;padding-bottom: 2px !important;">Data explorer</span>
        <span class="modern-accordion-icon">▼</span>
    </div>
    <div class="modern-accordion-content" id="dataview-content">
        <div>tbd</div>
    </div>
</div>

<!-- Feature Card Selection -->
<div class="modern-tabs-container" id="tabs">
    <ul class="modern-tabs-nav">
        <li class="modern-tabs-nav-item">
            <a href="#zing" class="modern-tabs-nav-button" data-tab-target="zing">
                <div class="card-header">
                    <div class="card-title">Side by side</div>
                    <div class="card-description">Compare performance metrics side by side for detailed analysis</div>
                </div>
                <div class="card-footer">
                    <span class="card-action">View details</span>
                </div>
            </a>
        </li>
        <li class="modern-tabs-nav-item">
            <a href="#perfswat" class="modern-tabs-nav-button" data-tab-target="perfswat">
                <div class="card-header">
                    <div class="card-title">Week over week</div>
                    <div class="card-description">Analyze week-over-week performance trends and comparisons</div>
                </div>
                <div class="card-footer">
                    <span class="card-action">View details</span>
                </div>
            </a>
        </li>
    </ul>
    <div class="modern-tabs-content">
        <div id="zing" class="modern-tab-panel row no-padding" style="min-height: 900px; padding-left: 0px;">
            <#include "content.ftl">
        </div>
        <div id="perfswat" class="modern-tab-panel">
            <#include "perfswat.ftl">
        </div>
    </div>
</div>

<div id="modals-guid" class="col-lg-12">
</div>
