<#include "wave-js.ftl">
<script>
    $(document).ready(() => {
        // Initialize Wave Analytics component only if not already initialized
        if (!window.waveAnalytics) {
            window.waveAnalytics = new WaveAnalytics('dataviewcontent');
            // Initialize collapse functionality for categories panel
            window.waveAnalytics.initializeCollapsePanel();
        }
        getCanaryLenses();
    });
</script>

