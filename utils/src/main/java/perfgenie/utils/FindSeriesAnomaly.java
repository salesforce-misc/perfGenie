package perfgenie.utils;

import java.util.*;

/**
 * Java class for detecting anomalies in time series data by comparing baseline and canary arrays
 * Provides multiple anomaly detection algorithms and returns anomaly scores with indices
 */
public class FindSeriesAnomaly {
    
    /**
     * Result class to hold anomaly detection results
     */
    public static class AnomalyResult {
        private final double anomalyScore;
        private final List<Integer> anomalyIndices;
        private final String detectionMethod;
        
        public AnomalyResult(double anomalyScore, List<Integer> anomalyIndices, String detectionMethod) {
            this.anomalyScore = anomalyScore;
            this.anomalyIndices = new ArrayList<>(anomalyIndices);
            this.detectionMethod = detectionMethod;
        }
        
        public double getAnomalyScore() {
            return anomalyScore;
        }
        
        public List<Integer> getAnomalyIndices() {
            return new ArrayList<>(anomalyIndices);
        }
        
        public String getDetectionMethod() {
            return detectionMethod;
        }
        
        @Override
        public String toString() {
            return String.format("AnomalyResult{score=%.4f, indices=%s, method='%s'}", 
                               anomalyScore, anomalyIndices, detectionMethod);
        }
    }
    
    /**
     * Enum for anomaly direction preference
     */
    public enum AnomalyDirection {
        BOTH,           // Detect both increases and decreases as anomalies
        INCREASE_ONLY,  // Only detect increases as anomalies (for performance regression)
        DECREASE_ONLY   // Only detect decreases as anomalies (for performance improvement)
    }
    
    /**
     * Enum for predefined sensitivity levels
     */
    public enum SensitivityLevel {
        VERY_SENSITIVE,     // Catches even minor regressions (high false positive rate)
        SENSITIVE,          // More sensitive than default
        NORMAL,             // Default sensitivity
        CONSERVATIVE,       // Less sensitive than default
        VERY_CONSERVATIVE   // Only catches major regressions (low false positive rate)
    }
    
    /**
     * Configuration class for interval-based parameter overrides
     */
    public static class IntervalParameterOverrides {
        private final java.util.Map<String, TimeRangeParameters> overrides;
        
        public IntervalParameterOverrides() {
            this.overrides = new java.util.HashMap<>();
        }
        
        public void addOverride(String timeRangeCategory, TimeRangeParameters parameters) {
            overrides.put(timeRangeCategory, parameters);
        }
        
        public TimeRangeParameters getOverride(String timeRangeCategory) {
            return overrides.get(timeRangeCategory);
        }
        
        public boolean hasOverride(String timeRangeCategory) {
            return overrides.containsKey(timeRangeCategory);
        }
    }
    
    /**
     * Parameters for a specific time range
     */
    public static class TimeRangeParameters {
        private double thresholdMultiplier;
        private double minRegressionScore;
        private int windowSize;
        private double percentageThreshold;
        
        public TimeRangeParameters(double thresholdMultiplier, double minRegressionScore, 
                                 int windowSize, double percentageThreshold) {
            this.thresholdMultiplier = thresholdMultiplier;
            this.minRegressionScore = minRegressionScore;
            this.windowSize = windowSize;
            this.percentageThreshold = percentageThreshold;
        }
        
        // Getters
        public double getThresholdMultiplier() { return thresholdMultiplier; }
        public double getMinRegressionScore() { return minRegressionScore; }
        public int getWindowSize() { return windowSize; }
        public double getPercentageThreshold() { return percentageThreshold; }
        
        @Override
        public String toString() {
            return String.format("TimeRangeParameters{threshold=%.2f, minScore=%.3f, window=%d, pctThreshold=%.1f%%}", 
                               thresholdMultiplier, minRegressionScore, windowSize, percentageThreshold);
        }
    }
    
    /**
     * Configuration class for week-over-week regression detection
     */
    public static class WeekOverWeekConfig {
        private double thresholdMultiplier;
        private double minRegressionScore;
        private int windowSize;
        private int seriesIntervalSeconds;
        private double percentageThreshold;
        private String timeRangeCategory;
        
        public WeekOverWeekConfig(double thresholdMultiplier, double minRegressionScore, int windowSize, 
                                 int seriesIntervalSeconds, double percentageThreshold, String timeRangeCategory) {
            this.thresholdMultiplier = thresholdMultiplier;
            this.minRegressionScore = minRegressionScore;
            this.windowSize = windowSize;
            this.seriesIntervalSeconds = seriesIntervalSeconds;
            this.percentageThreshold = percentageThreshold;
            this.timeRangeCategory = timeRangeCategory;
        }
        
        // Getters
        public double getThresholdMultiplier() { return thresholdMultiplier; }
        public double getMinRegressionScore() { return minRegressionScore; }
        public int getWindowSize() { return windowSize; }
        public int getSeriesIntervalSeconds() { return seriesIntervalSeconds; }
        public double getPercentageThreshold() { return percentageThreshold; }
        public String getTimeRangeCategory() { return timeRangeCategory; }
        
        @Override
        public String toString() {
            return String.format("WeekOverWeekConfig{threshold=%.2f, minScore=%.3f, window=%d, interval=%ds, pctThreshold=%.1f%%, category='%s'}", 
                               thresholdMultiplier, minRegressionScore, windowSize, seriesIntervalSeconds, percentageThreshold, timeRangeCategory);
        }
    }
    
    /**
     * Configuration class for anomaly detection parameters
     */
    public static class AnomalyConfig {
        private double thresholdMultiplier = 2.0;  // Standard deviations for threshold
        private double minAnomalyScore = 0.1;      // Minimum score to consider as anomaly
        private int windowSize = 10;               // Window size for moving average
        private boolean useZScore = true;          // Use Z-score normalization
        private boolean usePercentile = true;      // Use percentile-based detection
        private AnomalyDirection anomalyDirection = AnomalyDirection.BOTH; // Direction preference
        
        public AnomalyConfig() {}
        
        public AnomalyConfig(double thresholdMultiplier, double minAnomalyScore, int windowSize) {
            this.thresholdMultiplier = thresholdMultiplier;
            this.minAnomalyScore = minAnomalyScore;
            this.windowSize = windowSize;
        }
        
        public AnomalyConfig(double thresholdMultiplier, double minAnomalyScore, int windowSize, AnomalyDirection anomalyDirection) {
            this.thresholdMultiplier = thresholdMultiplier;
            this.minAnomalyScore = minAnomalyScore;
            this.windowSize = windowSize;
            this.anomalyDirection = anomalyDirection;
        }
        
        // Getters and setters
        public double getThresholdMultiplier() { return thresholdMultiplier; }
        public void setThresholdMultiplier(double thresholdMultiplier) { this.thresholdMultiplier = thresholdMultiplier; }
        
