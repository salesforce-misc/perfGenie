<style>
    /*
    * Copyright (c) 2022, Salesforce.com, Inc.
    * All rights reserved.
    * SPDX-License-Identifier: BSD-3-Clause
    * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
    */
    
    /* Override any jQuery UI styles and canary.ftl styles */
    #canary-tabs.ui-tabs,
    #canary-tabs.ui-widget,
    #canary-tabs.ui-widget-content {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
    }
    
    #canary-tabs .ui-tabs-nav,
    #canary-tabs ul.ui-tabs-nav {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
    }
    
    /* Override canary.ftl and canarynew.ftl styles that hide tabs */
    #canary-tabs ul li a,
    #canary-tabs ul li.modern-tabs-nav-item a,
    #canary-tabs .modern-tabs-nav li a,
    #canary-tabs .modern-tabs-nav-item a {
        height: auto !important;
        min-height: auto !important;
        line-height: normal !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        display: block !important;
    }
    
    .ui-tabs .ui-tabs-nav li,
    #canary-tabs .ui-tabs-nav li,
    #canary-tabs ul li.modern-tabs-nav-item {
        height: auto !important;
        min-height: auto !important;
    }
    
    .ui-tabs .ui-tabs-nav li a,
    #canary-tabs .ui-tabs-nav li a {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        height: auto !important;
    }
    
    /* Modern Flex-based Tab Container - Transparent Background */
    .modern-tabs-container,
    #canary-tabs.modern-tabs-container {
        display: none !important; /* Hidden by default */
        flex-direction: column;
        width: 100%;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        box-sizing: border-box;
    }
    
    /* Show tabs container when visible class is added */
    .modern-tabs-container.visible,
    #canary-tabs.modern-tabs-container.visible {
        display: flex !important;
    }
    
    /* Feature Card Selection - Modern Button Look */
    .modern-tabs-nav,
    #canary-tabs .modern-tabs-nav,
    #canary-tabs ul.modern-tabs-nav {
        display: flex !important;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 12px;
        margin: 0 0 12px 0 !important;
        padding: 0 !important;
        list-style: none !important;
        background: #fafbfc !important;
        border: none !important;
        box-shadow: none !important;
    }
    
    /* Individual Feature Button */
    .modern-tabs-nav-item,
    #canary-tabs .modern-tabs-nav-item,
    #canary-tabs ul li.modern-tabs-nav-item {
        margin: 0 !important;
        padding: 0 !important;
        list-style: none !important;
        background: transparent !important;
        border: none !important;
        float: none !important;
    }
    
    .modern-tabs-nav-button,
    #canary-tabs .modern-tabs-nav-button,
    #canary-tabs a.modern-tabs-nav-button,
    #canary-tabs ul li a.modern-tabs-nav-button {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        padding: 4px 14px !important;
        background: #f1f5f9 !important;
        border: none !important;
        border-radius: 6px !important;
        color: #475569 !important;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-decoration: none !important;
        box-sizing: border-box;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
        position: relative;
        overflow: hidden;
        float: none !important;
        margin: 0 !important;
        height: auto !important;
        min-height: 30px !important;
        visibility: visible !important;
        opacity: 1 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-size: 13.5px !important;
        font-weight: 600;
        letter-spacing: 0.01em;
        white-space: nowrap;
    }
    
    
    /* Hide card sections for button look */
    .modern-tabs-nav-button .card-header,
    .modern-tabs-nav-button .card-footer,
    .modern-tabs-nav-button .card-description,
    .modern-tabs-nav-button .card-action {
        display: none !important;
    }
    
    /* Show only title as button text */
    .modern-tabs-nav-button .card-title {
        font-size: 13.5px !important;
        font-weight: 600;
        color: inherit;
        margin: 0;
        line-height: 1.3;
        display: block;
        position: relative;
        z-index: 1;
    }
    
    /* Hover State */
    .modern-tabs-nav-button:hover,
    #canary-tabs .modern-tabs-nav-button:hover,
    #canary-tabs a.modern-tabs-nav-button:hover {
        background: #e2e8f0 !important;
        border: none !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        color: #1e293b !important;
        transform: translateY(-1px);
    }
    
    /* Active State - Lighter shades of header colors for dull appearance */
    .modern-tabs-nav-button.active,
    .modern-tabs-nav-button.active:hover,
    #canary-tabs .modern-tabs-nav-button.active,
    #canary-tabs .modern-tabs-nav-button.active:hover,
    #canary-tabs a.modern-tabs-nav-button.active,
    #canary-tabs a.modern-tabs-nav-button.active:hover,
    #canary-tabs ul li a.modern-tabs-nav-button.active,
    #canary-tabs ul li a.modern-tabs-nav-button.active:hover,
    a.modern-tabs-nav-button.active,
    a.modern-tabs-nav-button.active:hover {
        background: linear-gradient(#5A9FD4, #7FC0E8) !important;
        background-color: #6BB3E0 !important;
        background-image: linear-gradient(#5A9FD4, #7FC0E8) !important;
        border: none !important;
        box-shadow: 0 2px 6px rgba(90, 159, 212, 0.3) !important;
        color: #ffffff !important;
    }
    
    .modern-tabs-nav-button.active .card-title,
    #canary-tabs .modern-tabs-nav-button.active .card-title,
    #canary-tabs a.modern-tabs-nav-button.active .card-title {
        color: #ffffff !important;
        font-weight: 600;
    }
    
    /* Ensure text is visible on active state */
    .modern-tabs-nav-button.active,
    .modern-tabs-nav-button.active *,
    #canary-tabs .modern-tabs-nav-button.active,
    #canary-tabs .modern-tabs-nav-button.active *,
    a.modern-tabs-nav-button.active,
    a.modern-tabs-nav-button.active * {
        color: #ffffff !important;
    }
    
    /* Override any inline styles or other CSS - Use lighter header shades */
    .modern-tabs-nav-button.active[style],
    #canary-tabs .modern-tabs-nav-button.active[style] {
        background: linear-gradient(#5A9FD4, #7FC0E8) !important;
        background-color: #6BB3E0 !important;
        color: #ffffff !important;
    }
    
    /* Remove active badge for button look */
    .modern-tabs-nav-button.active::before {
        display: none;
    }
    
    /* Tab Content Container */
    .modern-tabs-content {
        display: flex;
        flex-direction: column;
        width: 100%;
        position: relative;
        padding: 0;
        box-sizing: border-box;
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
        display: none !important; /* Hidden by default */
        flex-direction: column;
        width: 100%;
        border: none;
        border-radius: 0 !important;
        background: #ffffff;
        margin-bottom: 16px;
        overflow: hidden;
    }
    
    /* Show accordion when visible class is added - higher specificity to override default */
    #canary-dataview.visible,
    .modern-accordion.visible {
        display: flex !important;
    }
    
    /* When tabs container is visible, ensure accordion with visible class is shown (higher specificity) */
    #canary-tabs.modern-tabs-container.visible #canary-dataview.visible,
    #canary-tabs.modern-tabs-container.visible .modern-accordion.visible {
        display: flex !important;
    }
    
    .modern-accordion-header,
    #canary-dataview-header {
        display: flex !important;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        padding: 4px 14px !important;
        background: #f1f5f9 !important;
        border: none;
        border-radius: 0 !important;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-weight: 600;
        color: #475569 !important;
        height: 30px !important;
        min-height: 30px !important;
        max-height: 30px !important;
        box-sizing: border-box !important;
        line-height: 1.3 !important;
        font-size: 13.5px !important;
        letter-spacing: 0.01em;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
    }
    
    /* Override inline styles on inner span */
    #canary-dataview-header span,
    .modern-accordion-header span {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        line-height: 1.3 !important;
        font-size: 13.5px !important;
        font-weight: 600;
    }
    
    .modern-accordion-header:hover,
    #canary-dataview-header:hover {
        background: #e2e8f0 !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        color: #1e293b !important;
        transform: translateY(-1px);
    }
    
    .modern-accordion-header.active,
    .modern-accordion-header.active:hover,
    #canary-dataview-header.active,
    #canary-dataview-header.active:hover {
        background: linear-gradient(#5A9FD4, #7FC0E8) !important;
        background-color: #6BB3E0 !important;
        background-image: linear-gradient(#5A9FD4, #7FC0E8) !important;
        border-bottom: 1px solid #5A9FD4 !important;
        box-shadow: 0 2px 6px rgba(90, 159, 212, 0.3) !important;
        color: #ffffff !important;
    }
    
    .modern-accordion-header.active *,
    #canary-dataview-header.active * {
        color: #ffffff !important;
    }
    
    .modern-accordion-header.active .modern-accordion-icon,
    #canary-dataview-header.active .modern-accordion-icon {
        color: #ffffff !important;
    }
    
    .modern-accordion-icon {
        transition: transform 0.2s ease;
        color: #6b7280;
        font-size: 12px;
        order: -1;
        flex-shrink: 0;
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
    
    #canary-dataview-content {
        padding: 8px;
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
    
    /* Left Navigation Sidebar */
    .left-nav-sidebar {
        position: fixed;
        left: 0;
        top: 0;
        height: 100vh;
        background: #429CD6;
        border: none;
        transition: width 0.3s ease, top 0.3s ease, height 0.3s ease;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        box-shadow: none;
    }
    
    .left-nav-sidebar.collapsed {
        width: 22px;
        /* Glazy convex modern background with glazy effect - fading on right edge */
        background: linear-gradient(to right, 
            rgba(235, 245, 255, 0.95) 0%, 
            rgba(235, 245, 255, 0.9) 60%, 
            rgba(235, 245, 255, 0.7) 85%, 
            rgba(235, 245, 255, 0.4) 95%, 
            rgba(235, 245, 255, 0.1) 100%) !important;
        /* Additional blue tint overlay - also fading on right */
        background-image: 
            linear-gradient(to right, 
                rgba(235, 245, 255, 0.95) 0%, 
                rgba(235, 245, 255, 0.9) 60%, 
                rgba(235, 245, 255, 0.7) 85%, 
                rgba(235, 245, 255, 0.4) 95%, 
                rgba(235, 245, 255, 0.1) 100%),
            linear-gradient(to right, 
                rgba(90, 159, 212, 0.08) 0%, 
                rgba(90, 159, 212, 0.05) 70%, 
                rgba(90, 159, 212, 0.02) 90%, 
                transparent 100%) !important;
        /* Glassy effect with backdrop blur */
        backdrop-filter: blur(10px) saturate(180%);
        -webkit-backdrop-filter: blur(10px) saturate(180%);
        /* Convex embossed effect - more height on left, soft fade to right */
        box-shadow: 
            inset 0 1px 2px rgba(255, 255, 255, 0.8),
            inset 0 -1px 2px rgba(0, 0, 0, 0.05),
            /* Left side shadow (more prominent) */
            -2px 0 8px rgba(0, 0, 0, 0.15),
            -1px 0 4px rgba(0, 0, 0, 0.1),
            /* Right side shadow (very subtle, soft fade) */
            1px 0 2px rgba(0, 0, 0, 0.03),
            /* Top and bottom shadows */
            0 1px 3px rgba(0, 0, 0, 0.08),
            0 -1px 2px rgba(0, 0, 0, 0.05),
            /* Subtle blue glow */
            inset 0 0 20px rgba(90, 159, 212, 0.03);
        /* No right border - soft fade instead */
        border: none !important;
        border-top: 1px solid rgba(255, 255, 255, 0.6) !important;
        border-bottom: 1px solid rgba(90, 159, 212, 0.15) !important;
        /* Soft fade mask on right edge */
        mask-image: linear-gradient(to right, black 0%, black 85%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 0%, black 85%, transparent 100%);
    }
    
    /* Collapse/Expand Arrow - Middle Right Aligned */
    .left-nav-collapse-arrow {
        position: absolute;
        right: 2px;
        top: 50%;
        transform: translateY(-50%);
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 1001;
        color: #6b7280;
        font-size: 10px;
        font-weight: 300;
        transition: all 0.2s ease;
        border-radius: 3px;
        background: transparent;
    }
    
    .left-nav-collapse-arrow:hover {
        color: #429CD6;
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-50%) scale(1.1);
    }
    
    .left-nav-sidebar.expanded .left-nav-collapse-arrow {
        color: rgba(255, 255, 255, 0.7);
        background: transparent;
    }
    
    .left-nav-sidebar.expanded .left-nav-collapse-arrow:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
    }
    
    .left-nav-sidebar.expanded {
        width: 200px;
    }
    
    .left-nav-toggle {
        padding: 0;
        cursor: pointer;
        border: none;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        background: #3a8bc7;
        transition: background-color 0.2s ease;
        height: 60px;
        min-height: 60px;
        width: 100%;
        box-sizing: border-box;
    }
    
    .left-nav-toggle:hover {
        background: #2d5a8f;
    }
    
    .left-nav-sidebar.collapsed .left-nav-toggle {
        background: transparent !important;
    }
    
    .left-nav-sidebar.collapsed .left-nav-toggle:hover {
        background: transparent !important;
    }
    
    .left-nav-toggle-icon {
        width: auto;
        height: 60%;
        padding: 4px;
        padding-left: 8px;
        padding-right: 4px;
        transition: all 0.3s ease;
        display: block;
        flex-shrink: 0;
    }
    
    .left-nav-toggle-title {
        font-weight: bold;
        font-family: 'Tangerine';
        color: white;
        font-size: 32px;
        margin-left: 0;
        white-space: nowrap;
        display: flex;
        align-items: center;
        vertical-align: middle;
        padding-left: 4px;
    }
    
    .left-nav-sidebar.collapsed .left-nav-toggle-icon {
        transform: none;
        width: 19px;
        height: 19px;
        padding: 0;
        padding-left: 3.5px;
        filter: brightness(0) saturate(100%) invert(58%) sepia(67%) saturate(2000%) hue-rotate(180deg) brightness(0.85) contrast(0.9);
    }
    
    .left-nav-sidebar.collapsed .left-nav-toggle-title {
        display: none;
    }
    
    .left-nav-menu {
        flex: 1;
        padding: 50px 0 8px 0;
        overflow-y: auto;
        border: none;
        background: #3a8bc7;
    }
    
    .left-nav-sidebar.collapsed .left-nav-menu {
        background: transparent !important;
    }
    
    .left-nav-item {
        display: flex;
        align-items: center;
        padding: 4px 20px 4px 2px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: rgba(255, 255, 255, 0.7);
        text-decoration: none;
        border-left: 3px solid transparent;
        gap: 12px;
        height: 30px;
        min-height: 30px;
        box-sizing: border-box;
        font-weight: normal;
    }
    
    .left-nav-item:hover {
        background: rgba(255, 255, 255, 0.15);
        border-left-color: rgba(255, 255, 255, 0.7);
        color: rgba(255, 255, 255, 0.85);
    }
    
    .left-nav-item.active {
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        border-left-color: #ffffff;
    }
    
    .left-nav-item.active:hover {
        background: rgba(255, 255, 255, 0.25);
        color: #ffffff;
    }
    
    .left-nav-icon {
        font-size: 13.5px;
        width: auto;
        height: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        line-height: 1.3;
        color: rgba(255, 255, 255, 0.7);
    }
    
    .left-nav-item.active .left-nav-icon {
        color: #ffffff;
    }
    
    .left-nav-item:hover .left-nav-icon {
        color: rgba(255, 255, 255, 0.85);
    }
    
    .left-nav-label {
        font-size: 13.5px;
        font-weight: 500;
        white-space: nowrap;
        transition: opacity 0.2s ease;
        line-height: 1.3;
        display: flex;
        align-items: center;
        color: rgba(255, 255, 255, 0.7);
    }
    
    .left-nav-item.active .left-nav-label {
        color: #ffffff;
    }
    
    .left-nav-item:hover .left-nav-label {
        color: rgba(255, 255, 255, 0.85);
    }
    
    .left-nav-sidebar.collapsed .left-nav-label {
        opacity: 0;
        width: 0;
        overflow: hidden;
    }
    
    .left-nav-sidebar.collapsed .left-nav-item {
        align-items: center;
        justify-content: flex-start;
        padding: 0 3px 0 3.5px;
        height: 30px;
        min-height: 30px;
        width: 100%;
        border-left: none;
        color: rgba(255, 255, 255, 0.7) !important;
        background: transparent !important;
    }
    
    .left-nav-sidebar.collapsed .left-nav-item:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: rgba(255, 255, 255, 0.85) !important;
    }
    
    .left-nav-sidebar.collapsed .left-nav-item.active {
        background: rgba(255, 255, 255, 0.15) !important;
        border-left: none !important;
        color: #ffffff !important;
    }
    
    .left-nav-sidebar.collapsed .left-nav-item.active:hover {
        background: rgba(255, 255, 255, 0.2) !important;
        color: #ffffff !important;
    }
    
    .left-nav-sidebar.collapsed .left-nav-item .left-nav-icon {
        color: #6b7280 !important;
    }
    
    .left-nav-sidebar.collapsed .left-nav-item:hover .left-nav-icon {
        color: #9ca3af !important;
    }
    
    .left-nav-sidebar.collapsed .left-nav-item.active .left-nav-icon {
        color: #429CD6 !important;
    }
    
    .data-view-header-placeholder {
        display: flex;
        align-items: center;
        padding: 0 16px;
        font-size: 18px;
        font-weight: 500;
        color: #4a5568;
        /* Embossed glazy background with blue tint gradient */
        background: linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(220, 235, 250, 0.9) 50%, rgba(235, 245, 255, 0.95) 100%);
        /* Additional blue tint overlay */
        background-image: 
            linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(220, 235, 250, 0.9) 50%, rgba(235, 245, 255, 0.95) 100%),
            linear-gradient(180deg, rgba(90, 159, 212, 0.08) 0%, rgba(127, 192, 232, 0.05) 100%);
        /* Glassy effect with backdrop blur */
        backdrop-filter: blur(10px) saturate(180%);
        -webkit-backdrop-filter: blur(10px) saturate(180%);
        /* Embossed effect with inset shadows */
        box-shadow: 
            inset 0 1px 2px rgba(255, 255, 255, 0.8),
            inset 0 -1px 2px rgba(0, 0, 0, 0.05),
            0 1px 3px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(90, 159, 212, 0.15),
            inset 0 0 20px rgba(90, 159, 212, 0.03);
        /* Subtle border with gradient effect */
        border: none !important;
        border-top: 1px solid rgba(255, 255, 255, 0.6) !important;
        border-bottom: 1px solid rgba(90, 159, 212, 0.2) !important;
        /* Text styling - clean, professional look */
        text-shadow: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        letter-spacing: 0.02em;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        /* Smooth transitions */
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
    }
    
    /* Optional: Add a subtle shine effect on hover */
    .data-view-header-placeholder:hover {
        background: linear-gradient(135deg, rgba(235, 245, 255, 0.98) 0%, rgba(220, 235, 250, 0.96) 50%, rgba(235, 245, 255, 0.98) 100%);
        background-image: 
            linear-gradient(135deg, rgba(235, 245, 255, 0.98) 0%, rgba(220, 235, 250, 0.96) 50%, rgba(235, 245, 255, 0.98) 100%),
            linear-gradient(180deg, rgba(90, 159, 212, 0.12) 0%, rgba(127, 192, 232, 0.08) 100%);
        box-shadow: 
            inset 0 1px 3px rgba(255, 255, 255, 0.9),
            inset 0 -1px 2px rgba(0, 0, 0, 0.06),
            0 2px 4px rgba(0, 0, 0, 0.1),
            0 0 0 1px rgba(90, 159, 212, 0.2);
    }
    
    /* Optional: Add a subtle animated shine effect */
    .data-view-header-placeholder::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        transition: left 0.5s;
    }
    
    .data-view-header-placeholder:hover::before {
        left: 100%;
    }
    
    /* Field and Input Styling - Matching SFDataTable.js */
    .fieldlable {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        color: #495057;
        font-weight: 500;
        margin-right: 4px;
        white-space: nowrap;
    }
    
    .filterinput {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        padding: 0 8px;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        font-size: 14px;
        transition: all 0.2s ease;
        height: 30px;
        box-sizing: border-box;
        background: #ffffff;
        color: #343a40;
        font-weight: 500;
    }
    
    .filterinput:focus {
        outline: none;
        border-color: #46a5e3;
        box-shadow: 0 0 0 3px rgba(70, 165, 227, 0.1);
    }
    
    .filterinput:hover {
        border-color: #adb5bd;
    }
    
    /* Process Button Styling - Matching SFDataTable pagination buttons */
    .ui-button.ui-widget.ui-corner-all {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        padding: 0 12px;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        background: #ffffff;
        color: #495057;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
    }
    
    .ui-button.ui-widget.ui-corner-all:hover:not(:disabled) {
        background: #46a5e3;
        color: #ffffff;
        border-color: #46a5e3;
        box-shadow: 0 2px 4px rgba(70, 165, 227, 0.2);
    }
    
    .ui-button.ui-widget.ui-corner-all:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    /* Table styling for form layouts */
    table.ui-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        border-collapse: collapse;
        width: auto;
    }
    
    table.ui-widget td {
        padding: 4px 8px;
        vertical-align: middle;
    }
    
    .main-content-wrapper {
        margin-left: 200px;
        transition: margin-left 0.3s ease;
        padding: 0 4px 16px 4px;
    }
    
    .main-content-wrapper.sidebar-collapsed {
        margin-left: 22px;
    }
    
    .page-content {
        display: none;
    }
    
    .page-content.active {
        display: block;
    }
    
    /* Overlay - hidden by default */
    .overlay,
    #canary-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 999;
    }
    
    /* Comment Popup - hidden by default */
    #canary-commentPopup {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: white;
        padding: 15px;
        border: 1px solid #ccc;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        min-width: 800px;
        min-height: 300px;
        width: 60%;
        box-sizing: border-box;
        overflow: hidden;
    }
    
    /* Color options - hidden by default (inside popup) */
    .color-options {
        margin-bottom: 10px;
    }
    
    /* Comment textarea */
    #canary-commentText {
        width: 100%;
        height: 200px;
        margin-bottom: 10px;
        padding: 8px;
        border: 1px solid #ccc;
        box-sizing: border-box;
        resize: vertical;
    }
    
    /* Button container */
    .button-container {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 10px;
    }
    
    /* Submit and Cancel buttons */
    #canary-submitComment,
    #canary-cancelComment {
        padding: 8px 16px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: #f8f9fa;
        cursor: pointer;
        font-size: 14px;
    }
    
    #canary-submitComment:hover {
        background-color: #46a5e3;
        color: white;
        border-color: #46a5e3;
    }
    
    #canary-cancelComment:hover {
        background-color: #e2e8f0;
    }
