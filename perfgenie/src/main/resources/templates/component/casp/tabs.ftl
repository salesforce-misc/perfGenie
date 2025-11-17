<!-- Modern Tabs and Accordion Component CSS -->
<link rel="stylesheet" href="/css/modern-tabs.css">
<link rel="stylesheet" href="/css/modern-accordion.css">

<style>
    /*
    * Copyright (c) 2022, Salesforce.com, Inc.
    * All rights reserved.
    * SPDX-License-Identifier: BSD-3-Clause
    * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
    */
    
    /* Override modern-tabs.css to always show tabs container (not hidden by default) */
    #tabs.modern-tabs-container {
        display: flex !important;
        flex-direction: column;
        width: 100%;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
    }
    
    /* Override modern-tabs.css to show card sections for feature card design */
    #tabs.modern-tabs-container .modern-tabs-nav {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 24px;
        margin: 0 0 40px 0 !important;
    }
    
    /* Feature Card Styling - Override button look to show cards */
    #tabs.modern-tabs-container .modern-tabs-nav-button {
        display: block !important;
        padding: 0 !important;
        background: #ffffff !important;
        border: none !important;
        border-radius: 20px !important;
        color: #1e293b !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
        width: 100% !important;
    }
    
    /* Show card sections */
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-header,
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-footer,
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-description,
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-action {
        display: block !important;
    }
    
    /* Card Header Section */
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-header {
        padding: 32px 32px 24px 32px;
        background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
        border-bottom: none;
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-title {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 8px 0;
        line-height: 1.3;
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-description {
        font-size: 14px;
        color: #64748b;
        margin: 0;
        line-height: 1.5;
    }
    
    /* Card Footer Section */
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-footer {
        padding: 20px 32px;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-action {
        font-size: 14px;
        font-weight: 600;
        color: #3b82f6;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button .card-action::after {
        content: '→';
        font-size: 18px;
        transition: transform 0.3s ease;
    }
    
    /* Hover State */
    #tabs.modern-tabs-container .modern-tabs-nav-button:hover {
        border: none;
        box-shadow: 0 12px 32px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-6px);
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button:hover .card-header {
        background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button:hover .card-action::after {
        transform: translateX(4px);
    }
    
    /* Active State */
    #tabs.modern-tabs-container .modern-tabs-nav-button.active {
        border: none;
        box-shadow: 0 16px 40px rgba(59, 130, 246, 0.3), 0 8px 16px rgba(0, 0, 0, 0.12);
        transform: translateY(-6px);
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button.active .card-header {
        background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 50%, #f8fafc 100%);
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button.active .card-title {
        color: #1e40af;
    }
    
    #tabs.modern-tabs-container .modern-tabs-nav-button.active .card-action {
        color: #1e40af;
    }
    
    /* Active Badge */
    #tabs.modern-tabs-container .modern-tabs-nav-button.active::before {
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
</style>

<!-- Modern Tabs and Accordion Component JavaScript -->
<script src="/js/modern-tabs.js"></script>
<script src="/js/modern-accordion.js"></script>

<script>
    /*
    * Copyright (c) 2022, Salesforce.com, Inc.
    * All rights reserved.
    * SPDX-License-Identifier: BSD-3-Clause
    * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
    */
    
    // Store reference to component function before local declarations to avoid shadowing
    const componentInitModernTabsFunction = (function() {
        return window.initModernTabs;
    })();
    
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize modern tabs using component
        const tabsAPI = componentInitModernTabsFunction('#tabs', {
            onTabActivate: function(tabId, panelElement) {
                // Trigger activate event (similar to jQuery UI tabs activate)
                const event = new CustomEvent('tabActivate', {
                    detail: {
                        newTab: tabId,
                        newPanel: panelElement
                    }
                });
                const tabsContainer = document.getElementById('tabs');
                if (tabsContainer) {
                    tabsContainer.dispatchEvent(event);
                }
            }
        });
        
        // Store tabs API globally for compatibility
        if (tabsAPI) {
            window.tabsAPI = tabsAPI;
            // Expose switchTab and getActiveTabId for backward compatibility
            window.switchTab = function(tabId) {
                return tabsAPI.switchTab(tabId);
            };
            window.getActiveTabId = function() {
                return tabsAPI.getActiveTabId();
            };
        }
        
        // Initialize modern accordion using component (start collapsed)
        initModernAccordion('dataview-header', 'dataview-content', false);
    });
</script>

<!-- Modern Accordion for Data Explorer -->
<div class="modern-accordion" id="dataview">
    <div class="modern-accordion-header" id="dataview-header">
        <span style="width:100%;padding-top: 2px !important;padding-bottom: 2px !important;">Data explorer</span>
        <i class="fa fa-chevron-down modern-accordion-icon"></i>
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
