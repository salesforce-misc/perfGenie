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

    /* Form Layout Container - replaces table - uses CSS Grid for column alignment */
    /* Layout: label input label input label input label input label input submit backup/checkbox */
    /* Total: 12 columns - 5 fields (2 cols each) = 10, submit = 1, backup/checkbox = 1 */
    .form-layout-wrapper {
        display: grid;
        grid-template-columns: auto auto auto auto auto auto auto auto auto auto auto auto;
        grid-template-rows: auto auto; /* 2 rows */
        align-items: center;
        gap: 5px 0px; /* row-gap column-gap - no column gap */
    }

    /* Form Field Label - separate grid item */
    .form-field-label {
        white-space: nowrap; /* Prevent label wrapping */
        padding-right: 3px; /* Very small gap between label and its input */
    }

    /* Form Field Input - separate grid item */
    .form-field-input {
        display: flex;
        align-items: center;
        margin-right: 10px; /* Space between field groups (after each input) */
    }
    
    /* Remove margin from last input in each row group */
    .form-field-input:nth-child(10),
    .form-field-input:nth-child(22) {
        margin-right: 0; /* No margin needed before submit button */
    }

    /* Submit Button Container - spans both rows */
    .submit-button-container {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }

    /* Backup Icon Container - first row, last column */
    .backup-icon-container {
        display: flex;
        align-items: center;
        padding: 0;
    }

    /* Checkbox container in second row */
    .checkbox-container {
        display: flex;
        align-items: center;
        padding-left: 9px;
    }

    /* Modern Label Styling */
    .fieldlable {
        font-weight: 500;
        color: #495057;
    }

    /* Modern Input Styling - all dimensions preserved */
    .filterinput {
        border: 1px solid #dee2e6 !important;
        border-radius: 4px;
        background: #ffffff;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .filterinput:hover {
        border-color: #adb5bd !important;
    }

    .filterinput:focus {
        outline: none;
        border-color: #46a5e3 !important;
        box-shadow: 0 0 0 3px rgba(70, 165, 227, 0.1);
    }

    .filterinput::placeholder {
        color: #adb5bd;
    }

    /* Fix datalist dropdown arrow alignment and remove right edge gap */
    .filterinput[list] {
        padding-right: 0px !important;
        padding-left: 10px !important;
        text-align: center !important;
        box-sizing: border-box;
    }

    /* Modern Submit Button - height preserved (70px) */
    #submit-input {
        background: linear-gradient(to bottom, #5a9dd4, #60b3ea) !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 4px;
        font-weight: 600;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(63, 127, 196, 0.2);
    }

    #submit-input:hover {
        background: linear-gradient(to bottom, #4a8dc4, #54a3da) !important;
        box-shadow: 0 4px 8px rgba(63, 127, 196, 0.3);
        transform: translateY(-1px);
    }

    #submit-input:active {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba(55, 115, 179, 0.2);
    }

    /* Modern Backup Icon - font-size preserved (20px) */
    #backup-gold {
        color: #46a5e3;
        transition: color 0.2s ease, background 0.2s ease;
        padding: 4px;
        border-radius: 4px;
    }

    #backup-gold:hover {
        color: #3773b3;
        background: #e9ecef;
    }

    /* Modern Checkbox - dimensions preserved (17px x 17px) */
    #usegold {
        accent-color: #46a5e3;
        cursor: pointer;
    }

    /* Modern Spinner - dimensions preserved (25px x 25px) */
    .spinner {
        display: none;
        width: 25px;
        height: 25px;
        margin: 0px auto;
        border-radius: 50%;
        border: 4px solid rgba(70, 165, 227, 0.2);
        border-top-color: #46a5e3;
        animation: spin 1s infinite linear;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
</style>


<div  id="accordion">
    <div style="border:0px;width:100%;padding-top: 0px !important;padding-bottom: 0px !important;">Data source selector&nbsp;&nbsp;&nbsp;<span onclick="onClickNoop(event);" style="padding-bottom:2px;padding-top:2px;cursor: default !important; width:75%; display: inline-block;">&nbsp;</span></div>
    <div  style="padding-left:20px; padding-bottom: 0px; " class="col-lg-12">

        <form  id="compare-context-selector-form" action="javascript:submitTo()" method="get"
               content="application/x-www-form-urlencoded">
            <span style="float:right;" class="spinner" id="spinner"></span>

        <div class="form-layout-wrapper">
            <!-- Row 1: Field 1 - Time range UTC from -->
            <label class="fieldlable form-field-label" style="grid-column: 1; grid-row: 1;">Time range UTC from: </label>
            <div class="form-field-input" style="grid-column: 2; grid-row: 1;">
                <input style="height:30px;text-align: center;" class="filterinput" id="startpicker1" type="text">
            </div>
            
            <!-- Row 1: Field 2 - to -->
            <label class="fieldlable form-field-label" style="grid-column: 3; grid-row: 1;">to: </label>
            <div class="form-field-input" style="grid-column: 4; grid-row: 1;">
                <input style="height:30px;text-align: center;" class="filterinput" id="endpicker1" type="text">
            </div>
            
            <!-- Row 1: Field 3 - Tenant -->
            <label for="tenant-input1" id="tenant-label1" class="fieldlable form-field-label" style="grid-column: 5; grid-row: 1;">Tenant: </label>
            <div id="tenant-field-div1" class="form-field-input" style="grid-column: 6; grid-row: 1;">
                <input style="height:30px;text-align: center;" class="filterinput form-control send-ga" id="tenant-input1" name="tenant1"
                       placeholder="Choose a tenant ..." list="tenants1"
                       value=""/>
                <datalist id="tenants1">
                </datalist>
            </div>
            
            <!-- Row 1: Field 4 - Host -->
            <label for="host-input1" id="host-label1" class="fieldlable form-field-label" style="grid-column: 7; grid-row: 1;">Host: </label>
            <div id="host-field-div1" class="form-field-input" style="grid-column: 8; grid-row: 1;">
                <input style="height:30px;text-align: center;" class="filterinput form-control send-ga" id="host-input1" name="host1"
                       placeholder="Choose a host..."
                       list="hosts1"
                       value=""/>
                <datalist id="hosts1">
                </datalist>
            </div>
            
            <!-- Row 1: Field 5 - Profile -->
            <label title="profiles collected during selected time range" for="bases1" id="base-label1" class="fieldlable form-field-label" style="grid-column: 9; grid-row: 1;">Profile: </label>
            <div id="profile-field-div1" class="form-field-input" style="grid-column: 10; grid-row: 1;">
                <span id="filter-profile-note1" style="color:#F0B778; display: none">Retry by providing time range > 10 min</span>
                <select style="height:30px;text-align: center;width: 200px" class="filterinput" id="bases1" name="base1" value="" placeholder="Choose a profile...">
                </select>
            </div>
            
            <!-- Row 2: Field 1 - Compare with -->
            <label class="fieldlable form-field-label" style="grid-column: 1; grid-row: 2;">Compare with (Optional): </label>
            <div class="form-field-input" style="grid-column: 2; grid-row: 2;">
                <input style="height:30px;text-align: center;" class="filterinput" id="startpicker2" type="text">
            </div>
            
            <!-- Row 2: Field 2 - to -->
            <label class="fieldlable form-field-label" style="grid-column: 3; grid-row: 2;">to: </label>
            <div class="form-field-input" style="grid-column: 4; grid-row: 2;">
                <input style="height:30px;text-align: center;" class="filterinput" id="endpicker2" type="text">
            </div>
            
            <!-- Row 2: Field 3 - Tenant -->
            <label for="tenant-input2" id="tenant-label2" class="fieldlable form-field-label" style="grid-column: 5; grid-row: 2;">Tenant: </label>
            <div id="tenant-field-div2" class="form-field-input" style="grid-column: 6; grid-row: 2;">
                <input style="height:30px;text-align: center;" class="filterinput form-control send-ga" id="tenant-input2" name="tenant2"
                       placeholder="Choose a tenant ..." list="tenants2"
                       value=""/>
                <datalist id="tenants2">
                </datalist>
            </div>
            
            <!-- Row 2: Field 4 - Host -->
            <label for="host-input2" id="host-label2" class="fieldlable form-field-label" style="grid-column: 7; grid-row: 2;">Host: </label>
            <div id="host-field-div2" class="form-field-input" style="grid-column: 8; grid-row: 2;">
                <input style="height:30px;text-align: center;" class="filterinput form-control send-ga" id="host-input2" name="host2"
                       placeholder="Choose a host..."
                       list="hosts2"
                       value=""/>
                <datalist id="hosts2">
                </datalist>
            </div>
            
            <!-- Row 2: Field 5 - Profile -->
            <label title="profiles collected during selected time range" for="bases2" id="base-label2" class="fieldlable form-field-label" style="grid-column: 9; grid-row: 2;">Profile: </label>
            <div id="profile-field-div2" class="form-field-input" style="grid-column: 10; grid-row: 2;">
                <span id="filter-profile-note2" style="color:#F0B778; display: none">Retry by providing time range > 10 min</span>
                <select style="height:30px;text-align: center;width: 200px" class="filterinput" id="bases2" name="base2" value="" placeholder="Choose a profile...">
                </select>
            </div>
            
            <!-- Submit button spans both rows -->
            <div class="submit-button-container" style="grid-column: 11; grid-row: 1 / 3;">
                <button id="submit-input" style="alignment:center;height:70px" class="ui-button ui-widget ui-corner-all">Submit</button>
            </div>
            
            <!-- Backup icon - row 1 -->
            <div class="backup-icon-container" style="grid-column: 12; grid-row: 1;">
                <i id="backup-gold" title="backup data to GOLD namespace which has higher TTL" style="font-size:20px; cursor: pointer;" class="fa fa-floppy-o" onclick="backupAsGold()"></i>
            </div>
            
            <!-- Checkbox - row 2 -->
            <div class="checkbox-container" style="padding-left:4px; grid-column: 12; grid-row: 2;">
                <input title="use GOLD namespace backup data source" style="width:17px; height:17px; cursor: pointer;" type="checkbox" id="usegold" onclick="handleGoldCheck()">
            </div>
        </div>
            <div id="input-info" class="ui-state-highlight ui-widget-header ui-corner-all" style="float: left !important;display:none">
                <span class="ui-icon ui-icon-info"></span> <span id="input-info-text"></span>
            </div>
            <div id="dashboard-container"></div>
        </form>
        <div id="dashboard-container"></div>
    </div>

</div>

<script>

    $(document).ready(function () {
        if(dataSource == "gold"){
            $("#usegold").prop("checked", true);
            $("#backup-gold").hide();
        }
    });

    function onClickNoop(event){
        event.stopPropagation();
    }



</script>