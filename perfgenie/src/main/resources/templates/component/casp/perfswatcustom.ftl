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
            <button onclick="processPerfSwat()" id="submit-perfswat-input" style="alignment:center;height:30px"
                    class="ui-button ui-widget ui-corner-all">Process
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
    <span id="perfswat-input-info-text"></span>
</div>

<div id="spinnerswatcustom" class="spinner"></div>
<div style="padding:0px !important; overflow: scroll;font-size: 95%" class="col-lg-12">
    <div id="canaryperfswatcustomview"></div>
</div>

<script type="text/javascript" class="init">

    function processPerfSwat() {
        let info = " start: " + moment.utc($("#startpicker4").val()).format('ddd, MMM D YYYY HH:mm:ss [UTC]') + " end: " + moment.utc($("#endpicker4").val()).format('ddd, MMM D YYYY HH:mm:ss [UTC]') + " cell: '" + $('#swatcell-input1').val() + "'";

        if ($("#startpicker4").val() != "" && $("#endpicker4").val() != "" && $('#swatcell-input1').val() != undefined && $('#swatcell-input1').val() != "" &&  $("#startpicker5").val() != "" && $("#endpicker5").val() != "" && $('#swatcell-input2').val() != "" && $('#swatcell-input2').val() != undefined) {
            let duration = (moment.utc($("#endpicker4").val()).valueOf() - moment.utc($("#startpicker4").val()).valueOf());
            let duration2 = (moment.utc($("#endpicker5").val()).valueOf() - moment.utc($("#startpicker5").val()).valueOf());
            $("#perfswat-input-info").css("display", "block");
            if (duration <= 24 * 60 * 60 * 1000 && duration2 <= 24 * 60 * 60 * 1000) {
                $("#submit-perfswat-input").attr("disabled", true);
                $('#perfswat-input-info-text').html("Processing " + info + " This may take couple of munutes ...");
                processCustomPerfswatData(moment.utc($("#startpicker4").val()).valueOf(), moment.utc($("#endpicker4").val()).valueOf(), $('#swatcell-input1').val(),moment.utc($("#startpicker5").val()).valueOf(), moment.utc($("#endpicker5").val()).valueOf(), $('#swatcell-input2').val());
            } else {
                $('#perfswat-input-info-text').html("Invalid input: time range 1: " + duration / (60 * 1000) + " time range 2: " + duration2 / (60 * 1000) + " min,  one of them is more than 24 hours");
            }
            //process and remove message
        } else {
            $("#perfswat-input-info").css("display", "block");
            $('#perfswat-input-info-text').html("Invalid input " + info);
        }
    }

    function processCustomPerfswatData(start1, end1, cell1, start2, end2, cell2) {
        URL = "v1/processperfswat/" + dataHost + "/?start1=" + start1 + "&end1=" + end1 + "&cell1=" + cell1 + "&start2=" + start2 + "&end2=" + end2 + "&cell2=" + cell2;
        showSpinner("spinnerswat");
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner("spinnerswat");
                toastMessage(toastType.INFO, "Processing Done");
                $("#perfswat-input-info").css("display", "none");
                $("#submit-perfswat-input").attr("disabled", false);
                if (result[0] != undefined && result[0].length > 0) {
                    canaryContextArray.push({"record": result[0]});
                    updateCanaryView($(".modern-tabs-nav-button.active").attr("data-tab-target"));
                }
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                $("#perfswat-input-info").css("display", "none");
                $("#submit-perfswat-input").attr("disabled", false);
                hideSpinner("spinnerswat");
            }
        });
    }

</script>