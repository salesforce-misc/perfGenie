<style>
    /* Ensure input fields maintain their color after datetimepicker selection or autocomplete */
    #startpicker4.filterinput,
    #endpicker4.filterinput,
    #swatcell-input1.filterinput,
    #startpicker5.filterinput,
    #endpicker5.filterinput,
    #swatcell-input2.filterinput,
    #startpicker4.filterinput.hasDatepicker,
    #endpicker4.filterinput.hasDatepicker,
    #swatcell-input1.filterinput.hasDatepicker,
    #startpicker5.filterinput.hasDatepicker,
    #endpicker5.filterinput.hasDatepicker,
    #swatcell-input2.filterinput.hasDatepicker {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #343a40 !important;
    }
    
    #startpicker4.filterinput:focus,
    #endpicker4.filterinput:focus,
    #swatcell-input1.filterinput:focus,
    #startpicker5.filterinput:focus,
    #endpicker5.filterinput:focus,
    #swatcell-input2.filterinput:focus,
    #startpicker4.filterinput.hasDatepicker:focus,
    #endpicker4.filterinput.hasDatepicker:focus,
    #swatcell-input1.filterinput.hasDatepicker:focus,
    #startpicker5.filterinput.hasDatepicker:focus,
    #endpicker5.filterinput.hasDatepicker:focus,
    #swatcell-input2.filterinput.hasDatepicker:focus {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #343a40 !important;
    }
    
    /* Override browser autocomplete background color */
    #startpicker4.filterinput:-webkit-autofill,
    #endpicker4.filterinput:-webkit-autofill,
    #swatcell-input1.filterinput:-webkit-autofill,
    #startpicker5.filterinput:-webkit-autofill,
    #endpicker5.filterinput:-webkit-autofill,
    #swatcell-input2.filterinput:-webkit-autofill,
    #startpicker4.filterinput:-webkit-autofill:hover,
    #endpicker4.filterinput:-webkit-autofill:hover,
    #swatcell-input1.filterinput:-webkit-autofill:hover,
    #startpicker5.filterinput:-webkit-autofill:hover,
    #endpicker5.filterinput:-webkit-autofill:hover,
    #swatcell-input2.filterinput:-webkit-autofill:hover,
    #startpicker4.filterinput:-webkit-autofill:focus,
    #endpicker4.filterinput:-webkit-autofill:focus,
    #swatcell-input1.filterinput:-webkit-autofill:focus,
    #startpicker5.filterinput:-webkit-autofill:focus,
    #endpicker5.filterinput:-webkit-autofill:focus,
    #swatcell-input2.filterinput:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
        -webkit-text-fill-color: #343a40 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #343a40 !important;
    }
    
    /* PerfSwat Input Info - toast-style yellow warning with glassmorphism (matching input.ftl) */
    #perfswat-input-info {
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
        float: left !important;
        line-height: 1.1 !important; /* Very tight line height */
        /* Don't set display or transition - let jQuery slide animation handle it */
    }
    
    /* Ensure jQuery UI classes don't override our toast styling */
    #perfswat-input-info.ui-state-highlight,
    #perfswat-input-info.ui-widget-header {
        background: rgba(255, 183, 77, 0.35) !important;
        background-image: 
            linear-gradient(135deg, rgba(255, 183, 77, 0.45) 0%, rgba(255, 152, 0, 0.3) 50%, rgba(255, 183, 77, 0.45) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        color: #ffffff !important;
        padding: 0 !important;
    }
    
    /* No padding on inner content to minimize height */
    #perfswat-input-info-text {
        padding: 0 !important;
        display: inline-block !important;
    }
    
    /* Icon styling - no padding */
    #perfswat-input-info .ui-icon {
        display: inline-block;
        margin-right: 4px;
        vertical-align: middle;
        padding: 0 !important;
        margin: 0 4px 0 0 !important;
    }
</style>