</style>

<!-- JavaScript and CSS includes from index.ftl (only scripts not already in canarynew.ftl) -->
<#--    https://github.com/twbs/bootstrap/releases/download/v4.2.1/bootstrap-4.2.1-dist.zip-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.0.4/popper.js"></script>

<link rel="stylesheet" href="/css/profiler.css">
<script src="/js/SFlameGraph.js"></script>
<script src="/js/input.js"></script>
<script src="/js/utils.js"></script>
<link rel="stylesheet" href="/css/SFlameGraph.css">

<link rel="stylesheet" type="text/css" href="/plugins/dataTables.jqueryui.min.css"/>
<script type="text/javascript" src="/plugins/jquery.dataTables.min.js"></script>
<script type="text/javascript" src="/plugins/dataTables.jqueryui.min.js"></script>

<!-- Load d3 first (before d3-tip and d3.flameGraph), then load additional d3 scripts -->
<!-- Note: d3 and c3 are also loaded in wave-js.ftl, but we need d3 here first for d3-tip and d3.flameGraph -->
<script type="text/javascript" src="/plugins/d3/d3-4.10.0.min.js"></script>
<script type="text/javascript" src="/plugins/d3/d3-tip.min.js"></script>
<script type="text/javascript" src="/plugins/d3/d3.flameGraph.min.js"></script>
<link rel="stylesheet" href="/plugins/d3/d3.flameGraph.min.css">

