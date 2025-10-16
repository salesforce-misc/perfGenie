<!-- Ensure C3.js and D3.js are available -->
<link rel="stylesheet" href="/plugins/c3/c3.min.css">
<script src="/plugins/d3/d3-4.10.0.min.js"></script>
<script src="/plugins/c3/c3-0.7.14.min.js"></script>

<!-- Wave Analytics Component JavaScript -->
<script src="/js/wave-component.js?v=20250106"></script>

<style>
/* Style the zero line as dashed with dull color */
.c3-line-zero-line,
.c3-grid-lines .c3-ygrid-line,
.c3-grid-lines .c3-ygrid-line[data-value="0"],
.c3-grid-lines .c3-ygrid-line[data-value="0"] line {
    stroke: #999 !important;
    stroke-width: 1px !important;
    stroke-dasharray: 8,4 !important;
}

/* Style x-axis labels */
.c3-axis-x .tick text {
    font-size: 12px !important;
    fill: #333 !important;
    white-space: pre-line !important;
}

/* Ensure x-axis labels are visible */
.c3-axis-x {
    display: block !important;
}

/* Style x-axis label (the main label) */
.c3-axis-x-label {
    white-space: pre-line !important;
    text-anchor: middle !important;
}

/* Style custom stacked labels */
.custom-stacked-label {
    text-anchor: middle !important;
    dominant-baseline: hanging !important;
}

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


<!-- JavaScript functions are now in wave-component.js -->