        public double getMinAnomalyScore() { return minAnomalyScore; }
        public void setMinAnomalyScore(double minAnomalyScore) { this.minAnomalyScore = minAnomalyScore; }
        
        public int getWindowSize() { return windowSize; }
        public void setWindowSize(int windowSize) { this.windowSize = windowSize; }
        
        public boolean isUseZScore() { return useZScore; }
        public void setUseZScore(boolean useZScore) { this.useZScore = useZScore; }
        
        public boolean isUsePercentile() { return usePercentile; }
        public void setUsePercentile(boolean usePercentile) { this.usePercentile = usePercentile; }
        
        public AnomalyDirection getAnomalyDirection() { return anomalyDirection; }
        public void setAnomalyDirection(AnomalyDirection anomalyDirection) { this.anomalyDirection = anomalyDirection; }
    }
    
    /**
     * Main method to detect anomalies in canary data compared to baseline
     * 
     * @param baseline Array of baseline values
     * @param canary Array of canary values to test for anomalies
     * @return AnomalyResult containing anomaly score and indices
     */
    public static AnomalyResult findAnomalies(Double[] baseline, Double[] canary) {
        return findAnomalies(baseline, canary, new AnomalyConfig());
    }
    
    /**
     * Convenience method for regression testing - only detects performance regressions (increases)
     * 
     * @param baseline Array of baseline values
     * @param canary Array of canary values to test for regressions
     * @return AnomalyResult containing anomaly score and indices for regressions only
     */
    public static AnomalyResult findRegressions(Double[] baseline, Double[] canary) {
        AnomalyConfig config = new AnomalyConfig();
        config.setAnomalyDirection(AnomalyDirection.INCREASE_ONLY);
        return findAnomalies(baseline, canary, config);
    }
    
    /**
     * Convenience method for improvement testing - only detects performance improvements (decreases)
     * 
     * @param baseline Array of baseline values
     * @param canary Array of canary values to test for improvements
     * @return AnomalyResult containing anomaly score and indices for improvements only
     */
    public static AnomalyResult findImprovements(Double[] baseline, Double[] canary) {
        AnomalyConfig config = new AnomalyConfig();
        config.setAnomalyDirection(AnomalyDirection.DECREASE_ONLY);
        return findAnomalies(baseline, canary, config);
    }
    
    /**
     * Specialized method for week-over-week regression detection
     * Optimized for comparing same-length time series data (e.g., this week vs last week)
     * 
     * @param lastWeekData Array of last week's values (baseline)
     * @param thisWeekData Array of this week's values (canary)
     * @return AnomalyResult containing regression periods and severity
     */
    public static AnomalyResult findWeekOverWeekRegressions(Double[] lastWeekData, Double[] thisWeekData) {
        return findWeekOverWeekRegressions(lastWeekData, thisWeekData, 2.0, 0.05, 5, 60);
    }
    
    /**
     * Specialized method for week-over-week regression detection with series interval
     * Automatically adapts parameters based on data time range
     * 
     * @param lastWeekData Array of last week's values (baseline)
     * @param thisWeekData Array of this week's values (canary)
     * @param seriesIntervalSeconds Interval between data points in seconds
     * @return AnomalyResult containing regression periods and severity
     */
    public static AnomalyResult findWeekOverWeekRegressions(Double[] lastWeekData, Double[] thisWeekData, 
                                                           int seriesIntervalSeconds) {
        return findWeekOverWeekRegressions(lastWeekData, thisWeekData, seriesIntervalSeconds, null);
    }
    
    /**
     * Specialized method for week-over-week regression detection with custom parameters and interval
     * 
     * @param lastWeekData Array of last week's values (baseline)
     * @param thisWeekData Array of this week's values (canary)
     * @param seriesIntervalSeconds Interval between data points in seconds
     * @param customConfig Custom configuration (null for auto-detection)
     * @return AnomalyResult containing regression periods and severity
     */
    public static AnomalyResult findWeekOverWeekRegressions(Double[] lastWeekData, Double[] thisWeekData, 
                                                           int seriesIntervalSeconds, AnomalyConfig customConfig) {
        if (lastWeekData == null || thisWeekData == null || 
            lastWeekData.length == 0 || thisWeekData.length == 0) {
            return new AnomalyResult(0.0, new ArrayList<>(), "INVALID_INPUT");
        }
        
        if (lastWeekData.length != thisWeekData.length) {
            return new AnomalyResult(0.0, new ArrayList<>(), "LENGTH_MISMATCH");
        }
        
        // Quick check: if arrays are identical, no regressions
        if (Arrays.equals(lastWeekData, thisWeekData)) {
            return new AnomalyResult(0.0, new ArrayList<>(), "IDENTICAL_WEEK_OVER_WEEK");
        }
        
        // Auto-detect optimal parameters based on data characteristics
        WeekOverWeekConfig config = detectOptimalParameters(lastWeekData, thisWeekData, seriesIntervalSeconds, customConfig);
        
        // Use specialized week-over-week analysis with optimized parameters
        return analyzeWeekOverWeekRegressions(lastWeekData, thisWeekData, config);
    }
    
    /**
     * Specialized method for week-over-week regression detection with custom parameters
     * 
     * @param lastWeekData Array of last week's values (baseline)
     * @param thisWeekData Array of this week's values (canary)
     * @param thresholdMultiplier Standard deviation multiplier for threshold
     * @param minRegressionScore Minimum score to consider as regression
     * @param windowSize Window size for moving average analysis
     * @return AnomalyResult containing regression periods and severity
     */
    public static AnomalyResult findWeekOverWeekRegressions(Double[] lastWeekData, Double[] thisWeekData, 
                                                           double thresholdMultiplier, double minRegressionScore, 
                                                           int windowSize) {
        return findWeekOverWeekRegressions(lastWeekData, thisWeekData, thresholdMultiplier, minRegressionScore, windowSize, 60);
    }
    
    /**
     * Specialized method for week-over-week regression detection with custom parameters and interval
     * 
     * @param lastWeekData Array of last week's values (baseline)
     * @param thisWeekData Array of this week's values (canary)
     * @param thresholdMultiplier Standard deviation multiplier for threshold
     * @param minRegressionScore Minimum score to consider as regression
     * @param windowSize Window size for moving average analysis
     * @param seriesIntervalSeconds Interval between data points in seconds
     * @return AnomalyResult containing regression periods and severity
     */
    public static AnomalyResult findWeekOverWeekRegressions(Double[] lastWeekData, Double[] thisWeekData, 
                                                           double thresholdMultiplier, double minRegressionScore, 
                                                           int windowSize, int seriesIntervalSeconds) {
        if (lastWeekData == null || thisWeekData == null || 
            lastWeekData.length == 0 || thisWeekData.length == 0) {
            return new AnomalyResult(0.0, new ArrayList<>(), "INVALID_INPUT");
        }
        
        if (lastWeekData.length != thisWeekData.length) {
            return new AnomalyResult(0.0, new ArrayList<>(), "LENGTH_MISMATCH");
        }
        
        // Quick check: if arrays are identical, no regressions
        if (Arrays.equals(lastWeekData, thisWeekData)) {
            return new AnomalyResult(0.0, new ArrayList<>(), "IDENTICAL_WEEK_OVER_WEEK");
        }
        
        // Create config with provided parameters
        WeekOverWeekConfig config = new WeekOverWeekConfig(thresholdMultiplier, minRegressionScore, windowSize, 
                                                          seriesIntervalSeconds, 5.0, "CUSTOM");
        
        // Use specialized week-over-week analysis
        return analyzeWeekOverWeekRegressions(lastWeekData, thisWeekData, config);
    }
    