<link rel="stylesheet" href="/plugins/bootstrap-toggle.min.css">
<script src="/plugins/bootstrap-toggle.min.js"></script>
<script type="text/javascript" src="/plugins/plotly.min.js"></script>

<script src="/plugins/bootstrap-multiselect.js"></script>
<link rel="stylesheet" href="/plugins/bootstrap-multiselect.css">

<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
    
    // Track if initialization has been done
    var tabsInitialized = false;
    
    // Track if canary data has been loaded from URL to prevent duplicate calls
    var canaryDataLoadedFromUrl = false;
    
    // Track if an AJAX request is in progress to prevent duplicate requests
    var canaryDataRequestInProgress = false;
    
    // Declare canary data variables (initialized when data is loaded)
    // These are used by contentnew.ftl and other included templates
    var canaryContextArray;
    var canaryContextHeader;
    var canaryCommentCounts;
    var canaryContextViewHeader;
    var canaryComments;
    var canaryContextViewHeaderConfig; // Used to store header config from AJAX
    
    // Use jQuery ready if available, otherwise DOMContentLoaded
    function initializeTabs() {
        if (tabsInitialized) {
            return; // Already initialized
        }
        
        // Initialize modern tabs
        initModernTabs();
        
        // Initialize modern accordion
        initModernAccordion();
        
        // Initialize datetime pickers
        initDateTimePickers();
        
        tabsInitialized = true;
    }
    
    // Wait for both DOM and scripts to be ready
    // The datetimepicker script is loaded in the head, but we need to wait for it to actually register
    function waitForScriptsAndInit() {
        // Check if jQuery and datetimepicker are available
        if (typeof jQuery !== 'undefined' && jQuery.fn && typeof jQuery.fn.datetimepicker === 'function') {
            // Script is loaded, initialize
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initializeTabs);
            } else {
                // DOM already ready
                initializeTabs();
            }
        } else {
            // Script not ready yet, wait a bit and retry
            setTimeout(waitForScriptsAndInit, 50);
        }
    }
    
    // Start waiting for scripts
    waitForScriptsAndInit();
    
    // Also try after window load in case elements are added dynamically (from included FTL files)
    window.addEventListener('load', function() {
        setTimeout(function() {
            initDateTimePickers();
        }, 100);
    });
    
    // Use MutationObserver to watch for when datetime picker elements are added to DOM
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function(mutations) {
            var shouldInit = false;
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        // Check if any datetime picker elements were added
                        if (node.id && (node.id.indexOf('picker') !== -1 || node.id === 'canary-startpicker' || node.id === 'canary-endpicker')) {
                            shouldInit = true;
                        }
                        // Also check children
                        if (node.querySelectorAll && (node.querySelectorAll('#startpicker3, #endpicker3, #startpicker4, #endpicker4, #startpicker5, #endpicker5, #canary-startpicker, #canary-endpicker').length > 0)) {
                            shouldInit = true;
                        }
                    }
                });
            });
            if (shouldInit) {
                setTimeout(function() {
                    initDateTimePickers();
                }, 100);
            }
        });
        
        // Start observing when DOM is ready
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                if (document.body) {
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }
            });
        }
    }
    
    /**
     * Get URL parameter value
     * @param {string} paramName - The parameter name to read
     * @returns {string|null} - The parameter value or null if not found
     */
    function getUrlParameter(paramName) {
        try {
            // Reuse urlParams if already defined (from contentnew.ftl), otherwise create it
            if (typeof window.urlParams === 'undefined' && typeof urlParams === 'undefined') {
                window.urlParams = new URLSearchParams(window.location.search);
            }
            var params = window.urlParams || urlParams;
            return params ? params.get(paramName) : null;
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
    }
    
    /**
     * Initialize modern flex-based tabs
     */
    function initModernTabs() {
        const tabButtons = document.querySelectorAll('.modern-tabs-nav-button');
        const tabPanels = document.querySelectorAll('.modern-tab-panel');
        
        if (tabButtons.length === 0 || tabPanels.length === 0) {
            console.warn('Tab buttons or panels not found');
            return;
        }
        
        // Check URL for canarytab parameter
        const urlTabId = getUrlParameter('canarytab');
        let tabToActivate = null;
        
        if (urlTabId) {
            // Validate that the tab exists
            const targetPanel = document.getElementById(urlTabId);
            if (targetPanel) {
                tabToActivate = urlTabId;
            } else {
                console.warn('Tab from URL parameter not found:', urlTabId);
            }
        }
        
        // Set first tab as active by default if none is active and no URL parameter
        const hasActive = Array.from(tabButtons).some(btn => btn.classList.contains('active'));
        if (!hasActive && tabButtons.length > 0 && tabPanels.length > 0) {
            if (tabToActivate) {
                // Activate tab from URL parameter
                switchTab(tabToActivate);
                // Trigger updateCanaryView for the tab from URL
                if (typeof updateCanaryView === 'function') {
                    setTimeout(() => updateCanaryView(tabToActivate), 50);
                }
            } else {
                // Default to first tab
                const firstButton = tabButtons[0];
                firstButton.classList.add('active');
                // Force apply lighter header shades via inline style
                firstButton.style.background = 'linear-gradient(#5A9FD4, #7FC0E8)';
                firstButton.style.backgroundImage = 'linear-gradient(#5A9FD4, #7FC0E8)';
                firstButton.style.backgroundColor = '#6BB3E0';
                firstButton.style.color = '#ffffff';
                firstButton.style.border = 'none';
                firstButton.style.boxShadow = '0 2px 6px rgba(90, 159, 212, 0.3)';
                tabPanels[0].classList.add('active');
                // Trigger updateCanaryView for initial tab
                const firstTabId = tabPanels[0].id;
                if (firstTabId && typeof updateCanaryView === 'function') {
                    setTimeout(() => updateCanaryView(firstTabId), 50);
                }
            }
        } else if (tabToActivate && !hasActive) {
            // URL parameter exists but no tab is active yet
            switchTab(tabToActivate);
            if (typeof updateCanaryView === 'function') {
                setTimeout(() => updateCanaryView(tabToActivate), 50);
            }
        }
        
        // Add click handlers to tab buttons
        tabButtons.forEach((button, index) => {
            // Get target ID before cloning
            const targetId = button.getAttribute('href')?.substring(1) || 
                           button.getAttribute('data-tab-target') ||
                           tabPanels[index]?.id;
            
            if (!targetId) {
                console.warn('No target ID found for tab button at index', index);
                return;
            }
            
            // Remove any existing click listeners by cloning
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Add click handler to the new button with stored targetId
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Use the stored targetId
                const clickedTargetId = this.getAttribute('href')?.substring(1) || 
                                      this.getAttribute('data-tab-target') ||
                                      targetId;
                
                if (!clickedTargetId) {
                    console.warn('No target ID found for tab button', this);
                    return;
                }
                
                // Switch to the selected tab
                switchTab(clickedTargetId);
                
                // Call updateCanaryView (preserving original functionality)
                if (clickedTargetId && typeof updateCanaryView === 'function') {
                    setTimeout(() => updateCanaryView(clickedTargetId), 50);
                }
                
                // Trigger activate event (similar to jQuery UI tabs activate)
                const tabsContainer = document.getElementById('canary-tabs');
                if (tabsContainer) {
                    const event = new CustomEvent('tabActivate', {
                        detail: {
                            newTab: clickedTargetId,
                            newPanel: document.getElementById(clickedTargetId)
                        }
                    });
                    tabsContainer.dispatchEvent(event);
                }
            });
        });
    }
    
    /**
     * Switch to a specific tab
     * @param {string} tabId - The ID of the tab panel to show
     */
    function switchTab(tabId) {
        if (!tabId) {
            console.warn('switchTab called without tabId');
            return;
        }
        
        const tabButtons = document.querySelectorAll('.modern-tabs-nav-button');
        const tabPanels = document.querySelectorAll('.modern-tab-panel');
        
        // Remove active class from all buttons and panels
        tabButtons.forEach(btn => {
            if (btn) {
                btn.classList.remove('active');
                // Force remove any inline styles that might override
                btn.style.backgroundColor = '';
                btn.style.background = '';
                btn.style.backgroundImage = '';
                btn.style.color = '';
                btn.style.boxShadow = '';
            }
        });
        tabPanels.forEach(panel => {
            if (panel) panel.classList.remove('active');
        });
        
        // Find and activate the target tab button
        let buttonFound = false;
        tabButtons.forEach(button => {
            if (!button) return;
            const targetId = button.getAttribute('href')?.substring(1) || 
                           button.getAttribute('data-tab-target');
            if (targetId === tabId) {
                button.classList.add('active');
                // Force apply lighter header shades via inline style as backup
                button.style.background = 'linear-gradient(#5A9FD4, #7FC0E8)';
                button.style.backgroundImage = 'linear-gradient(#5A9FD4, #7FC0E8)';
                button.style.backgroundColor = '#6BB3E0';
                button.style.color = '#ffffff';
                button.style.border = 'none';
                button.style.boxShadow = '0 2px 6px rgba(90, 159, 212, 0.3)';
                buttonFound = true;
            }
        });
        
        // Activate the target panel
        const targetPanel = document.getElementById(tabId);
        if (targetPanel) {
            targetPanel.classList.add('active');
            // Re-initialize datetime pickers when tab becomes visible (elements might be in included FTL files)
            setTimeout(function() {
                initDateTimePickers();
            }, 200);
        } else {
            console.warn('Tab panel not found:', tabId);
        }
        
        if (!buttonFound) {
            console.warn('Tab button not found for:', tabId);
        }
    }
    
    /**
     * Initialize modern accordion
     */
    function initModernAccordion() {
        const accordionHeader = document.getElementById('canary-dataview-header');
        const accordionContent = document.getElementById('canary-dataview-content');
        
        if (accordionHeader && accordionContent) {
            // Remove existing listeners by cloning
            const newHeader = accordionHeader.cloneNode(true);
            accordionHeader.parentNode.replaceChild(newHeader, accordionHeader);
            
            // Start collapsed (active: false equivalent)
            accordionContent.classList.remove('active');
            newHeader.classList.remove('active');
            
            // Add click handler
            newHeader.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const isActive = accordionContent.classList.contains('active');
                
                if (isActive) {
                    accordionContent.classList.remove('active');
                    newHeader.classList.remove('active');
                    // Remove inline styles when closing
                    newHeader.style.background = '';
                    newHeader.style.backgroundImage = '';
                    newHeader.style.backgroundColor = '';
                    newHeader.style.color = '';
                    newHeader.style.borderBottomColor = '';
                    newHeader.style.boxShadow = '';
                } else {
                    accordionContent.classList.add('active');
                    newHeader.classList.add('active');
                    // Force apply lighter header shades via inline style (matching button active state)
                    newHeader.style.background = 'linear-gradient(#5A9FD4, #7FC0E8)';
                    newHeader.style.backgroundImage = 'linear-gradient(#5A9FD4, #7FC0E8)';
                    newHeader.style.backgroundColor = '#6BB3E0';
                    newHeader.style.color = '#ffffff';
                    newHeader.style.borderBottomColor = '#5A9FD4';
                    newHeader.style.boxShadow = '0 2px 6px rgba(90, 159, 212, 0.3)';
                }
            });
        }
    }
    
    /**
     * Initialize datetime pickers - using the same pattern as input.js
     */
    function initDateTimePickers() {
        // Use the same simple pattern as input.js - just initialize directly
        // This assumes jQuery and datetimepicker are already loaded (which they should be)
        var pickerConfig = {
            format: 'Y-m-d H:i:s',
            formatDate: 'Y-m-d',
            formatTime: 'H:i',
            step: 5
        };
        
        // Initialize all pickers - just like input.js does (lines 255-281)
        // No complex checks, just try to initialize - if plugin isn't loaded, it will fail gracefully
        try {
            jQuery("#startpicker3").datetimepicker(pickerConfig);
        } catch(e) {
            console.warn('[DateTimePicker] Error initializing #startpicker3:', e);
        }
        
        try {
            jQuery("#endpicker3").datetimepicker(pickerConfig);
        } catch(e) {
            console.warn('[DateTimePicker] Error initializing #endpicker3:', e);
        }
        
        try {
            jQuery("#startpicker4").datetimepicker(pickerConfig);
        } catch(e) {
            console.warn('[DateTimePicker] Error initializing #startpicker4:', e);
        }
        
        try {
            jQuery("#endpicker4").datetimepicker(pickerConfig);
        } catch(e) {
            console.warn('[DateTimePicker] Error initializing #endpicker4:', e);
        }
        
        try {
            jQuery("#startpicker5").datetimepicker(pickerConfig);
        } catch(e) {
            console.warn('[DateTimePicker] Error initializing #startpicker5:', e);
        }
        
        try {
            jQuery("#endpicker5").datetimepicker(pickerConfig);
        } catch(e) {
            console.warn('[DateTimePicker] Error initializing #endpicker5:', e);
        }
        
        // Initialize canary data pickers
        initCanaryDateTimePickers();
    }
    
    /**
     * Load canary form values from URL parameters and call viewCanaryData if all exist
     */
    function loadCanaryDataFromUrl() {
        // Prevent duplicate calls
        if (canaryDataLoadedFromUrl) {
            return;
        }
        
        try {
            // Reuse urlParams if already defined (from contentnew.ftl), otherwise create it
            if (typeof window.urlParams === 'undefined' && typeof urlParams === 'undefined') {
                window.urlParams = new URLSearchParams(window.location.search);
            }
            var params = window.urlParams || urlParams;
            const startCanary = params ? params.get('startCanary') : null;
            const endCanary = params ? params.get('endCanary') : null;
            const hostParam = params ? params.get('host') : null;
            
            // Check if all three parameters exist
            if (startCanary && endCanary && hostParam) {
                // Fill the form fields
                const startPicker = jQuery("#canary-startpicker");
                const endPicker = jQuery("#canary-endpicker");
                const sourceInput = jQuery("#canary-source-input");
                
                if (startPicker.length > 0) {
                    startPicker.val(startCanary);
                }
                if (endPicker.length > 0) {
                    endPicker.val(endCanary);
                }
                if (sourceInput.length > 0) {
                    sourceInput.val(hostParam);
                }
                
                // Convert datetime string to timestamp and call viewCanaryData
                let startTimestamp, endTimestamp;
                
                // Try using moment.js if available
                if (typeof moment !== 'undefined') {
                    startTimestamp = moment.utc(startCanary, 'YYYY-MM-DD HH:mm:ss').valueOf();
                    endTimestamp = moment.utc(endCanary, 'YYYY-MM-DD HH:mm:ss').valueOf();
                } else {
                    // Fallback to native Date parsing
                    startTimestamp = new Date(startCanary + ' UTC').getTime();
                    endTimestamp = new Date(endCanary + ' UTC').getTime();
                }
                
                if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) {
                    // Mark as loaded to prevent duplicate calls
                    canaryDataLoadedFromUrl = true;
                    // Call viewCanaryData with the loaded values
                    viewCanaryData(startTimestamp, endTimestamp, hostParam);
                } else {
                    console.warn('[CanaryData] Invalid date format in URL parameters');
                }
            } else {
                // If only some parameters exist, fill what we can
                if (startCanary) {
                    const startPicker = jQuery("#canary-startpicker");
                    if (startPicker.length > 0) {
                        startPicker.val(startCanary);
                    }
                }
                if (endCanary) {
                    const endPicker = jQuery("#canary-endpicker");
                    if (endPicker.length > 0) {
                        endPicker.val(endCanary);
                    }
                }
                if (hostParam) {
                    const sourceInput = jQuery("#canary-source-input");
                    if (sourceInput.length > 0) {
                        sourceInput.val(hostParam);
                    }
                }
            }
        } catch(e) {
            console.warn('[CanaryData] Error loading from URL parameters:', e);
        }
    }
    
    /**
     * Set default value for canary-source-input from dataHost if available
     */
    function setCanarySourceDefault() {
        try {
            // Try to get host from URL parameter (same way contentnew.ftl does it)
            // Reuse urlParams if already defined (from contentnew.ftl), otherwise create it
            if (typeof window.urlParams === 'undefined' && typeof urlParams === 'undefined') {
                window.urlParams = new URLSearchParams(window.location.search);
            }
            var params = window.urlParams || urlParams;
            const hostParam = params ? params.get('host') : null;
            
            // Check for dataHost in multiple ways:
            // 1. URL parameter 'host'
            // 2. Global window.dataHost
            // 3. Try to access dataHost variable directly (if in scope)
            let dataHostValue = hostParam;
            
            if (!dataHostValue || dataHostValue.trim() === '') {
                // Check window.dataHost
                if (typeof window.dataHost !== 'undefined' && window.dataHost) {
                    dataHostValue = window.dataHost;
                }
                // Try to access dataHost directly (might be in scope from included files)
                else {
                    try {
                        // Use eval in a safe way to check if dataHost exists in scope
                        // This is a fallback for when dataHost is defined in included FTL files
                        if (typeof dataHost !== 'undefined' && dataHost) {
                            dataHostValue = dataHost;
                        }
                    } catch(e) {
                        // dataHost not in scope, continue with URL parameter
                    }
                }
            }
            
            const sourceInput = jQuery("#canary-source-input");
            if (sourceInput.length > 0) {
                // Only set if dataHost is not undefined and not empty, and input is empty or has default value
                const currentValue = sourceInput.val();
                const defaultValue = "perf-genie-test45";
                
                if (dataHostValue && dataHostValue.trim() !== '') {
                    // If input is empty or has the default value, set it to dataHost
                    if (!currentValue || currentValue === defaultValue) {
                        sourceInput.val(dataHostValue);
                    }
                }
            }
        } catch(e) {
            console.warn('[CanarySource] Error setting default value:', e);
        }
    }
    
    /**
     * Initialize canary datetime pickers (called separately for dynamic content)
     */
    function initCanaryDateTimePickers() {
        // Use the same simple pattern as input.js - just initialize directly
        var pickerConfig = {
            format: 'Y-m-d H:i:s',
            formatDate: 'Y-m-d',
            formatTime: 'H:i',
            step: 5
        };
        
        // Calculate default values: last 30 days (in UTC)
        var now = new Date();
        var thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
        
        // Format dates as Y-m-d H:i:s in UTC (datetimepicker format)
        function formatDateUTC(date) {
            var year = date.getUTCFullYear();
            var month = String(date.getUTCMonth() + 1).padStart(2, '0');
            var day = String(date.getUTCDate()).padStart(2, '0');
            var hours = String(date.getUTCHours()).padStart(2, '0');
            var minutes = String(date.getUTCMinutes()).padStart(2, '0');
            var seconds = String(date.getUTCSeconds()).padStart(2, '0');
            return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
        }
        
        var defaultStart = formatDateUTC(thirtyDaysAgo);
        var defaultEnd = formatDateUTC(now);
        
        // Just try to initialize - if plugin isn't loaded, it will fail gracefully
        try {
            var startPicker = jQuery("#canary-startpicker");
            if (startPicker.length > 0) {
                startPicker.datetimepicker(pickerConfig);
                // Set default value only if field is empty
                if (!startPicker.val()) {
                    startPicker.val(defaultStart);
                }
            }
        } catch(e) {
            console.warn('[DateTimePicker] Error initializing #canary-startpicker:', e);
        }
        
        try {
            var endPicker = jQuery("#canary-endpicker");
            if (endPicker.length > 0) {
                endPicker.datetimepicker(pickerConfig);
                // Set default value only if field is empty
                if (!endPicker.val()) {
                    endPicker.val(defaultEnd);
                }
            }
        } catch(e) {
            console.warn('[DateTimePicker] Error initializing #canary-endpicker:', e);
        }
    }

    /**
     * Update canary view based on active tab (preserved from original)
     */
    function updateCanaryView(id) {
        // Only show accordion and tabs container when there's actual data to display
        if (typeof canaryContextArray !== 'undefined' && canaryContextArray != null) {
            const accordion = document.getElementById('canary-dataview');
            const tabsContainer = document.getElementById('canary-tabs');
            
            if (accordion) {
                accordion.classList.add('visible');
            }
            if (tabsContainer) {
                tabsContainer.classList.add('visible');
            }
        }
        
        if(id == "zing"){
            updateUrl("canarytab","zing");
            if (typeof showCanaryTable === 'function') {
            if(typeof canaryContextArray !== 'undefined' && canaryContextArray != null){
            showCanaryTable(canaryContextArray,"canaryview",2);
            }
            }
        }else if(id == "zingcustom"){
            updateUrl("canarytab","zingcustom");
            if (typeof showCanaryTable === 'function') {
            if(typeof canaryContextArray !== 'undefined' && canaryContextArray != null){
            showCanaryTable(canaryContextArray,"canarycustomview",3);
            }
            }
        }else if(id == "perfswat"){
            updateUrl("canarytab","perfswat");
            if (typeof showCanaryTable === 'function') {
            if(typeof canaryContextArray !== 'undefined' && canaryContextArray != null){
            showCanaryTable(canaryContextArray,"canaryperfswatview",1);
            }
            }
        }else if(id == "perfswatcustom"){
            updateUrl("canarytab","perfswatcustom");
            if (typeof showCanaryTable === 'function') {
            if(typeof canaryContextArray !== 'undefined' && canaryContextArray != null){
            showCanaryTable(canaryContextArray,"canaryperfswatcustomview",4);
            }
            }
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
    window.updateCanaryView = updateCanaryView;
    
    /**
     * Calculate header height and position sidebar
     */
    function positionSidebarBelowHeader() {
        const header = document.getElementById('header');
        const sidebar = document.getElementById('leftNavSidebar');
        
        if (header && sidebar) {
            const headerHeight = header.offsetHeight || header.clientHeight || 60;
            sidebar.style.top = headerHeight + 'px';
            sidebar.style.height = 'calc(100vh - ' + headerHeight + 'px)';
        }
    }
    
    /**
     * Function to switch to a specific page
     */
    function switchToPage(pageId) {
        const navItems = document.querySelectorAll('.left-nav-item');
        const canariesPage = document.getElementById('canaries-page');
        const profilerPage = document.getElementById('profiler-page');
        const aidashboardPage = document.getElementById('aidashboard-page');
        
        // Remove active class from all nav items
        navItems.forEach(nav => nav.classList.remove('active'));
        
        // Add active class to the corresponding nav item
        const targetNavItem = document.querySelector('.left-nav-item[data-page="' + pageId + '"]');
        if (targetNavItem) {
            targetNavItem.classList.add('active');
        }
        
        // Hide all pages
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show the selected page
        if (pageId === 'canaries') {
            if (canariesPage) {
                canariesPage.classList.add('active');
                // Initialize datetime pickers when canaries page becomes active
                setTimeout(function() {
                    initCanaryDateTimePickers();
                    // Set default value for canary-source-input from dataHost if available
                    setCanarySourceDefault();
                    // Load canary data from URL parameters if they exist
                    loadCanaryDataFromUrl();
                }, 100);
            }
        } else if (pageId === 'profiler') {
            if (profilerPage) {
                profilerPage.classList.add('active');
            }
        } else if (pageId === 'aidashboard') {
            if (aidashboardPage) {
                aidashboardPage.classList.add('active');
            }
        }
    }
    
    /**
     * Function to restore page from URL parameter
     */
    function restorePageFromUrl() {
        // Get page parameter from URL
        let pageParam = null;
        if (typeof window.urlParams !== 'undefined') {
            pageParam = window.urlParams.get('page');
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            pageParam = urlParams.get('page');
        }
        
        // If page parameter exists and is valid, switch to that page
        if (pageParam && (pageParam === 'canaries' || pageParam === 'profiler' || pageParam === 'aidashboard')) {
            switchToPage(pageParam);
        } else {
            // Default to canaries page if no page parameter
            switchToPage('canaries');
        }
    }
    
    /**
     * Initialize Left Navigation Sidebar
     */
    function initLeftNavigation() {
        const sidebar = document.getElementById('leftNavSidebar');
        const toggle = document.getElementById('leftNavToggle');
        const mainContent = document.getElementById('mainContentWrapper');
        const navItems = document.querySelectorAll('.left-nav-item');
        
        if (!sidebar || !toggle) {
            console.warn('Left navigation sidebar elements not found');
            return;
        }
        
        // Position sidebar below header
        positionSidebarBelowHeader();
        
        // Recalculate on window resize
        window.addEventListener('resize', positionSidebarBelowHeader);
        
        // Mark as initialized to prevent duplicate listeners
        if (sidebar.hasEventListener) {
            return;
        }
        sidebar.hasEventListener = true;
        
        // Get arrow element once
        const collapseArrow = document.getElementById('leftNavCollapseArrow');
        
        // Function to toggle sidebar
        function toggleSidebar() {
            const isCollapsed = sidebar.classList.contains('collapsed');
            
            if (isCollapsed) {
                sidebar.classList.remove('collapsed');
                sidebar.classList.add('expanded');
                if (mainContent) {
                    mainContent.classList.remove('sidebar-collapsed');
                }
                // Update arrow to point left (collapse)
                if (collapseArrow) {
                    collapseArrow.classList.remove('fa-chevron-right');
                    collapseArrow.classList.add('fa-chevron-left');
                }
            } else {
                sidebar.classList.remove('expanded');
                sidebar.classList.add('collapsed');
                if (mainContent) {
                    mainContent.classList.add('sidebar-collapsed');
                }
                // Update arrow to point right (expand)
                if (collapseArrow) {
                    collapseArrow.classList.remove('fa-chevron-left');
                    collapseArrow.classList.add('fa-chevron-right');
                }
            }
        }
        
        // Initialize arrow direction based on initial state
        if (collapseArrow) {
            const isCollapsed = sidebar.classList.contains('collapsed');
            if (isCollapsed) {
                collapseArrow.classList.remove('fa-chevron-left');
                collapseArrow.classList.add('fa-chevron-right');
            } else {
                collapseArrow.classList.remove('fa-chevron-right');
                collapseArrow.classList.add('fa-chevron-left');
            }
        }
        
        // Toggle collapse/expand on nav toggle click
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });
        
        // Toggle collapse/expand on arrow click
        if (collapseArrow) {
            collapseArrow.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleSidebar();
            });
        }
        
        // Handle navigation item clicks
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const pageId = this.getAttribute('data-page');
                
                // Update URL with selected page
                if (typeof updateUrl === 'function') {
                    updateUrl('page', pageId);
                } else {
                    // Fallback: use URLSearchParams if updateUrl is not available
                    const urlParams = new URLSearchParams(window.location.search);
                    urlParams.set('page', pageId);
                    const newUrl = window.location.pathname + '?' + urlParams.toString() + window.location.hash;
                    window.history.pushState({}, '', newUrl);
                }
                
                // Switch to the selected page
                switchToPage(pageId);
            });
        });
    }
    
    // Initialize left navigation when DOM is ready
    function initializeLeftNav() {
        if (typeof jQuery !== 'undefined' && jQuery.fn) {
            jQuery(document).ready(function() {
                initLeftNavigation();
                // Restore page from URL after navigation is initialized
                restorePageFromUrl();
            });
        } else {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    initLeftNavigation();
                    // Restore page from URL after navigation is initialized
                    restorePageFromUrl();
                });
            } else {
                initLeftNavigation();
                // Restore page from URL after navigation is initialized
                restorePageFromUrl();
            }
        }
    }
    
    // Initialize immediately and also after a delay as fallback
    initializeLeftNav();
    
    // Position sidebar after header is rendered
    setTimeout(function() {
        positionSidebarBelowHeader();
        const sidebar = document.getElementById('leftNavSidebar');
        if (sidebar && !sidebar.hasEventListener) {
            initLeftNavigation();
            // Restore page from URL after navigation is initialized
            restorePageFromUrl();
        }
        // Set default value for canary-source-input on initial load
        setCanarySourceDefault();
        // Load canary data from URL parameters if they exist
        loadCanaryDataFromUrl();
    }, 100);
    
    // Also try after a longer delay to ensure header is fully loaded
    setTimeout(function() {
        positionSidebarBelowHeader();
        // Restore page from URL (fallback)
        restorePageFromUrl();
        // Set default value for canary-source-input (fallback)
        setCanarySourceDefault();
        // Load canary data from URL parameters (fallback)
        loadCanaryDataFromUrl();
    }, 500);

    function submitCanaryData() {
        const start = $("#canary-startpicker").val();
        const end = $("#canary-endpicker").val();
        const source = $("#canary-source-input").val();
        
        if (start && end && source) {
            // Update URL parameters
            if (typeof updateUrl === 'function') {
                updateUrl("startCanary", start);
                updateUrl("endCanary", end);
                updateUrl("host", source);
            }
            
            // Convert datetime string to timestamp
            // Format is 'Y-m-d H:i:s' (e.g., '2024-01-01 12:00:00')
            let startTimestamp, endTimestamp;
            
            // Try using moment.js if available
            if (typeof moment !== 'undefined') {
                startTimestamp = moment.utc(start, 'YYYY-MM-DD HH:mm:ss').valueOf();
                endTimestamp = moment.utc(end, 'YYYY-MM-DD HH:mm:ss').valueOf();
            } else {
                // Fallback to native Date parsing
                startTimestamp = new Date(start + ' UTC').getTime();
                endTimestamp = new Date(end + ' UTC').getTime();
            }
            
            if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
                toastMessage(toastType.ERROR, "Invalid date format. Please use the date picker.");
                return;
            }
            
            viewCanaryData(startTimestamp, endTimestamp, source);
        } else {
            toastMessage(toastType.ERROR, "Please fill in all fields: Start time, End time, and Source");
        }
    }

    function viewCanaryData(start, end, source) {
        // Prevent duplicate requests
        if (canaryDataRequestInProgress) {
            console.warn('[CanaryData] Request already in progress, skipping duplicate call');
            return;
        }
        
        URL = "v1/canaryview/" + source + "/?start=" + start + "&end=" + end;
        let currentSpinner = "canary-data-form";//"spinner"+$(".modern-tabs-nav-button.active").attr("data-tab-target");
        //showSpinner(currentSpinner);
        
        // Mark request as in progress
        canaryDataRequestInProgress = true;
        
        ProgressBar.start({container: currentSpinner, position: 'top',showIcon: true, icon: '🏄',iconStartPosition: 'top', splash:true});
        $.ajax({
            url: URL,
            timeout: 300000, // 5 minute timeout
            success: function (result) {
                canaryDataRequestInProgress = false; // Reset flag on success
                if (result != undefined && result.entry != undefined && result.entry.records != undefined && result.entry.records.canary != undefined && result.entry.records.canary[1] != undefined) {
                    canaryContextArray = result.entry.records.canary[1];
                    canaryContextHeader = result.entry.header.canary;
                    canaryCommentCounts = result.counts;
                    updateCanaryView($(".modern-tabs-nav-button.active").attr("data-tab-target"));
                    //showCanaryTable(canaryContextArray);
                }
                ProgressBar.stop({ explode: true,celebrate: true, });
                //hideSpinner(currentSpinner);
            },
            error: function (xhr, status, error) {
                canaryDataRequestInProgress = false; // Reset flag on error
                console.error('[CanaryData] AJAX error:', status, error, xhr);
                if (status === 'timeout') {
                    toastMessage(toastType.ERROR, "Request timed out. The server may be processing a large dataset.");
                } else if (status === 'parsererror') {
                    toastMessage(toastType.ERROR, "Failed to parse server response. The response may be incomplete.");
                } else {
                    toastMessage(toastType.ERROR, "Failed to process canary data: " + (error || status));
                }
                ProgressBar.stop({ explode: true });
                //hideSpinner(currentSpinner);
            },
            complete: function() {
                // Ensure flag is reset even if there's an unexpected error
                canaryDataRequestInProgress = false;
            }
        });
    }

