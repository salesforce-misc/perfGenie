package perfgenie.utils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public class PeakRange {
    /*public static void main(String[] args) {
        Path path = Path.of("/Users/rpulle/work/casp/findpeak/src/main/resources/requests.json");
        String metric = null;
        Map<Long, Integer> epochTimestampsMap = new HashMap<>();
        try {
            metric = "{\"array\":"+Files.readString(path)+"}";
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    epochTimestampsMap.put(Long.parseLong(k),datapoints.getInt(String.valueOf(k)));
                    //System.out.println( String.valueOf(datapoints.getInt(String.valueOf(k))));
                }
            }
        }catch (Exception e){
            System.out.println(e.getMessage());
        }

        // Example: Pass the 60th percentile
        int percentile = 60;

        // Step 1: Find the largest continuous time range where request rate is above the percentile
        TimeRange largestRange = findLargestContinuousRangeAbovePercentile(epochTimestampsMap, percentile);

        // Step 2: Print the largest time range found in epoch format
        if (largestRange != null) {
            System.out.println("Largest continuous time range with request rates consistently above the " + percentile + "th percentile:");
            System.out.println("Start (Epoch): " + largestRange.start);
            System.out.println("End (Epoch): " + largestRange.end);
        } else {
            System.out.println("No continuous high request rate periods found.");
        }
    }*/

    public static List<TimeRange> findContinuousRangesAbovePercentile(Map<Long, Integer> epochTimestampsMap, int percentile) {
        // Calculate the percentile threshold
        List<Integer> allRequestRates = new ArrayList<>(epochTimestampsMap.values());

        // Sort request rates and calculate the percentile threshold
        Collections.sort(allRequestRates);
        int percentileIndex = (int) Math.ceil(allRequestRates.size() * (percentile / 100.0)) - 1;
        int percentileThreshold = allRequestRates.get(percentileIndex);

        // Print the percentile threshold
        System.out.println(percentile + "th Percentile (high request rate threshold): " + percentileThreshold);

        List<TimeRange> ranges = new ArrayList<>();
        Long start = null;
        Long end = null;

        // Sort the map entries by epoch timestamp (ascending order)
        List<Map.Entry<Long, Integer>> sortedEntries = new ArrayList<>(epochTimestampsMap.entrySet());
        sortedEntries.sort(Map.Entry.comparingByKey());

        for (Map.Entry<Long, Integer> entry : sortedEntries) {
            long epochTimestamp = entry.getKey();
            int currentRate = entry.getValue();
            if (currentRate >= percentileThreshold) {
                // If the current rate is above the threshold, we are in a continuous range
                if (start == null) {
                    start = epochTimestamp; // Start a new range
                }
                end = epochTimestamp; // Extend the current range
            } else {
                // If the current rate drops below the threshold, finalize the previous range
                if (start != null) {
                    TimeRange currentRange = new TimeRange(start, end);
                    ranges.add(currentRange);
                    start = null; // Reset the start for the next range
                    end = null;   // Reset the end for the next range
                }
            }
        }
        // If a range is still ongoing at the end, add it to the largest range
        if (start != null) {
            TimeRange currentRange = new TimeRange(start, end);
            ranges.add(currentRange);

        }
        return ranges;
    }

    // Method to find the largest continuous time range where request rate is above the given percentile
    public static TimeRange findLargestContinuousRangeAbovePercentile(
            Map<Long, Integer> epochTimestampsMap, int percentile) {

        // Calculate the percentile threshold
        List<Integer> allRequestRates = new ArrayList<>(epochTimestampsMap.values());

        // Sort request rates and calculate the percentile threshold
        Collections.sort(allRequestRates);
        int percentileIndex = (int) Math.ceil(allRequestRates.size() * (percentile / 100.0)) - 1;
        int percentileThreshold = allRequestRates.get(percentileIndex);

        // Print the percentile threshold
        System.out.println(percentile + "th Percentile (high request rate threshold): " + percentileThreshold);

        TimeRange largestRange = null;
        Long start = null;
        Long end = null;

        // Sort the map entries by epoch timestamp (ascending order)
        List<Map.Entry<Long, Integer>> sortedEntries = new ArrayList<>(epochTimestampsMap.entrySet());
        sortedEntries.sort(Map.Entry.comparingByKey());

        for (Map.Entry<Long, Integer> entry : sortedEntries) {
            long epochTimestamp = entry.getKey();
            int currentRate = entry.getValue();

            if (currentRate >= percentileThreshold) {
                // If the current rate is above the threshold, we are in a continuous range
                if (start == null) {
                    start = epochTimestamp; // Start a new range
                }
                end = epochTimestamp; // Extend the current range
            } else {
                // If the current rate drops below the threshold, finalize the previous range
                if (start != null) {
                    TimeRange currentRange = new TimeRange(start, end);
                    if (largestRange == null || currentRange.duration() > largestRange.duration()) {
                        largestRange = currentRange; // Update the largest range if the current range is larger
                    }
                    start = null; // Reset the start for the next range
                    end = null;   // Reset the end for the next range
                }
            }
        }

        // If a range is still ongoing at the end, add it to the largest range
        if (start != null) {
            TimeRange currentRange = new TimeRange(start, end);
            if (largestRange == null || currentRange.duration() > largestRange.duration()) {
                largestRange = currentRange;
            }
        }
        return largestRange;
    }

    // TimeRange class to represent a start and end time in epoch format
    public static class TimeRange {
        long start;
        long end;

        public TimeRange(long start, long end) {
            this.start = start;
            this.end = end;
        }

        // Method to calculate the duration of the time range in minutes
        public long duration() {
            return (end - start) / 60000; // Convert milliseconds to minutes
        }
    }
}