    /**
     * Override interval-based best practices with custom parameter mapping
     * 
     * @param lastWeekData Array of last week's values (baseline)
     * @param thisWeekData Array of this week's values (canary)
     * @param seriesIntervalSeconds Interval between data points in seconds
     * @param parameterOverrides Custom parameter overrides for different time ranges
     * @return AnomalyResult containing regression periods and severity
     */
    public static AnomalyResult findWeekOverWeekRegressionsWithOverrides(Double[] lastWeekData, Double[] thisWeekData, 
                                                                        int seriesIntervalSeconds, 
                                                                        IntervalParameterOverrides parameterOverrides) {
        if (lastWeekData == null || thisWeekData == null || 
            lastWeekData.length == 0 || thisWeekData.length == 0) {
            return new AnomalyResult(0.0, new ArrayList<>(), "INVALID_INPUT");
        }
        
        if (lastWeekData.length != thisWeekData.length) {
            return new AnomalyResult(0.0, new ArrayList<>(), "LENGTH_MISMATCH");
        }
        
        // Quick check: if arrays are identical, no regressions
        if (Arrays.equals(lastWeekData, thisWeekData)) {
            return new AnomalyResult(0.0, new ArrayList<>(), "IDENTICAL_WEEK_OVER_WEEK");
        }
        
        // Use custom parameter detection with overrides
        WeekOverWeekConfig config = detectOptimalParametersWithOverrides(lastWeekData, thisWeekData, 
                                                                        seriesIntervalSeconds, parameterOverrides);
        
        // Use specialized week-over-week analysis
        return analyzeWeekOverWeekRegressions(lastWeekData, thisWeekData, config);
    }
    
    /**
     * Override interval-based best practices with predefined sensitivity levels
     * 
     * @param lastWeekData Array of last week's values (baseline)
     * @param thisWeekData Array of this week's values (canary)
     * @param seriesIntervalSeconds Interval between data points in seconds
     * @param sensitivityLevel Predefined sensitivity level (VERY_SENSITIVE, SENSITIVE, NORMAL, CONSERVATIVE, VERY_CONSERVATIVE)
     * @return AnomalyResult containing regression periods and severity
     */
    public static AnomalyResult findWeekOverWeekRegressionsWithSensitivity(Double[] lastWeekData, Double[] thisWeekData, 
                                                                          int seriesIntervalSeconds, 
                                                                          SensitivityLevel sensitivityLevel) {
        if (lastWeekData == null || thisWeekData == null || 
            lastWeekData.length == 0 || thisWeekData.length == 0) {
            return new AnomalyResult(0.0, new ArrayList<>(), "INVALID_INPUT");
        }
        
        if (lastWeekData.length != thisWeekData.length) {
            return new AnomalyResult(0.0, new ArrayList<>(), "LENGTH_MISMATCH");
        }
        
        // Quick check: if arrays are identical, no regressions
        if (Arrays.equals(lastWeekData, thisWeekData)) {
            return new AnomalyResult(0.0, new ArrayList<>(), "IDENTICAL_WEEK_OVER_WEEK");
        }
        
        // Create parameter overrides based on sensitivity level
        IntervalParameterOverrides overrides = createSensitivityOverrides(sensitivityLevel);
        
        // Use custom parameter detection with overrides
        WeekOverWeekConfig config = detectOptimalParametersWithOverrides(lastWeekData, thisWeekData, 
                                                                        seriesIntervalSeconds, overrides);
        
        // Use specialized week-over-week analysis
        return analyzeWeekOverWeekRegressions(lastWeekData, thisWeekData, config);
    }
    
    /**
     * Auto-detects optimal parameters based on data characteristics and time range
     */
    private static WeekOverWeekConfig detectOptimalParameters(Double[] lastWeek, Double[] thisWeek, 
                                                             int seriesIntervalSeconds, AnomalyConfig customConfig) {
        if (customConfig != null) {
            // Use custom config if provided
            return new WeekOverWeekConfig(
                customConfig.getThresholdMultiplier(),
                customConfig.getMinAnomalyScore(),
                customConfig.getWindowSize(),
                seriesIntervalSeconds,
                5.0,
                "CUSTOM"
            );
        }
        
        // Calculate total time range
        int totalDataPoints = lastWeek.length;
        int totalTimeRangeSeconds = totalDataPoints * seriesIntervalSeconds;
        
        // Determine time range category and optimal parameters
        String timeRangeCategory;
        double thresholdMultiplier;
        double minRegressionScore;
        int windowSize;
        double percentageThreshold;
        
        if (totalTimeRangeSeconds <= 300) { // <= 5 minutes
            timeRangeCategory = "VERY_SHORT_TERM";
            thresholdMultiplier = 1.5;  // More sensitive for short-term data
            minRegressionScore = 0.02;
            windowSize = Math.max(2, totalDataPoints / 10); // 10% of data points
            percentageThreshold = 3.0; // Lower threshold for short-term
        } else if (totalTimeRangeSeconds <= 3600) { // <= 1 hour
            timeRangeCategory = "SHORT_TERM";
            thresholdMultiplier = 1.8;
            minRegressionScore = 0.03;
            windowSize = Math.max(3, totalDataPoints / 8); // 12.5% of data points
            percentageThreshold = 4.0;
        } else if (totalTimeRangeSeconds <= 86400) { // <= 1 day
            timeRangeCategory = "MEDIUM_TERM";
            thresholdMultiplier = 2.0;
            minRegressionScore = 0.05;
            windowSize = Math.max(5, totalDataPoints / 6); // ~17% of data points
            percentageThreshold = 5.0;
        } else if (totalTimeRangeSeconds <= 604800) { // <= 1 week
            timeRangeCategory = "LONG_TERM";
            thresholdMultiplier = 2.2;
            minRegressionScore = 0.08;
            windowSize = Math.max(7, totalDataPoints / 4); // 25% of data points
            percentageThreshold = 6.0;
        } else { // > 1 week
            timeRangeCategory = "VERY_LONG_TERM";
            thresholdMultiplier = 2.5;
            minRegressionScore = 0.1;
            windowSize = Math.max(10, totalDataPoints / 3); // ~33% of data points
            percentageThreshold = 8.0;
        }
        
        // Adjust window size based on interval
        if (seriesIntervalSeconds <= 10) { // High frequency data (<= 10s intervals)
            windowSize = Math.max(windowSize, 5); // Ensure minimum window for high-frequency data
        } else if (seriesIntervalSeconds >= 3600) { // Low frequency data (>= 1h intervals)
            windowSize = Math.min(windowSize, 3); // Smaller windows for low-frequency data
        }
        
        // Ensure window size is within reasonable bounds
        windowSize = Math.max(2, Math.min(windowSize, totalDataPoints / 2));
        
        return new WeekOverWeekConfig(thresholdMultiplier, minRegressionScore, windowSize, 
                                    seriesIntervalSeconds, percentageThreshold, timeRangeCategory);
    }
    