function getCanaryHeader(start, end, source){
        URL = "v1/canaryheader";
        $.ajax({
            url: URL, success: function (result) {
                if (result != undefined) {
                    canaryContextViewHeaderConfig = result.header;
                    //viewCanaryData(start, end, source);
                }
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to get header");
            }
        });
    }

</script>

<#include "wave-js.ftl">

<!-- Left Navigation Sidebar -->
<div class="left-nav-sidebar expanded" id="leftNavSidebar">
    <div class="left-nav-toggle" id="leftNavToggle" title="Perf Genie">
        <img src="/images/warden-white.svg" alt="Toggle" class="left-nav-toggle-icon" />
        <span class="left-nav-toggle-title">Perf Genie</span>
    </div>
    <!-- Collapse/Expand Arrow - Middle Right Aligned -->
    <i class="fa fa-chevron-left left-nav-collapse-arrow" id="leftNavCollapseArrow" title="Collapse/Expand Navigation"></i>
    <div class="left-nav-menu">
        <a href="#" class="left-nav-item active" data-page="canaries" id="nav-canaries" title="Canary Hub">
            <i class="fa fa-fw fa-table left-nav-icon" aria-hidden="true"></i>
            <span class="left-nav-label">Canary Hub</span>
        </a>
        <a href="#" class="left-nav-item" data-page="aidashboard" id="nav-aidashboard" title="AI dashboard">
            <i class="fa fa-line-chart left-nav-icon" aria-hidden="true"></i>
            <span class="left-nav-label">AI dashboard</span>
        </a>
        <a href="#" class="left-nav-item" data-page="profiler" id="nav-profiler" title="Profiler & Diagnostics">
            <i class="fa fa-diamond left-nav-icon" aria-hidden="true"></i>
            <span class="left-nav-label">Profiler & Diagnostics</span>
        </a>
    </div>
