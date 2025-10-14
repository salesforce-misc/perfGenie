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
}
