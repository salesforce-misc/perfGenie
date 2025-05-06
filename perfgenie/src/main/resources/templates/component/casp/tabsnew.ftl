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
            }
        });
        $(function () {
            $("#dataview").accordion({
                collapsible: true,
                active: false,
                heightStyle: "content"
            });
        });
    });

</script>
<div style="" id="dataview">
    <h3 style="width:100%;padding-top: 2px !important;padding-bottom: 2px !important;">Data explorer</h3>
    <div>tbd</div>
</div>
<div id="tabs">
    <ul>
        <li><a href="#zing">Side by side</a></li>
        <li><a href="#perfswat">Week over week</a></li>
    </ul>
    <div id="zing" style="min-height: 900px; paddingt-left: 0px" class="row no-padding">
        <#include "contentnew.ftl">
    </div>
    <div id="perfswat">
        <#include "perfswat.ftl">
    </div>
</div>
<div id="modals-guid" class="col-lg-12">
</div>