</div>

<!-- Main Content Wrapper -->
<div class="main-content-wrapper" id="mainContentWrapper">
<!-- Canaries Page Content -->
<div id="canaries-page" class="page-content active">
<div class="data-view-header-placeholder" style="height: 44px; width: 100%;">Canary hub (process and explore data)</div>

<!-- Canary Data Input Form -->
<div id="canary-data-form" style="padding: 12px 16px; background: #ffffff;">
    <table class="ui-widget" style="border: hidden; width: auto;">
        <tr style="border: hidden;">
            <td style="border: none;">
                <label class="fieldlable">Start time UTC: </label>
            </td>
            <td style="border: none;">
                <input style="height:30px;text-align: center;" class="filterinput" id="canary-startpicker" type="text">
            </td>
            <td style="border: none;">
                <label class="fieldlable">End time UTC: </label>
            </td>
            <td style="border: none;">
                <input style="height:30px;text-align: center;" class="filterinput" id="canary-endpicker" type="text">
            </td>
            <td style="border: none;">
                <label class="fieldlable">Source: </label>
            </td>
            <td style="border: none;">
                <input style="height:30px;text-align: center;" class="filterinput" id="canary-source-input" type="text" value="perf-genie-test45">
            </td>
            <td style="padding: 0 0 0 8px; border: none; align-items: center;">
                <button onclick="submitCanaryData()" id="submit-canary-data" style="alignment:center;height:30px" class="ui-button ui-widget ui-corner-all">Submit</button>
            </td>
        </tr>
    </table>
