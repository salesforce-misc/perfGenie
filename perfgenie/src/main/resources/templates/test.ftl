<div id="modals-guid" class="col-lg-12">
    <div class="modal inmodal fade show" data-backdrop="static" id="timelinepopup" tabindex="-1" role="dialog"
         aria-modal="true" style="display: block;">
        <div style="max-width: 90%;" class="modal-dialog" role="document">
            <div class="modal-content">
                <div id="data-modal-body" class="modal-body" style="overflow: auto">
                    <div id="popupstackncontextview"
                         style="padding-top: 5px; padding-left: 0px;padding-right: 0px;"
                         class="popupstackncontextview col-lg-12">
                        <span id="timelinepopuptitle" style="color: #686A6C;font-family: 'Arial', serif;"></span>
                        <div style="padding-top:0px; padding-left: 0px;padding-right: 0px;" class="row col-lg-12">
                            <div style="padding-top: 0px; padding-left: 0px;padding-right: 5px;padding-bottom: 5px;"
                                 class="popupfilterpanel col-lg-9">
                                <div style="border-color: #e5e6e7;  border-width: 1px; border-style: solid;padding-top: 3px; padding-left: 5px;padding-right: 5px;"
                                     class="popupstackpanel">
                                    <div style="overflow: auto;"
                                         class="cct-customized-scrollbar popupthreadstate"
                                         id="popupthreadstate">
                                        <table>
                                            <tbody></tbody>
                                        </table>
                                    </div>
                                    <div class="popuphackstak" id="popupstack">
                                        <table style="border: 0px;">
                                            <tbody></tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div class="nopadding col-lg-3">
                                <div style="border-color: #e5e6e7;  border-width: 1px; border-style: solid; padding: 5px;"
                                     class="popupstackcontext" id="popupstackcontext">TODO:getContextView
                                    <table style="width:100%; padding: 0px;" class=" table-striped">
                                        <tbody>
                                        <tr>
                                            <td style="white-space: nowrap;"
                                                title="total samples collected in this request">samples
                                            </td>
                                            <td style="white-space: nowrap;padding-left: 5px;">17</td>
                                        </tr>
                                        <tr>
                                            <td style="white-space: nowrap;"
                                                title="socket R/W count (tracing threshold 200ms)">socket R/W
                                                count
                                            </td>
                                            <td style="white-space: nowrap;padding-left: 5px;">0 (tracing
                                                threshold 200ms)
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
    loadModal("timelinepopup");
</script>