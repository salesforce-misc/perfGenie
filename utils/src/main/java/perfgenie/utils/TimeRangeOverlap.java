package perfgenie.utils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class TimeRangeOverlap {

    //finds the largest range that matches a given % of all ranges
    public static List<long[]> findOverlappingRanges(List<long[]> timeRanges, int percent) {
        List<List<long[]>> result = new ArrayList<>();

        // Iterate over each range in the input list
        for (int i = 0; i < timeRanges.size(); i++) {
            long[] range1 = timeRanges.get(i);
            long duration = range1[1] - range1[0];  // Calculate the duration of the range
            List<long[]> overlappingRanges = new ArrayList<>();

            // Create the first element with [start, end, duration]
            long[] rangeWithDuration = new long[]{range1[0], range1[1], duration};
            overlappingRanges.add(rangeWithDuration);

            // Check for overlap with all other ranges
            for (int j = 0; j < timeRanges.size(); j++) {
                if (i == j) continue; // Skip comparing the range with itself

                long[] range2 = timeRanges.get(j);

                // Check if there is an overlap
                if (isOverlapping(range1, range2)) {
                    overlappingRanges.add(range2);
                }
            }

            result.add(overlappingRanges);
        }

        // Sort the result by duration in descending order
        result.sort((group1, group2) -> {
            long duration1 = group1.get(0)[2]; // Duration is the 3rd element (index 2)
            long duration2 = group2.get(0)[2]; // Duration is the 3rd element (index 2)
            return Long.compare(duration2, duration1); // Sort in descending order
        });

        //optimal match
        List<long[]> optimalMatch = optimalMatch(result,percent);
        if(optimalMatch != null){
            for (int i = 0; i < optimalMatch.size(); i++) {
                long[] overlappingRange = optimalMatch.get(i);
                if(i==0){
                    System.out.print("Optimal match duration:" + overlappingRange[2] + " ");
                }
                System.out.print("[" + overlappingRange[0] + ", " + overlappingRange[1] + "] ");
            }
            System.out.print("\n");
        }else{
            System.out.println("Optimal match not found.");
        }
        return optimalMatch;
    }

    private static List<long[]> optimalMatch(List<List<long[]>> overlappingRanges, int percent){
        int maxranges = overlappingRanges.size();
        for (int i = 0 ; i < maxranges; i++) {
            List<long[]> row = overlappingRanges.get(i);
            double percentMatch = (100.0*row.size())/maxranges;
            if(percentMatch > percent){
                return row;
            }
        }
        return null;
    }

    // Method to check if two time ranges overlap
    private static boolean isOverlapping(long[] range1, long[] range2) {
        // Check if range1 and range2 overlap
        return range1[0] <= range2[1] && range2[0] <= range1[1];
    }

    public static void main(String[] args) {
        // Example usage
        List<long[]> timeRanges = new ArrayList<>();
        timeRanges.add(new long[]{1, 5});
        timeRanges.add(new long[]{4, 7});
        timeRanges.add(new long[]{8, 10});
        timeRanges.add(new long[]{3, 6});

        List<long[]> overlappingRanges = findOverlappingRanges(timeRanges,50);

        for (int i = 0; i < overlappingRanges.size(); i++) {
            long[] overlappingRange = overlappingRanges.get(i);
            if(i==0){
                System.out.print("[" + overlappingRange[2] + "] ");
            }
            System.out.print("[" + overlappingRange[0] + ", " + overlappingRange[1] + "] ");
        }
    }
}