</div>

<!-- Feature Card Selection -->
<div class="modern-tabs-container" id="canary-tabs">
    <ul class="modern-tabs-nav">
        <li class="modern-tabs-nav-item">
            <a href="#zing" class="modern-tabs-nav-button" data-tab-target="zing">
                <div class="card-title">Side by side</div>
            </a>
        </li>
        <li class="modern-tabs-nav-item">
            <a href="#zingcustom" class="modern-tabs-nav-button" data-tab-target="zingcustom">
                <div class="card-title">Side by side custom</div>
            </a>
        </li>
        <li class="modern-tabs-nav-item">
            <a href="#perfswat" class="modern-tabs-nav-button" data-tab-target="perfswat">
                <div class="card-title">Week over week</div>
            </a>
        </li>
        <li class="modern-tabs-nav-item">
            <a href="#perfswatcustom" class="modern-tabs-nav-button" data-tab-target="perfswatcustom">
                <div class="card-title">Week over week custom</div>
            </a>
        </li>
    </ul>
    
    <!-- Modern Accordion for Data Explorer -->
    <div class="modern-accordion" id="canary-dataview">
        <div class="modern-accordion-header" id="canary-dataview-header">
            <span class="modern-accordion-icon">▼</span>
            <span>Data explorer</span>
        </div>
        <div class="modern-accordion-content" id="canary-dataview-content">
            <div id="canary-dataviewcontent" style="padding-left: 4px; padding-bottom: 0px; padding-top: 0px;">tbd</div>
        </div>
    </div>
    
    <div class="modern-tabs-content">
        <div id="zing" class="modern-tab-panel" style="min-height: 900px; padding-top:4px !important;padding-left:0px !important;padding-right:8px !important;">
        <#include "contentnew.ftl">
    </div>
        <div id="zingcustom" class="modern-tab-panel" style="min-height: 900px; padding-top:4px !important;padding-left:0px !important;padding-right:8px !important;">
        <#include "contentcustomnew.ftl">
    </div>
        <div id="perfswat" class="modern-tab-panel" style="min-height: 900px; padding-top:4px !important;padding-left:0px !important;padding-right:8px !important;">
        <#include "perfswat.ftl">
    </div>
        <div id="perfswatcustom" class="modern-tab-panel" style="min-height: 900px; padding-top:4px !important;padding-left:0px !important;padding-right:8px !important;">
        <#include "perfswatcustom.ftl">
    </div>
