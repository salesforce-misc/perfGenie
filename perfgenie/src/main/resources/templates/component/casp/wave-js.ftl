<!-- Ensure C3.js and D3.js are available (D3 must be loaded before C3) -->
<script type="text/javascript" src="/plugins/d3/d3-4.10.0.min.js"></script>
<script type="text/javascript" src="/plugins/c3/c3-0.7.14.min.js"></script>
<link rel="stylesheet" href="/plugins/c3/c3.min.css">

<!-- GenieAnalytics Component JavaScript -->
<script src="/js/genieAnalytics-component.js?v=20250106"></script>

<style>
/* C3.js styling - zero line and grid lines */

/* Style width multiplier select */
.width-multiplier-container {
    display: inline-block;
    margin: 0 5px;
}

.width-multiplier-select {
    width: 50px;
    height: 28px;
    padding: 2px 4px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 11px;
    text-align: center;
    background: #fff;
    color: #333;
    cursor: pointer;
}

.width-multiplier-select:focus {
    outline: none;
    border-color: #0070d2;
    box-shadow: 0 0 3px rgba(0, 112, 210, 0.3);
}
</style>


<!-- JavaScript functions are now in genieAnalytics-component.js -->