    /**
     * Auto-detects optimal parameters with custom overrides for specific time ranges
     */
    private static WeekOverWeekConfig detectOptimalParametersWithOverrides(Double[] lastWeek, Double[] thisWeek, 
                                                                          int seriesIntervalSeconds, 
                                                                          IntervalParameterOverrides overrides) {
        // Calculate total time range
        int totalDataPoints = lastWeek.length;
        int totalTimeRangeSeconds = totalDataPoints * seriesIntervalSeconds;
        
        // Determine time range category
        String timeRangeCategory;
        if (totalTimeRangeSeconds <= 300) {
            timeRangeCategory = "VERY_SHORT_TERM";
        } else if (totalTimeRangeSeconds <= 3600) {
            timeRangeCategory = "SHORT_TERM";
        } else if (totalTimeRangeSeconds <= 86400) {
            timeRangeCategory = "MEDIUM_TERM";
        } else if (totalTimeRangeSeconds <= 604800) {
            timeRangeCategory = "LONG_TERM";
        } else {
            timeRangeCategory = "VERY_LONG_TERM";
        }
        
        // Check if we have custom overrides for this time range
        if (overrides.hasOverride(timeRangeCategory)) {
            TimeRangeParameters customParams = overrides.getOverride(timeRangeCategory);
            
            // Apply custom parameters
            double thresholdMultiplier = customParams.getThresholdMultiplier();
            double minRegressionScore = customParams.getMinRegressionScore();
            int windowSize = customParams.getWindowSize();
            double percentageThreshold = customParams.getPercentageThreshold();
            
            // Adjust window size based on data length if needed
            windowSize = Math.max(2, Math.min(windowSize, totalDataPoints / 2));
            
            return new WeekOverWeekConfig(thresholdMultiplier, minRegressionScore, windowSize, 
                                        seriesIntervalSeconds, percentageThreshold, timeRangeCategory + "_OVERRIDDEN");
        } else {
            // Fall back to default auto-detection
            return detectOptimalParameters(lastWeek, thisWeek, seriesIntervalSeconds, null);
        }
    }
    
    /**
     * Creates parameter overrides based on sensitivity level
     */
    private static IntervalParameterOverrides createSensitivityOverrides(SensitivityLevel sensitivityLevel) {
        IntervalParameterOverrides overrides = new IntervalParameterOverrides();
        
        // Define sensitivity multipliers
        double thresholdMultiplier, minScoreMultiplier, windowSizeMultiplier, percentageMultiplier;
        
        switch (sensitivityLevel) {
            case VERY_SENSITIVE:
                thresholdMultiplier = 0.6;    // Much more sensitive
                minScoreMultiplier = 0.3;     // Lower minimum score
                windowSizeMultiplier = 0.7;   // Smaller windows
                percentageMultiplier = 0.6;   // Lower percentage threshold
                break;
            case SENSITIVE:
                thresholdMultiplier = 0.8;    // More sensitive
                minScoreMultiplier = 0.5;     // Lower minimum score
                windowSizeMultiplier = 0.8;   // Smaller windows
                percentageMultiplier = 0.8;   // Lower percentage threshold
                break;
            case NORMAL:
                thresholdMultiplier = 1.0;    // Default
                minScoreMultiplier = 1.0;     // Default
                windowSizeMultiplier = 1.0;   // Default
                percentageMultiplier = 1.0;   // Default
                break;
            case CONSERVATIVE:
                thresholdMultiplier = 1.3;    // Less sensitive
                minScoreMultiplier = 1.5;     // Higher minimum score
                windowSizeMultiplier = 1.2;   // Larger windows
                percentageMultiplier = 1.3;   // Higher percentage threshold
                break;
            case VERY_CONSERVATIVE:
                thresholdMultiplier = 1.8;    // Much less sensitive
                minScoreMultiplier = 2.0;     // Much higher minimum score
                windowSizeMultiplier = 1.5;   // Much larger windows
                percentageMultiplier = 1.8;   // Much higher percentage threshold
                break;
            default:
                thresholdMultiplier = 1.0;
                minScoreMultiplier = 1.0;
                windowSizeMultiplier = 1.0;
                percentageMultiplier = 1.0;
        }
        
        // Apply sensitivity adjustments to all time ranges
        // VERY_SHORT_TERM (≤ 5 minutes)
        overrides.addOverride("VERY_SHORT_TERM", new TimeRangeParameters(
            1.5 * thresholdMultiplier, 0.02 * minScoreMultiplier, 
            Math.max(2, (int)(2 * windowSizeMultiplier)), 3.0 * percentageMultiplier));
        
        // SHORT_TERM (≤ 1 hour)
        overrides.addOverride("SHORT_TERM", new TimeRangeParameters(
            1.8 * thresholdMultiplier, 0.03 * minScoreMultiplier, 
            Math.max(3, (int)(3 * windowSizeMultiplier)), 4.0 * percentageMultiplier));
        
        // MEDIUM_TERM (≤ 1 day)
        overrides.addOverride("MEDIUM_TERM", new TimeRangeParameters(
            2.0 * thresholdMultiplier, 0.05 * minScoreMultiplier, 
            Math.max(5, (int)(5 * windowSizeMultiplier)), 5.0 * percentageMultiplier));
        
        // LONG_TERM (≤ 1 week)
        overrides.addOverride("LONG_TERM", new TimeRangeParameters(
            2.2 * thresholdMultiplier, 0.08 * minScoreMultiplier, 
            Math.max(7, (int)(7 * windowSizeMultiplier)), 6.0 * percentageMultiplier));
        
        // VERY_LONG_TERM (> 1 week)
        overrides.addOverride("VERY_LONG_TERM", new TimeRangeParameters(
            2.5 * thresholdMultiplier, 0.1 * minScoreMultiplier, 
            Math.max(10, (int)(10 * windowSizeMultiplier)), 8.0 * percentageMultiplier));
        
        return overrides;
    }
    
