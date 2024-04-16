<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>

<style>
    table, th, td {
        padding: 5px;
        align-content: center;
    }
    table {
        border-spacing: 25px;
    }
</style>


<div  style="padding: 0px" id="accordion" class="row">
    <div style="width:100%">Data source selector</div>
    <div  style="padding-bottom: 0px;" class="col-lg-12">

        <form  id="compare-context-selector-form" action="javascript:submitTo()" method="get"
               content="application/x-www-form-urlencoded">
        <table style="border: hidden;">
            <tr style="border: hidden;">
                <td style="border: none;"><label >Time range UTC from: </label></td>
                <td style="border: none;"><input  style="height:30px;text-align: center;" class="filterinput" id="startpicker1" type="text"></td>
                <td style="border: none;"><label>to: </label></td>
                <td style="border: none;"><input  style="height:30px;text-align: center;" class="filterinput" id="endpicker1" type="text"></td>
                <td style="border: none;"><label  for="tenant-input1" id="tenant-label1">Tenant: </label></td>
                <td style="border: none;">
                    <input  style="height:30px;text-align: center;" class="filterinput" id="tenant-input1" name="tenant1"
                           placeholder="Choose a tenant ..." list="tenants1"
                           class="form-control send-ga"
                           value=""/>
                    <datalist id="tenants1">
                    </datalist>
                </td>
                <td style="border: none;"><label  for="host-input1" id="host-label1">Host: </label></td>
                <td style="border: none;">
                    <input  style="height:30px;text-align: center;" class="filterinput" id="host-input1" name="host1"
                           placeholder="Choose a host..."
                           list="hosts1"
                           class="form-control send-ga"
                           value=""/>
                    <datalist id="hosts1">
                    </datalist>
                </td>
                <td style="border: none;">
                    <label for="bases1" id="base-label1">Profile: </label>
                    <span id="filter-profile-note1" style="color:#F0B778; display: none">Retry by providing time range > 10 min</span>
                    <select style="height:30px;text-align: center;width: 200px" class="filterinput"   id="bases1" name="base1" value="" placeholder="Choose a profile...">
                    </select>
                </td>
                <td style="padding: 0px;border: none;align-items:center;" rowspan="2">
                    <button id="submit-input" style="alignment:center;height:70px" class="ui-button ui-widget ui-corner-all">Submit</button>
                </td>
            </tr>
            <tr style="border: none;">
                <td style="border: none;"><label >Compare with (Optional): </label></td>
                <td style="border: none;"><input  style="height:30px;text-align: center;" class="filterinput" id="startpicker2" type="text"></td>
                <td style="border: none;"><label>to: </label></td>
                <td style="border: none;"><input  style="height:30px;text-align: center;" class="filterinput" id="endpicker2" type="text"></td>
                <td style="border: none;"><label  for="tenant-input2" id="tenant-label2">Tenant: </label></td>
                <td style="border: none;">
                    <input  style="height:30px;text-align: center;" class="filterinput" id="tenant-input2" name="tenant2"
                           placeholder="Choose a tenant ..." list="tenants2"
                           class="form-control send-ga"
                           value=""/>
                    <datalist id="tenants2">
                    </datalist>
                </td>
                <td style="border: none;"><label  for="host-input2" id="host-label2">Host: </label></td>
                <td style="border: none;">
                    <input  style="height:30px;text-align: center;" class="filterinput" id="host-input2" name="host2"
                           placeholder="Choose a host..."
                           list="hosts2"
                           class="form-control send-ga"
                           value=""/>
                    <datalist id="hosts2">
                    </datalist>
                </td>
                <td style="border: none;">
                    <label for="bases2" id="base-label2">Profile: </label>
                    <span id="filter-profile-note2" style="color:#F0B778; display: none">Retry by providing time range > 10 min</span>
                    <select  style="height:30px;text-align: center;width: 200px" class="filterinput" id="bases2" name="base2" value="" placeholder="Choose a profile...">
                    </select>
                </td>
            </tr>
        </table>
            <div id="input-info" class="ui-state-highlight ui-widget-header ui-corner-all" style="float: left !important;display:none">
                <span class="ui-icon ui-icon-info"></span> <span id="input-info-text"></span>
            </div>
        </form>
    </div>
</div>

<script>

</script>