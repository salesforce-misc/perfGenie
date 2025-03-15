<div id="canaryview"><div id="spinner" class="spinner"> </div></div>
<script type="text/javascript" class="init">
    function processCanaryData() {
        URL = "v1/canary?start=1&end=1";
        showSpinner();
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner();
                toastMessage(toastType.INFO,"Done");
            },
            error: function(xhr, status, error) {
                toastMessage(toastType.ERROR,"Failed to process canary data");
                hideSpinner();
            }
        });
    }


    function viewCanaryData() {
        URL = "v1/canaryview?start=1&end=1";
        showSpinner();
        $.ajax({
            url: URL, success: function (result) {
                if(result != undefined && result.records != undefined && result.records.canary != undefined && result.records.canary[1] != undefined) {
                    canaryContextArray = result.records.canary[1];
                    showCanaryTable(canaryContextArray);
                }
                hideSpinner();
            },
            error: function(xhr, status, error) {
                toastMessage(toastType.ERROR,"Failed to process canary data");
                hideSpinner();
            }
        });
    }

$(document).ready(function () {
    viewCanaryData();
});

    const canaryviewtable = new SFDataTable("canaryviewtable");
    canaryviewtable.SFDataTableSetPageSize(25);
    Object.freeze(canaryviewtable);
    let canaryContextArray = undefined;
    function showCanaryTable(result){
        let rowIndex = -1;
        tableHeader = [];
        tableRows = [];
        for(let i=0;i<canaryContextArray.length;i++){
            if(canaryContextArray[i].record.length < 10){
                continue;
            }
            console.log(canaryContextArray[i].record[0]);
            rowIndex++;
            tableRows[rowIndex] = [];
            canaryviewtable.addContextTableRow(tableRows[rowIndex], moment.utc(canaryContextArray[i].record[0]).format('YYYY-MM-DD HH:mm:ss'));
            //canaryviewtable.addContextTableRow(tableRows[rowIndex], canaryContextArray[i].record[1]);//tid
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<b>"+canaryContextArray[i].record[2]+"</b>");//cell
            let apt = canaryContextArray[i].record[3];
            try {
                apt = parseFloat(apt.toFixed(3))
            } catch(err) {}
            if(apt > 0){
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:green'>" +apt+"</span>");//apt
            }else {
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:red'>" +apt+"</span>");//apt
            }
            let jcpu = canaryContextArray[i].record[4];
            try {
                jcpu = parseFloat(jcpu.toFixed(3))
            } catch(err) {}
            if(jcpu > 0){
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:green'>" +jcpu+"</span>");//apt
            }else {
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:red'>" +jcpu+"</span>");//apt
            }
            let ccpu = canaryContextArray[i].record[5];
            try {
                ccpu = parseFloat(ccpu.toFixed(3))
            } catch(err) {}
            if(ccpu > 0){
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:green'>" +ccpu+"</span>");//apt
            }else {
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:red'>" +ccpu+"</span>");//apt
            }
            let avgs = canaryContextArray[i].record[10];
            try {
                avgs = parseFloat(avgs.toFixed(3))
            } catch(err) {}

            if(avgs > 0){
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:green'>" +avgs+"</span>");//apt
            }else {
                if(avgs < -1000){
                    avgs = NaN;
                }
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:red'>" +avgs+"</span>");//apt
            }
            // <a href="url">link text</a>
            canaryviewtable.addContextTableRow(tableRows[rowIndex], canaryContextArray[i].record[7]);//zic
            canaryviewtable.addContextTableRow(tableRows[rowIndex], canaryContextArray[i].record[8]);//zuc
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<a href='" + canaryContextArray[i].record[6] + "' target='_blank'> link</a>");//url
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<a href='" + canaryContextArray[i].record[9] + "' target='_blank'> link</a>");

        }
        canaryviewtable.addContextTableHeader(tableHeader,"timestamp",-1, "");
        //canaryviewtable.addContextTableHeader(tableHeader,"tid",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Cell",-1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Avg APT % Change",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Avg JVMCpu/req % Change",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Avg containerCPU/req % Change",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Avg Startup % change",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"zingCount",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"zuluCount",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Dashboard",-1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Metrics",-1, "");


        canaryviewtable.SFDataTable(tableRows, tableHeader, "canaryview");
    }
</script>