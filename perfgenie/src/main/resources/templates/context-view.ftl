<link rel="stylesheet" href="/css/modern-accordion.css">
<script src="/js/modern-accordion.js"></script>
<script type="text/javascript" class="init">
    /**
     * Initialize context data view accordion - uses shared modern accordion component
     */
    function initContextDataViewAccordion() {
        // Use shared accordion component, start collapsed (false)
        initModernAccordion('contextdataview-header', 'contextdataview-content', false);
    }
    
    $(function () {
        // Initialize accordion - script is loaded via script tag
        // Small delay to ensure DOM is fully ready
        setTimeout(function() {
            initContextDataViewAccordion();
        }, 50);
    });
</script>
<div id="contextdataview" class="modern-accordion">
    <div class="modern-accordion-header" id="contextdataview-header">
        <i class="fa fa-chevron-down modern-accordion-icon"></i>
        <span>Context / Diagnostics data explorer</span>
    </div>
    <div class="modern-accordion-content" id="contextdataview-content">
        <div style="padding-left: 0px;padding-top: 10px;padding-bottom: 0px;" id="context-view-panel" class="col-lg-12">

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
</div>