    /**
     * Analyzes week-over-week data for regression periods using multiple specialized techniques
     */
    private static AnomalyResult analyzeWeekOverWeekRegressions(Double[] lastWeek, Double[] thisWeek, 
                                                               WeekOverWeekConfig config) {
        List<AnomalyResult> results = new ArrayList<>();
        
        // Method 1: Point-by-point comparison with statistical significance
        results.add(detectPointByPointRegressions(lastWeek, thisWeek, config));
        
        // Method 2: Moving window regression detection
        results.add(detectMovingWindowRegressions(lastWeek, thisWeek, config));
        
        // Method 3: Trend-based regression detection
        results.add(detectTrendRegressions(lastWeek, thisWeek, config));
        
        // Method 4: Percentile shift detection
        results.add(detectPercentileShiftRegressions(lastWeek, thisWeek, config));
        
        // Combine results and filter by minimum score
        AnomalyResult combined = combineAnomalyResults(results);
        
        // Filter out results below minimum score
        if (combined.getAnomalyScore() < config.getMinRegressionScore()) {
            return new AnomalyResult(0.0, new ArrayList<>(), "NO_SIGNIFICANT_REGRESSIONS");
        }
        
        return new AnomalyResult(combined.getAnomalyScore(), combined.getAnomalyIndices(), 
                               "WEEK_OVER_WEEK_REGRESSION_" + config.getTimeRangeCategory());
    }
    
    /**
     * Point-by-point regression detection with statistical significance
     */
    private static AnomalyResult detectPointByPointRegressions(Double[] lastWeek, Double[] thisWeek, WeekOverWeekConfig config) {
        double lastWeekMean = calculateMean(lastWeek);
        double lastWeekStdDev = calculateStandardDeviation(lastWeek, lastWeekMean);
        
        if (lastWeekStdDev == 0) {
            return new AnomalyResult(0.0, new ArrayList<>(), "POINT_BY_POINT_ZERO_STDDEV");
        }
        
        List<Integer> regressionIndices = new ArrayList<>();
        double maxRegressionScore = 0.0;
        
        for (int i = 0; i < thisWeek.length; i++) {
            double lastWeekValue = lastWeek[i];
            double thisWeekValue = thisWeek[i];
            
            // Calculate percentage increase
            double percentageIncrease = ((thisWeekValue - lastWeekValue) / lastWeekValue) * 100;
            
            // Calculate Z-score for the increase
            double zScore = (thisWeekValue - lastWeekValue) / lastWeekStdDev;
            
            // Consider it a regression if:
            // 1. There's a significant increase (positive Z-score above threshold)
            // 2. The percentage increase is meaningful (above config threshold)
            if (zScore > config.getThresholdMultiplier() && percentageIncrease > config.getPercentageThreshold()) {
                regressionIndices.add(i);
                maxRegressionScore = Math.max(maxRegressionScore, zScore);
            }
        }
        
        double anomalyScore = maxRegressionScore / config.getThresholdMultiplier();
        return new AnomalyResult(anomalyScore, regressionIndices, "POINT_BY_POINT");
    }
    
    /**
     * Moving window regression detection
     */
    private static AnomalyResult detectMovingWindowRegressions(Double[] lastWeek, Double[] thisWeek, WeekOverWeekConfig config) {
        List<Integer> regressionIndices = new ArrayList<>();
        double maxRegressionScore = 0.0;
        int windowSize = config.getWindowSize();
        double threshold = config.getThresholdMultiplier();
        
        for (int i = 0; i <= thisWeek.length - windowSize; i++) {
            // Extract windows
            Double[] lastWeekWindow = Arrays.copyOfRange(lastWeek, i, i + windowSize);
            Double[] thisWeekWindow = Arrays.copyOfRange(thisWeek, i, i + windowSize);
            
            // Calculate window statistics
            double lastWeekWindowMean = calculateMean(lastWeekWindow);
            double thisWeekWindowMean = calculateMean(thisWeekWindow);
            double lastWeekWindowStdDev = calculateStandardDeviation(lastWeekWindow, lastWeekWindowMean);
            
            if (lastWeekWindowStdDev > 0) {
                // Calculate regression score for this window
                double regressionScore = (thisWeekWindowMean - lastWeekWindowMean) / lastWeekWindowStdDev;
                
                if (regressionScore > threshold) {
                    // Mark all points in this window as regression
                    for (int j = i; j < i + windowSize; j++) {
                        if (!regressionIndices.contains(j)) {
                            regressionIndices.add(j);
                        }
                    }
                    maxRegressionScore = Math.max(maxRegressionScore, regressionScore);
                }
            }
        }
        
        double anomalyScore = maxRegressionScore / threshold;
        return new AnomalyResult(anomalyScore, regressionIndices, "MOVING_WINDOW");
    }
    
    /**
     * Trend-based regression detection
     */
    private static AnomalyResult detectTrendRegressions(Double[] lastWeek, Double[] thisWeek, WeekOverWeekConfig config) {
        // Calculate overall trends
        double lastWeekTrend = calculateTrend(lastWeek);
        double thisWeekTrend = calculateTrend(thisWeek);
        
        List<Integer> regressionIndices = new ArrayList<>();
        double maxRegressionScore = 0.0;
        double threshold = config.getThresholdMultiplier();
        
        // If this week has a significantly steeper upward trend, flag as regression
        if (thisWeekTrend > lastWeekTrend + threshold) {
            // Find points where the trend difference is most pronounced
            for (int i = 0; i < thisWeek.length; i++) {
                double trendDifference = (thisWeek[i] - lastWeek[i]) / Math.max(lastWeek[i], 1.0);
                if (trendDifference > threshold / 2) {
                    regressionIndices.add(i);
                    maxRegressionScore = Math.max(maxRegressionScore, trendDifference);
                }
            }
        }
        
        double anomalyScore = maxRegressionScore / threshold;
        return new AnomalyResult(anomalyScore, regressionIndices, "TREND_BASED");
    }
    
    /**
     * Percentile shift regression detection
     */
    private static AnomalyResult detectPercentileShiftRegressions(Double[] lastWeek, Double[] thisWeek, WeekOverWeekConfig config) {
        // Calculate percentiles for both weeks
        Double[] sortedLastWeek = lastWeek.clone();
        Double[] sortedThisWeek = thisWeek.clone();
        Arrays.sort(sortedLastWeek);
        Arrays.sort(sortedThisWeek);
        
        double lastWeekP50 = calculatePercentile(sortedLastWeek, 50.0);
        double lastWeekP95 = calculatePercentile(sortedLastWeek, 95.0);
        double thisWeekP50 = calculatePercentile(sortedThisWeek, 50.0);
        double thisWeekP95 = calculatePercentile(sortedThisWeek, 95.0);
        
        List<Integer> regressionIndices = new ArrayList<>();
        double maxRegressionScore = 0.0;
        double threshold = config.getThresholdMultiplier();
        
        // Check for significant percentile shifts
        double p50Shift = (thisWeekP50 - lastWeekP50) / lastWeekP50;
        double p95Shift = (thisWeekP95 - lastWeekP95) / lastWeekP95;
        
        if (p50Shift > threshold / 3 || p95Shift > threshold / 2) {
            // Find individual points that contribute to the shift
            for (int i = 0; i < thisWeek.length; i++) {
                double pointShift = (thisWeek[i] - lastWeek[i]) / Math.max(lastWeek[i], 1.0);
                if (pointShift > threshold / 4) {
                    regressionIndices.add(i);
                    maxRegressionScore = Math.max(maxRegressionScore, pointShift);
                }
            }
        }
        
        double anomalyScore = maxRegressionScore / threshold;
        return new AnomalyResult(anomalyScore, regressionIndices, "PERCENTILE_SHIFT");
    }
    