</div>
</div>
</div>

<!-- Profiler & Diagnostics Page Content -->
<div id="profiler-page" class="page-content">
    <div class="data-view-header-placeholder" style="height: 44px; width: 100%;">Explore profiles and diagnostics data</div>
    <div style="padding: 0px;">
        <#include "../../input.ftl">
        <#include "../../filter-panel.ftl">
        <#include "../../context-view.ftl">
        <#include "../../tabs.ftl">
    </div>
</div>

<!-- AI Dashboard Page Content -->
<div id="aidashboard-page" class="page-content">
    <div class="data-view-header-placeholder" style="height: 44px; width: 100%;">AI dashboard</div>
    <div style="padding: 0px;">
        <#include "geniedash.ftl">
    </div>
</div>
</div>

<div id="canary-modals-guid" class="col-lg-12">
</div>

<div id="canary-overlay" class="overlay"></div>

<div id="canary-commentPopup">
    <input type="hidden" id="canary-cell" name="commentId" value="">
    <input type="hidden" id="canary-resulttime" name="resulttime" value="">
    <div id="canary-spinner1" class="spinner"></div>
    <div id="canary-comments" style="max-height: 300px;overflow: auto;border: 1px solid #ccc;"></div>
    <!-- Radio buttons for colors -->
    <div class="color-options">
        <label class="color-option" style="color: red;">
            <input type="radio" name="color" value="red"> Red
        </label>
        <label class="color-option" style="color: orange;">
            <input type="radio" name="color" value="orange"> Orange
        </label>
        <label class="color-option" style="color: green;">
            <input type="radio" name="color" value="green"> Green
        </label>
        <label class="color-option" style="color: black;">
            <input type="radio" name="color" value="black"> Black
        </label>
    </div>

    <!-- Textarea for the comment -->
    <textarea id="canary-commentText" placeholder="Your name: Type your comment here..."></textarea>

    <!-- Button container for submit/cancel buttons aligned to the right -->
    <div class="button-container">
        <button id="canary-submitComment">Submit</button>
        <button id="canary-cancelComment">Cancel</button>
    </div>
</div>
