package perfgenie.utils;

import java.util.*;

public class TimeseriesSorter {

    public static boolean sortByTimestampsIfNeeded(List<Double> values, List<Long> timestamps) {
        int n = values.size();

        if (timestamps.size() != n) {
            return false;
        }

        // Step 1: Check if timestamps are already sorted (ascending)
        boolean sorted = true;
        for (int i = 1; i < n; i++) {
            if (timestamps.get(i - 1) > timestamps.get(i)) {
                sorted = false;
                break;
            }
        }

        if (sorted) return true; // No need to sort

        // Step 2: Create index array (0, 1, 2, ..., n-1)
        Integer[] indices = new Integer[n];
        for (int i = 0; i < n; i++) indices[i] = i;

        // Step 3: Sort indices based on timestamps
        Arrays.sort(indices, Comparator.comparingLong(timestamps::get));

        // Step 4: Apply permutation in-place with minimal memory
        applyPermutation(values, indices);
        applyPermutation(timestamps, indices);
        return true;
    }

    // Applies the given permutation to a list in-place (O(n) extra memory)
    private static <T> void applyPermutation(List<T> list, Integer[] perm) {
        int n = list.size();
        boolean[] visited = new boolean[n];

        for (int i = 0; i < n; i++) {
            if (visited[i] || perm[i] == i) continue;

            int j = i;
            T temp = list.get(i);

            while (!visited[j]) {
                visited[j] = true;
                int next = perm[j];

                if (next == i) {
                    list.set(j, temp);
                } else {
                    list.set(j, list.get(next));
                }
                j = next;
            }
        }
    }

    public static long findInterval(List<Long> timestamps){
        int sampleSize = Math.min(10, timestamps.size());
        Map<Long, Integer> intervalCounts = new HashMap<>();

        for (int i = 1; i < sampleSize; i++) {
            long interval = timestamps.get(i) - timestamps.get(i - 1);
            intervalCounts.put(interval, intervalCounts.getOrDefault(interval, 0) + 1);
        }

        long intervalMillis = intervalCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElseThrow(() -> new IllegalStateException("Unable to determine interval"))
                .getKey();

        return intervalMillis;
    }

    public static Map<String, List<?>> fillMissing(Map<String, List<?>> input) {
        // Step 1: Extract timestamps
        if (!input.containsKey("timestamps")) {
            throw new IllegalArgumentException("Input map must contain a 'timestamps' key.");
        }

        List<Long> timestamps = (List<Long>) input.get("timestamps");

        if (timestamps == null || timestamps.size() < 2) {
            throw new IllegalArgumentException("At least two timestamps are needed to infer interval.");
        }

        // Step 2: Detect interval from first 10 timestamps
        int sampleSize = Math.min(10, timestamps.size());
        Map<Long, Integer> intervalCounts = new HashMap<>();

        for (int i = 1; i < sampleSize; i++) {
            long interval = timestamps.get(i) - timestamps.get(i - 1);
            intervalCounts.put(interval, intervalCounts.getOrDefault(interval, 0) + 1);
        }

        long intervalMillis = intervalCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElseThrow(() -> new IllegalStateException("Unable to determine interval"))
                .getKey();

        System.out.println("Interval to fill:" + intervalMillis);
        // Step 3: Prepare result map
        Map<String, List<?>> result = new HashMap<>();
        List<Long> filledTimestamps = new ArrayList<>();
        result.put("timestamps", filledTimestamps);

        // Prepare result lists for value keys
        Map<String, List<Double>> originalValueLists = new HashMap<>();
        Map<String, List<Double>> filledValueLists = new HashMap<>();

        for (String key : input.keySet()) {
            if (key.equals("timestamps")) continue;
            List<Double> list = (List<Double>) input.get(key);
            originalValueLists.put(key, list);
            filledValueLists.put(key, new ArrayList<>());
            result.put(key, filledValueLists.get(key));
        }

        // Step 4: Fill data
        int index = 0;
        long current = timestamps.get(0);
        long end = timestamps.get(timestamps.size() - 1);

        while (current <= end) {
            filledTimestamps.add(current);

            if (index < timestamps.size() && timestamps.get(index).equals(current)) {
                // Copy actual values
                for (String key : originalValueLists.keySet()) {
                    filledValueLists.get(key).add(originalValueLists.get(key).get(index));
                }
                index++;
            } else {
                // Fill nulls for missing timestamp
                for (String key : originalValueLists.keySet()) {
                    filledValueLists.get(key).add(null);
                }
            }

            current += intervalMillis;
        }

        return result;
    }
}