    /**
     * Calculate trend (slope) of a time series using linear regression
     */
    private static double calculateTrend(Double[] values) {
        if (values.length < 2) return 0.0;
        
        int n = values.length;
        double sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        
        for (int i = 0; i < n; i++) {
            double x = i;
            double y = values[i];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumXX += x * x;
        }
        
        // Calculate slope using least squares
        double slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope;
    }
    
    /**
     * Main method to detect anomalies with custom configuration
     * 
     * @param baseline Array of baseline values
     * @param canary Array of canary values to test for anomalies
     * @param config Configuration for anomaly detection
     * @return AnomalyResult containing anomaly score and indices
     */
    public static AnomalyResult findAnomalies(Double[] baseline, Double[] canary, AnomalyConfig config) {
        if (baseline == null || canary == null || baseline.length == 0 || canary.length == 0) {
            return new AnomalyResult(0.0, new ArrayList<>(), "INVALID_INPUT");
        }
        
        // Quick check: if arrays are identical, no anomalies
        if (Arrays.equals(baseline, canary)) {
            return new AnomalyResult(0.0, new ArrayList<>(), "IDENTICAL_ARRAYS");
        }
        
        // Check if canary is a subset of baseline (first N elements are identical)
        boolean isSubset = true;
        int minLength = Math.min(baseline.length, canary.length);
        for (int i = 0; i < minLength; i++) {
            if (!baseline[i].equals(canary[i])) {
                isSubset = false;
                break;
            }
        }
        
        // If canary is identical to the first part of baseline, no anomalies
        if (isSubset && canary.length <= baseline.length) {
            return new AnomalyResult(0.0, new ArrayList<>(), "CANARY_SUBSET_OF_BASELINE");
        }
        
        // Detect anomalies using multiple methods
        List<AnomalyResult> results = new ArrayList<>();
        
        // Method 1: Z-Score based detection
        if (config.isUseZScore()) {
            results.add(detectZScoreAnomalies(baseline, canary, config));
        }
        
        // Method 2: Percentile based detection
        if (config.isUsePercentile()) {
            results.add(detectPercentileAnomalies(baseline, canary, config));
        }
        
        // Method 3: Moving average deviation
        results.add(detectMovingAverageAnomalies(baseline, canary, config));
        
        // Method 4: Statistical process control
        results.add(detectSPCAnomalies(baseline, canary, config));
        
        // Combine results and return the most significant anomaly
        return combineAnomalyResults(results);
    }
    
    /**
     * Z-Score based anomaly detection
     */
    private static AnomalyResult detectZScoreAnomalies(Double[] baseline, Double[] canary, AnomalyConfig config) {
        double baselineMean = calculateMean(baseline);
        double baselineStdDev = calculateStandardDeviation(baseline, baselineMean);
        
        if (baselineStdDev == 0) {
            return new AnomalyResult(0.0, new ArrayList<>(), "Z_SCORE_ZERO_STDDEV");
        }
        
        List<Integer> anomalyIndices = new ArrayList<>();
        double maxZScore = 0.0;
        
        for (int i = 0; i < canary.length; i++) {
            double rawZScore = (canary[i] - baselineMean) / baselineStdDev;
            double zScore = Math.abs(rawZScore);
            
            // Check direction preference
            boolean isAnomaly = false;
            if (config.getAnomalyDirection() == AnomalyDirection.BOTH) {
                isAnomaly = zScore > config.getThresholdMultiplier();
            } else if (config.getAnomalyDirection() == AnomalyDirection.INCREASE_ONLY) {
                isAnomaly = rawZScore > config.getThresholdMultiplier(); // Only positive deviations
            } else if (config.getAnomalyDirection() == AnomalyDirection.DECREASE_ONLY) {
                isAnomaly = rawZScore < -config.getThresholdMultiplier(); // Only negative deviations
            }
            
            if (isAnomaly) {
                anomalyIndices.add(i);
                maxZScore = Math.max(maxZScore, zScore);
            }
        }
        
        double anomalyScore = maxZScore / config.getThresholdMultiplier();
        return new AnomalyResult(anomalyScore, anomalyIndices, "Z_SCORE");
    }
    
    /**
     * Percentile based anomaly detection
     */
    private static AnomalyResult detectPercentileAnomalies(Double[] baseline, Double[] canary, AnomalyConfig config) {
        // Sort baseline to calculate percentiles
        Double[] sortedBaseline = baseline.clone();
        Arrays.sort(sortedBaseline);
        
        double lowerPercentile = calculatePercentile(sortedBaseline, 5.0);  // 5th percentile
        double upperPercentile = calculatePercentile(sortedBaseline, 95.0); // 95th percentile
        
        // If percentiles are the same (all values identical), no anomalies possible
        if (Math.abs(upperPercentile - lowerPercentile) < 1e-10) {
            return new AnomalyResult(0.0, new ArrayList<>(), "PERCENTILE_IDENTICAL_VALUES");
        }
        
        List<Integer> anomalyIndices = new ArrayList<>();
        double maxDeviation = 0.0;
        
        for (int i = 0; i < canary.length; i++) {
            double value = canary[i];
            double deviation = 0.0;
            boolean isAnomaly = false;
            
            if (value < lowerPercentile) {
                deviation = (lowerPercentile - value) / (upperPercentile - lowerPercentile);
                // Check if we care about decreases (lower values)
                if (config.getAnomalyDirection() == AnomalyDirection.BOTH || 
                    config.getAnomalyDirection() == AnomalyDirection.DECREASE_ONLY) {
                    isAnomaly = true;
                }
            } else if (value > upperPercentile) {
                deviation = (value - upperPercentile) / (upperPercentile - lowerPercentile);
                // Check if we care about increases (higher values)
                if (config.getAnomalyDirection() == AnomalyDirection.BOTH || 
                    config.getAnomalyDirection() == AnomalyDirection.INCREASE_ONLY) {
                    isAnomaly = true;
                }
            }
            
            if (isAnomaly) {
                anomalyIndices.add(i);
                maxDeviation = Math.max(maxDeviation, deviation);
            }
        }
        
        return new AnomalyResult(maxDeviation, anomalyIndices, "PERCENTILE");
    }
    
