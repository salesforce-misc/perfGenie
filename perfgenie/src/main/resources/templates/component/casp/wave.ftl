<#include "wave-js.ftl">
<script>
    $(document).ready(() => {
        // Initialize GenieAnalytics component only if not already initialized
        if (!window.genieAnalytics) {
            window.genieAnalytics = new GenieAnalytics('dataviewcontent');
            // Initialize collapse functionality for categories panel
            window.genieAnalytics.initializeCollapsePanel();
        }
        getCanaryLenses();
    });
</script>