<table class='ui-widget' style="border: hidden;">
    <tr style="border: hidden;">
        <td style="border: none;"><label class="fieldlable">Time range UTC from: </label></td>
        <td style="border: none;"><input style="height:30px;text-align: center;" class="filterinput" id="startpicker4"
                                         type="text"></td>
        <td style="border: none;"><label class="fieldlable">to: </label></td>
        <td style="border: none;"><input style="height:30px;text-align: center;" class="filterinput" id="endpicker4"
                                         type="text"></td>
        <td style="border: none;"><label for="swatcell-input1" id="cell-label1" class="fieldlable">Cell: </label></td>
        <td style="border: none;">
            <input style="width:60px;height:30px;text-align: center;" class="filterinput" id="swatcell-input1" name="cell1"
                   type="text"
                   value=""/>
        </td>

        <td style="padding: 10px;border: none;align-items:center;" rowspan="2">
            <button onclick="processPerfSwat()" id="submit-perfswat-input"
                    class="modern-button modern-button-green" disabled>Process
            </button>
        </td>
    </tr>
    <tr style="border: hidden;">
        <td style="border: none;"><label class="fieldlable">Compare with UTC from: </label></td>
        <td style="border: none;"><input style="height:30px;text-align: center;" class="filterinput" id="startpicker5"
                                         type="text"></td>
        <td style="border: none;"><label class="fieldlable">to: </label></td>
        <td style="border: none;"><input style="height:30px;text-align: center;" class="filterinput" id="endpicker5"
                                         type="text"></td>
        <td style="border: none;"><label for="swatcell-input2" id="cell-label2" class="fieldlable">Cell: </label></td>
        <td style="border: none;">
            <input style="width:60px;height:30px;text-align: center;" class="filterinput" id="swatcell-input2" name="cell2"
                   type="text"
                   value=""/>
        </td>


    </tr>

</table>

<div id="perfswat-input-info" class="ui-state-highlight ui-widget-header ui-corner-all"
     style="float: left !important;display:none">
    <span class="ui-icon ui-icon-info"></span> <span id="perfswat-input-info-text"></span>
</div>

<div id="spinnerswatcustom" class="spinner"></div>
<div style="padding:0px !important; overflow: scroll;font-size: 95%" class="col-lg-12">
    <div id="canaryperfswatcustomview"></div>
</div>

