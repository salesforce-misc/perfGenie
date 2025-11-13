<script type="text/javascript" class="init">
    $(function () {
        $("#contextdataview").accordion({
            collapsible: true,
            heightStyle: "content"
        });
    });
</script>
<div style="" id="contextdataview">
    <h3 style="width:100%;padding-top: 2px !important;padding-bottom: 2px !important;">Context / Diagnostics data explorer</h3>
    <div style="padding-left: 23px;padding-top: 10px;padding-bottom: 0px;" id="context-view-panel" class="col-lg-12">

        <span id="filter-view-status" style="" class="hide"></span>
        <div id="contextviewpanel" class="hide">

            <div class="row form-group" id="statetablewrapper" class="statetablewrapper col-lg-12">
                <div id="statetabledrp" class="ui-widget statetabledrop col-lg-12">
                </div>
                <div id='timeLineChartNote' class='col-lg-12' style='display: none'></div>
                <div id='timeLineChartError' class='col-lg-12' style='display: none; color: red'></div>
                <div id="statetable" class="ui-widget statetable col-lg-12">
                </div>
            </div>
            <div class="row">
                <div class='popup'><span class='popuptext' id='idPopup'>A Simple Popup!</span></div>
            </div>
            <div id="stackncontextview" style="padding-top: 5px; padding-left: 0px;padding-right: 0px;"
                 class="hide stackncontextview col-lg-12">
                <span id="timelinetitle" style="color: #686A6C;font-family: 'Arial', serif;">Profiling samples collected during request runTime</span>
                <div style="padding-top:0px; padding-left: 0px;padding-right: 0px;" class="col-lg-12">
                    <div style="padding-top: 0px; padding-left: 0px;padding-right: 5px;padding-bottom: 5px;"
                         class="filterpanel col-lg-9">
                        <div style="border-color: #e5e6e7;  border-width: 1px; border-style: solid;padding-top: 3px; padding-left: 5px;padding-right: 5px;"
                             class="stackpanel">
                            <div style="overflow: auto;" class="cct-customized-scrollbar threadstate"
                                 id="threadstate">
                            </div>
                            <div class="hackstak" id="stack">
                            </div>
                        </div>
                    </div>
                    <div class="nopadding col-lg-3">
                        <div style="border-color: #e5e6e7;  border-width: 1px; border-style: solid; padding: 5px;"
                             class="stackcontext" id="stackcontext">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>