    /**
     * Moving average deviation based anomaly detection
     */
    private static AnomalyResult detectMovingAverageAnomalies(Double[] baseline, Double[] canary, AnomalyConfig config) {
        int windowSize = Math.min(config.getWindowSize(), baseline.length);
        double baselineMovingAvg = calculateMovingAverage(baseline, windowSize);
        double baselineMovingStdDev = calculateMovingStandardDeviation(baseline, windowSize);
        
        List<Integer> anomalyIndices = new ArrayList<>();
        double maxDeviation = 0.0;
        
        for (int i = 0; i < canary.length; i++) {
            double canaryMovingAvg = calculateMovingAverage(Arrays.copyOfRange(canary, 0, Math.min(i + 1, canary.length)), 
                                                          Math.min(windowSize, i + 1));
            
            if (baselineMovingStdDev > 0) {
                double deviation = Math.abs(canaryMovingAvg - baselineMovingAvg) / baselineMovingStdDev;
                if (deviation > config.getThresholdMultiplier()) {
                    anomalyIndices.add(i);
                    maxDeviation = Math.max(maxDeviation, deviation);
                }
            }
        }
        
        double anomalyScore = maxDeviation / config.getThresholdMultiplier();
        return new AnomalyResult(anomalyScore, anomalyIndices, "MOVING_AVERAGE");
    }
    
    /**
     * Statistical Process Control based anomaly detection
     */
    private static AnomalyResult detectSPCAnomalies(Double[] baseline, Double[] canary, AnomalyConfig config) {
        double baselineMean = calculateMean(baseline);
        double baselineStdDev = calculateStandardDeviation(baseline, baselineMean);
        
        // Control limits (3-sigma)
        double upperControlLimit = baselineMean + (3 * baselineStdDev);
        double lowerControlLimit = baselineMean - (3 * baselineStdDev);
        
        List<Integer> anomalyIndices = new ArrayList<>();
        double maxViolation = 0.0;
        
        for (int i = 0; i < canary.length; i++) {
            double value = canary[i];
            double violation = 0.0;
            boolean isAnomaly = false;
            
            if (value > upperControlLimit) {
                violation = (value - upperControlLimit) / baselineStdDev;
                // Check if we care about increases (upper limit violations)
                if (config.getAnomalyDirection() == AnomalyDirection.BOTH || 
                    config.getAnomalyDirection() == AnomalyDirection.INCREASE_ONLY) {
                    isAnomaly = true;
                }
            } else if (value < lowerControlLimit) {
                violation = (lowerControlLimit - value) / baselineStdDev;
                // Check if we care about decreases (lower limit violations)
                if (config.getAnomalyDirection() == AnomalyDirection.BOTH || 
                    config.getAnomalyDirection() == AnomalyDirection.DECREASE_ONLY) {
                    isAnomaly = true;
                }
            }
            
            if (isAnomaly) {
                anomalyIndices.add(i);
                maxViolation = Math.max(maxViolation, violation);
            }
        }
        
        return new AnomalyResult(maxViolation, anomalyIndices, "SPC");
    }
    
    /**
     * Combine multiple anomaly detection results
     */
    private static AnomalyResult combineAnomalyResults(List<AnomalyResult> results) {
        if (results.isEmpty()) {
            return new AnomalyResult(0.0, new ArrayList<>(), "NO_DETECTION");
        }
        
        // Filter out results with zero or very low anomaly scores
        List<AnomalyResult> significantResults = new ArrayList<>();
        for (AnomalyResult result : results) {
            if (result.getAnomalyScore() > 0.001) { // Only consider results with meaningful scores
                significantResults.add(result);
            }
        }
        
        // If no significant results, return no anomalies
        if (significantResults.isEmpty()) {
            return new AnomalyResult(0.0, new ArrayList<>(), "NO_SIGNIFICANT_ANOMALIES");
        }
        
        // Find the result with the highest anomaly score
        AnomalyResult bestResult = significantResults.get(0);
        for (AnomalyResult result : significantResults) {
            if (result.getAnomalyScore() > bestResult.getAnomalyScore()) {
                bestResult = result;
            }
        }
        
        // Combine all anomaly indices from significant results only
        Set<Integer> allAnomalyIndices = new HashSet<>();
        for (AnomalyResult result : significantResults) {
            allAnomalyIndices.addAll(result.getAnomalyIndices());
        }
        
        List<Integer> combinedIndices = new ArrayList<>(allAnomalyIndices);
        Collections.sort(combinedIndices);
        
        return new AnomalyResult(bestResult.getAnomalyScore(), combinedIndices, "COMBINED");
    }
    
    // Utility methods
    
    private static double calculateMean(Double[] values) {
        double sum = 0.0;
        for (Double value : values) {
            sum += value;
        }
        return sum / values.length;
    }
    
    private static double calculateStandardDeviation(Double[] values, double mean) {
        double sumSquaredDiffs = 0.0;
        for (Double value : values) {
            sumSquaredDiffs += Math.pow(value - mean, 2);
        }
        return Math.sqrt(sumSquaredDiffs / values.length);
    }
    
    private static double calculatePercentile(Double[] sortedValues, double percentile) {
        if (sortedValues.length == 0) return 0.0;
        
        double index = (percentile / 100.0) * (sortedValues.length - 1);
        int lowerIndex = (int) Math.floor(index);
        int upperIndex = (int) Math.ceil(index);
        
        if (lowerIndex == upperIndex) {
            return sortedValues[lowerIndex];
        }
        
        double weight = index - lowerIndex;
        return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
    }
    
    private static double calculateMovingAverage(Double[] values, int windowSize) {
        if (values.length == 0) return 0.0;
        
        int actualWindowSize = Math.min(windowSize, values.length);
        double sum = 0.0;
        for (int i = 0; i < actualWindowSize; i++) {
            sum += values[values.length - 1 - i];
        }
        return sum / actualWindowSize;
    }
    
    private static double calculateMovingStandardDeviation(Double[] values, int windowSize) {
        if (values.length == 0) return 0.0;
        
        int actualWindowSize = Math.min(windowSize, values.length);
        double movingAvg = calculateMovingAverage(values, actualWindowSize);
        
        double sumSquaredDiffs = 0.0;
        for (int i = 0; i < actualWindowSize; i++) {
            double value = values[values.length - 1 - i];
            sumSquaredDiffs += Math.pow(value - movingAvg, 2);
        }
        return Math.sqrt(sumSquaredDiffs / actualWindowSize);
    }
    