<script type="text/javascript" class="init">

    /**
     * Check if all required perfswat form fields are filled
     */
    function validatePerfSwatForm() {
        const start1 = $("#startpicker4").val();
        const end1 = $("#endpicker4").val();
        const cell1 = $("#swatcell-input1").val();
        const start2 = $("#startpicker5").val();
        const end2 = $("#endpicker5").val();
        const cell2 = $("#swatcell-input2").val();
        
        const isValid = start1 && start1.trim() !== '' && 
                       end1 && end1.trim() !== '' && 
                       cell1 && cell1.trim() !== '' &&
                       start2 && start2.trim() !== '' && 
                       end2 && end2.trim() !== '' && 
                       cell2 && cell2.trim() !== '';
        
        const submitButton = document.getElementById('submit-perfswat-input');
        if (submitButton) {
            submitButton.disabled = !isValid;
        }
        
        return isValid;
    }
    
    /**
     * Initialize perfswat form validation
     */
    function initPerfSwatFormValidation() {
        // Disable button initially
        const submitButton = document.getElementById('submit-perfswat-input');
        if (submitButton) {
            submitButton.disabled = true;
        }
        
        // Add event listeners to input fields
        const startPicker1 = $("#startpicker4");
        const endPicker1 = $("#endpicker4");
        const cellInput1 = $("#swatcell-input1");
        const startPicker2 = $("#startpicker5");
        const endPicker2 = $("#endpicker5");
        const cellInput2 = $("#swatcell-input2");
        
        // Listen for input changes
        if (startPicker1.length) {
            startPicker1.on('change blur', validatePerfSwatForm);
            startPicker1.on('dp.change', validatePerfSwatForm);
        }
        if (endPicker1.length) {
            endPicker1.on('change blur', validatePerfSwatForm);
            endPicker1.on('dp.change', validatePerfSwatForm);
        }
        if (cellInput1.length) {
            cellInput1.on('input change blur', validatePerfSwatForm);
        }
        if (startPicker2.length) {
            startPicker2.on('change blur', validatePerfSwatForm);
            startPicker2.on('dp.change', validatePerfSwatForm);
        }
        if (endPicker2.length) {
            endPicker2.on('change blur', validatePerfSwatForm);
            endPicker2.on('dp.change', validatePerfSwatForm);
        }
        if (cellInput2.length) {
            cellInput2.on('input change blur', validatePerfSwatForm);
        }
        
        // Initial validation
        validatePerfSwatForm();
    }
    
    // Initialize validation when document is ready
    $(document).ready(function() {
        // Wait a bit for datetime pickers to be initialized
        setTimeout(function() {
            initPerfSwatFormValidation();
        }, 200);
    });

    function processPerfSwat() {
        let info = " start: " + moment.utc($("#startpicker4").val()).format('ddd, MMM D YYYY HH:mm:ss [UTC]') + " end: " + moment.utc($("#endpicker4").val()).format('ddd, MMM D YYYY HH:mm:ss [UTC]') + " cell: '" + $('#swatcell-input1').val() + "'";

        if ($("#startpicker4").val() != "" && $("#endpicker4").val() != "" && $('#swatcell-input1').val() != undefined && $('#swatcell-input1').val() != "" &&  $("#startpicker5").val() != "" && $("#endpicker5").val() != "" && $('#swatcell-input2').val() != "" && $('#swatcell-input2').val() != undefined) {
            let duration = (moment.utc($("#endpicker4").val()).valueOf() - moment.utc($("#startpicker4").val()).valueOf());
            let duration2 = (moment.utc($("#endpicker5").val()).valueOf() - moment.utc($("#startpicker5").val()).valueOf());
            if (duration <= 24 * 60 * 60 * 1000 && duration2 <= 24 * 60 * 60 * 1000) {
                $("#submit-perfswat-input").attr("disabled", true);
                $('#perfswat-input-info-text').html("Processing " + info + " This may take couple of munutes ...");
                $("#perfswat-input-info").toggle("slide");
                processCustomPerfswatData(moment.utc($("#startpicker4").val()).valueOf(), moment.utc($("#endpicker4").val()).valueOf(), $('#swatcell-input1').val(),moment.utc($("#startpicker5").val()).valueOf(), moment.utc($("#endpicker5").val()).valueOf(), $('#swatcell-input2').val());
            } else {
                $('#perfswat-input-info-text').html("Invalid input: time range 1: " + duration / (60 * 1000) + " time range 2: " + duration2 / (60 * 1000) + " min,  one of them is more than 24 hours");
                $("#perfswat-input-info").toggle("slide");
            }
            //process and remove message
        } else {
            $('#perfswat-input-info-text').html("Invalid input " + info);
            $("#perfswat-input-info").toggle("slide");
        }
    }

    function processCustomPerfswatData(start1, end1, cell1, start2, end2, cell2) {
        URL = "v1/processperfswat/" + dataHost + "/?start1=" + start1 + "&end1=" + end1 + "&cell1=" + cell1 + "&start2=" + start2 + "&end2=" + end2 + "&cell2=" + cell2;
        showSpinner("spinnerswat");
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner("spinnerswat");
                toastMessage(toastType.INFO, "Processing Done");
                $("#perfswat-input-info").toggle("slide");
                // Re-enable button and validate form state
                validatePerfSwatForm();
                if (result[0] != undefined && result[0].length > 0) {
                    if(canaryContextArray == undefined){
                        canaryContextArray = [];
                    }
                    canaryContextArray.push({"record": result[0]});
                    updateCanaryView($("#canary-tabs .modern-tabs-nav-button.active").attr("data-tab-target"));
                }
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                $("#perfswat-input-info").toggle("slide");
                // Re-enable button and validate form state
                validatePerfSwatForm();
                hideSpinner("spinnerswat");
            }
        });
    }

</script>