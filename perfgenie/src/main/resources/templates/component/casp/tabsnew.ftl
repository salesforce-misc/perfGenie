<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
    $(document).ready(() => {
        $("#tabs").tabs({
            activate: function (event, ui) {
                updateCanaryView(ui.newPanel.attr("id"));
            }
        });
        $(function () {
            $("#dataview").accordion({
                collapsible: true,
                active: false,
                heightStyle: "content"
            });
        });

        jQuery("#startpicker3").datetimepicker({
            format: 'Y-m-d H:i:s',
            formatDate: 'Y-m-d',
            formatTime: 'H:i',
            step: 5
        });

        jQuery("#endpicker3").datetimepicker({
            format: 'Y-m-d H:i:s',
            formatDate: 'Y-m-d',
            formatTime: 'H:i',
            step: 5
        });

        jQuery("#startpicker4").datetimepicker({
            format: 'Y-m-d H:i:s',
            formatDate: 'Y-m-d',
            formatTime: 'H:i',
            step: 5
        });

        jQuery("#endpicker4").datetimepicker({
            format: 'Y-m-d H:i:s',
            formatDate: 'Y-m-d',
            formatTime: 'H:i',
            step: 5
        });

        jQuery("#startpicker5").datetimepicker({
            format: 'Y-m-d H:i:s',
            formatDate: 'Y-m-d',
            formatTime: 'H:i',
            step: 5
        });

        jQuery("#endpicker5").datetimepicker({
            format: 'Y-m-d H:i:s',
            formatDate: 'Y-m-d',
            formatTime: 'H:i',
            step: 5
        });
    });

    function updateCanaryView(id) {
        if(id == "zing"){
            updateTabUrl("#zing");
            showCanaryTable(canaryContextArray,"canaryview",2);
        }else if(id == "zingcustom"){
            updateTabUrl("#zingcustom");
            showCanaryTable(canaryContextArray,"canarycustomview",3);
        }else if(id == "perfswat"){
            updateTabUrl("#perfswat");
            showCanaryTable(canaryContextArray,"canaryperfswatview",4);
        }
    }

</script>
<#include "wave-js.ftl">
<div style="" id="dataview">
    <h3 style="width:100%;padding-top: 2px !important;padding-bottom: 2px !important;">Data explorer</h3>
    <div style="padding-left: 23px; padding-bottom: 0px; padding-top: 0px;" id="dataviewcontent">tbd</div>
</div>
<div id="tabs">
    <ul>
        <li><a href="#zing">Side by side</a></li>
        <li><a href="#zingcustom">Side by side custom</a></li>
        <li><a href="#perfswat">Week over week</a></li>
    </ul>
    <div id="zing" style="min-height: 900px; paddingt-left: 0px" class="row no-padding">
        <#include "contentnew.ftl">
    </div>
    <div id="zingcustom" style="min-height: 900px; paddingt-left: 0px" class="row no-padding">
        <#include "contentcustomnew.ftl">
    </div>
    <div id="perfswat">
        <#include "perfswat.ftl">
    </div>
</div>
<div id="modals-guid" class="col-lg-12">
</div>

<div id="overlay" class="overlay"></div>

<div id="commentPopup">
    <input type="hidden" id="cell" name="commentId" value="">
    <input type="hidden" id="resulttime" name="resulttime" value="">
    <div id="spinner1" class="spinner"></div>
    <div id="comments" style="max-height: 300px;overflow: auto;border: 1px solid #ccc;"></div>
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
    <textarea id="commentText" placeholder="Your name: Type your comment here..."></textarea>

    <!-- Button container for submit/cancel buttons aligned to the right -->
    <div class="button-container">
        <button id="submitComment">Submit</button>
        <button id="cancelComment">Cancel</button>
    </div>
</div>