    /**
     * Example usage and testing method
     */
    public static void main(String[] args) {
        // Example baseline data (normal performance)
        Double[] baseline = {10.0, 12.0, 11.0, 13.0, 10.5, 12.5, 11.5, 13.5, 10.8, 12.2};
        
        // Test with identical arrays - should show no anomalies
        AnomalyResult identicalResult = findAnomalies(baseline, baseline);
        System.out.println("Identical Arrays Test:");
        System.out.println(identicalResult);
        
        // Example canary data with both increases and decreases
        Double[] canary = {10.0, 12.0, 11.0, 13.0, 10.5, 25.0, 11.5, 13.5, 10.8, 12.2, 30.0, 11.0, 5.0, 8.0};
        
        // Test with default configuration (both directions)
        AnomalyResult result = findAnomalies(baseline, canary);
        System.out.println("\nDefault Configuration (Both Directions):");
        System.out.println(result);
        
        // Test with increase-only configuration (performance regression detection)
        AnomalyConfig increaseOnlyConfig = new AnomalyConfig(1.5, 0.05, 5, AnomalyDirection.INCREASE_ONLY);
        AnomalyResult increaseOnlyResult = findAnomalies(baseline, canary, increaseOnlyConfig);
        System.out.println("\nIncrease Only (Performance Regression):");
        System.out.println(increaseOnlyResult);
        
        // Test with decrease-only configuration (performance improvement detection)
        AnomalyConfig decreaseOnlyConfig = new AnomalyConfig(1.5, 0.05, 5, AnomalyDirection.DECREASE_ONLY);
        AnomalyResult decreaseOnlyResult = findAnomalies(baseline, canary, decreaseOnlyConfig);
        System.out.println("\nDecrease Only (Performance Improvement):");
        System.out.println(decreaseOnlyResult);
        
        // Test with no anomalies (subset of baseline)
        Double[] normalCanary = {10.0, 12.0, 11.0, 13.0, 10.5, 12.5, 11.5, 13.5, 10.8, 12.2};
        AnomalyResult normalResult = findAnomalies(baseline, normalCanary);
        System.out.println("\nNo Anomalies (Subset):");
        System.out.println(normalResult);
        
        // Test with identical values (all same value)
        Double[] identicalValues = {5.0, 5.0, 5.0, 5.0, 5.0};
        AnomalyResult identicalValuesResult = findAnomalies(identicalValues, identicalValues);
        System.out.println("\nIdentical Values Test:");
        System.out.println(identicalValuesResult);
        
        // Test week-over-week regression detection
        System.out.println("\n=== WEEK-OVER-WEEK REGRESSION DETECTION ===");
        
        // Example: Last week's performance data (baseline)
        Double[] lastWeekData = {10.0, 12.0, 11.0, 13.0, 10.5, 12.5, 11.5, 13.5, 10.8, 12.2, 11.0, 12.8, 10.9, 11.7};
        
        // Example: This week's performance data with some regressions
        Double[] thisWeekData = {10.0, 12.0, 11.0, 13.0, 10.5, 15.0, 17.5, 13.5, 10.8, 12.2, 11.0, 12.8, 10.9, 11.7};
        
        // Test with different intervals to show auto-parameter detection
        System.out.println("\n--- 1-minute intervals (14 minutes total) ---");
        AnomalyResult result1min = findWeekOverWeekRegressions(lastWeekData, thisWeekData, 60);
        System.out.println("Result: " + result1min);
        
        System.out.println("\n--- 10-second intervals (2.3 minutes total) ---");
        AnomalyResult result10sec = findWeekOverWeekRegressions(lastWeekData, thisWeekData, 10);
        System.out.println("Result: " + result10sec);
        
        System.out.println("\n--- 1-hour intervals (14 hours total) ---");
        AnomalyResult result1hour = findWeekOverWeekRegressions(lastWeekData, thisWeekData, 3600);
        System.out.println("Result: " + result1hour);
        
        System.out.println("\n--- 1-day intervals (14 days total) ---");
        AnomalyResult result1day = findWeekOverWeekRegressions(lastWeekData, thisWeekData, 86400);
        System.out.println("Result: " + result1day);
        
        // Test with custom parameters
        AnomalyResult customWeekOverWeekResult = findWeekOverWeekRegressions(lastWeekData, thisWeekData, 1.5, 0.1, 3, 60);
        System.out.println("\nCustom Week-over-Week Regression Detection:");
        System.out.println(customWeekOverWeekResult);
        
        // Test with identical week-over-week data
        AnomalyResult identicalWeekResult = findWeekOverWeekRegressions(lastWeekData, lastWeekData, 60);
        System.out.println("\nIdentical Week-over-Week Data:");
        System.out.println(identicalWeekResult);
        
        // Test with sensitivity level overrides
        System.out.println("\n=== SENSITIVITY LEVEL OVERRIDES ===");
        
        System.out.println("\n--- VERY_SENSITIVE (60-second intervals) ---");
        AnomalyResult verySensitiveResult = findWeekOverWeekRegressionsWithSensitivity(
            lastWeekData, thisWeekData, 60, SensitivityLevel.VERY_SENSITIVE);
        System.out.println("Result: " + verySensitiveResult);
        
        System.out.println("\n--- CONSERVATIVE (60-second intervals) ---");
        AnomalyResult conservativeResult = findWeekOverWeekRegressionsWithSensitivity(
            lastWeekData, thisWeekData, 60, SensitivityLevel.CONSERVATIVE);
        System.out.println("Result: " + conservativeResult);
        
        // Test with custom parameter overrides
        System.out.println("\n=== CUSTOM PARAMETER OVERRIDES ===");
        
        IntervalParameterOverrides customOverrides = new IntervalParameterOverrides();
        
        // Override only SHORT_TERM parameters (1-hour data)
        customOverrides.addOverride("SHORT_TERM", new TimeRangeParameters(
            1.2,    // Very sensitive threshold
            0.01,   // Very low minimum score
            2,      // Small window
            2.0     // Low percentage threshold
        ));
        
        System.out.println("\n--- Custom SHORT_TERM Override (3600-second intervals) ---");
        AnomalyResult customOverrideResult = findWeekOverWeekRegressionsWithOverrides(
            lastWeekData, thisWeekData, 3600, customOverrides);
        System.out.println("Result: " + customOverrideResult);
        
        // Test with multiple overrides
        IntervalParameterOverrides multipleOverrides = new IntervalParameterOverrides();
        
        // Override multiple time ranges
        multipleOverrides.addOverride("VERY_SHORT_TERM", new TimeRangeParameters(1.0, 0.01, 1, 1.0));
        multipleOverrides.addOverride("MEDIUM_TERM", new TimeRangeParameters(3.0, 0.2, 10, 10.0));
        
        System.out.println("\n--- Multiple Overrides (VERY_SHORT_TERM + MEDIUM_TERM) ---");
        System.out.println("Testing VERY_SHORT_TERM (10-second intervals):");
        AnomalyResult multiOverride1 = findWeekOverWeekRegressionsWithOverrides(
            lastWeekData, thisWeekData, 10, multipleOverrides);
        System.out.println("Result: " + multiOverride1);
        
        System.out.println("Testing MEDIUM_TERM (86400-second intervals):");
        AnomalyResult multiOverride2 = findWeekOverWeekRegressionsWithOverrides(
            lastWeekData, thisWeekData, 86400, multipleOverrides);
        System.out.println("Result: " + multiOverride2);
    }
}
