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

<#include "tabs-js.ftl">

<div id="tabs">
    <#include "tab-filter-toolbar.ftl">
    <ul>
        <li><a href="#cct">Calling context tree</a></li>
        <li><a href="#samples">Samples Explorer</a></li>
        <li><a href="#flame">Flame graph</a></li>
        <li><a href="#river">River view</a></li>
        <li><a href="#surface">Hotspot surface</a></li>
        <li><a href="#tsview">Thread state view</a></li>
    </ul>
    <div id="view-info" class="ui-state-highlight ui-widget-header ui-corner-all" style="float: right !important;display:none">
        <span class="ui-icon ui-icon-info"></span> <span id="view-info-text"></span>
    </div>
    <div id="cct" style="min-height: 900px; paddingt-left: 0px" class="row no-padding">
        <#include "cct.ftl">
    </div>
    <div id="samples">
        <#include "sample.ftl">
    </div>
    <div id="flame">
        <#include "flame.ftl">
    </div>
    <div id="river">
        <#include "river.ftl">
    </div>
    <div id="surface">
        <#include "surface.ftl">
    </div>
    <div id="tsview">
        <#include "tsview-new.ftl">
    </div>
</div>
<div id="modals-guid" class="col-lg-12">
</div>