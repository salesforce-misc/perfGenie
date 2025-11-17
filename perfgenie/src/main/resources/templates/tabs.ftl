<style>
    /* View Info - toast-style yellow warning with glassmorphism (same as input-info, but slides from right) */
    #view-info {
        padding: 0 !important; /* No padding to minimize height */
        color: #ffffff !important; /* White text for toast style */
        /* Don't set display here - let inline style and jQuery control it */
        /* Toast-style glassmorphism with darker yellow warning tint for better text visibility */
        background: rgba(255, 183, 77, 0.35) !important; /* Darker yellow/orange warning tint */
        background-image: 
            linear-gradient(135deg, rgba(255, 183, 77, 0.45) 0%, rgba(255, 152, 0, 0.3) 50%, rgba(255, 183, 77, 0.45) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%) !important;
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        /* Toast-style border */
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        border-radius: 8px !important; /* Toast-style rounded corners */
        /* Toast-style shadows */
        box-shadow: 
            0 4px 16px rgba(255, 183, 77, 0.3),
            0 2px 8px rgba(255, 183, 77, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            inset 0 -1px 0 rgba(0, 0, 0, 0.08),
            0 8px 32px rgba(255, 152, 0, 0.18) !important;
        /* Toast-style text shadow for white text on yellow background */
        text-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.4),
            0 0 8px rgba(255, 183, 77, 0.6),
            0 2px 4px rgba(0, 0, 0, 0.3) !important;
        font-weight: 500 !important;
        font-size: 0.85em !important; /* Smaller font */
        margin: 0 !important;
        /* Use absolute positioning instead of float for better slide control */
        position: absolute !important;
        right: 0 !important;
        top: 0 !important;
        z-index: 10 !important; /* Ensure it's above other content */
        line-height: 1.1 !important; /* Very tight line height */
        /* Constrain width to content so it stops when all text is shown */
        width: auto !important;
        max-width: 100% !important;
        white-space: nowrap !important; /* Prevent text wrapping */
        overflow: hidden !important; /* Hide overflow */
        /* Don't set display or transition - let jQuery slide animation handle it */
    }
    
    /* Don't force display - let inline style and jQuery control it for slide animation */
    /* The inline style="display:none" will handle initial hidden state */
    /* jQuery's .toggle("slide", {direction: "right"}) will slide from right to left */

    /* Ensure jQuery UI classes don't override our toast styling */
    #view-info.ui-state-highlight,
    #view-info.ui-widget-header {
        background: rgba(255, 183, 77, 0.35) !important;
        background-image: 
            linear-gradient(135deg, rgba(255, 183, 77, 0.45) 0%, rgba(255, 152, 0, 0.3) 50%, rgba(255, 183, 77, 0.45) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        color: #ffffff !important;
        padding: 0 !important;
    }
    
    /* No padding on inner content to minimize height */
    #view-info-text {
        padding: 0 !important;
        display: inline-block !important;
    }
    
    /* Icon styling - no padding */
    #view-info .ui-icon {
        display: inline-block;
        margin-right: 4px;
        vertical-align: middle;
        padding: 0 !important;
        margin: 0 4px 0 0 !important;
    }
</style>

<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/

    function addTabNote(toggle, msg){
        if(toggle){
            if($( "#view-info" ).css("display") === "none"){
                if(msg !== "") {
                    $("#view-info-text").html(msg);
                    $("#view-info").toggle("slide", {direction: "right"}, 500);
                }
            }
        }else{
            if($( "#view-info-text" ).html("") != "") {
                $("#view-info").css("display", "none");
                $("#view-info-text").html("");
            }
        }
    }

</script>

<link rel="stylesheet" href="/css/modern-tabs.css">
<script src="/js/modern-tabs.js"></script>
<#include "tabs-js.ftl">
<#include "geniehostselector.ftl">
<div id="tabs" class="modern-tabs-container">
    <#include "tab-filter-toolbar.ftl">
    <ul class="modern-tabs-nav">
        <li class="modern-tabs-nav-item"><a href="#cct" class="modern-tabs-nav-button" data-tab-target="cct">Calling context tree</a></li>
        <li class="modern-tabs-nav-item"><a href="#samples" class="modern-tabs-nav-button" data-tab-target="samples">Samples Explorer</a></li>
        <li class="modern-tabs-nav-item"><a href="#flame" class="modern-tabs-nav-button" data-tab-target="flame">Flame graph</a></li>
        <li class="modern-tabs-nav-item"><a href="#river" class="modern-tabs-nav-button" data-tab-target="river">River view</a></li>
        <li class="modern-tabs-nav-item"><a href="#surface" class="modern-tabs-nav-button" data-tab-target="surface">Hotspot surface</a></li>
        <li class="modern-tabs-nav-item"><a href="#tsview" class="modern-tabs-nav-button" data-tab-target="tsview">Thread state view</a></li>
    </ul>
    <div id="view-info" class="ui-state-highlight ui-widget-header ui-corner-all" style="display:none">
        <span class="ui-icon ui-icon-info"></span> <span id="view-info-text"></span>
    </div>
    <div class="modern-tabs-content">
        <div id="cct" class="modern-tab-panel row no-padding" style="min-height: 900px; paddingt-left: 0px">
            <#include "cct.ftl">
        </div>
        <div id="samples" class="modern-tab-panel">
            <#include "sample.ftl">
        </div>
        <div id="flame" class="modern-tab-panel">
            <#include "flame.ftl">
        </div>
        <div id="river" class="modern-tab-panel">
            <#include "river.ftl">
        </div>
        <div id="surface" class="modern-tab-panel">
            <#include "surface.ftl">
        </div>
        <div id="tsview" class="modern-tab-panel">
            <#include "tsview-new.ftl">
        </div>
    </div>
</div>
<div id="modals-guid" class="col-lg-12">
</div>