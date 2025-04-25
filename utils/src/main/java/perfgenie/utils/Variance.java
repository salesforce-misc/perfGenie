package perfgenie.utils;

import java.util.*;
import java.util.stream.DoubleStream;

/** Triple for median, confidence and variance.
 */
class VarianceResult {
    double median;
    double confidence;
    double variance;

    VarianceResult(double median, double confidence, double variance) {
        this.median = median;
        this.confidence = confidence;
        this.variance = variance;
    }
}

public class Variance {
    static int bootstrapCount = 0;//1000;
    static int bootstrapSize = 5000;
    /* Gets variance info for given metric.
       We get the metric for all selected pods and times and then calculate the variance, which is defined as
       sum(max - min) / length across pods and observations with observations sorted from highest to lowest.
       The function also calculates the median value and its confidence using bootstrap, if bootstrap count is greater
       than zero. This works by taking N samples from all the pod's values, calculating medians of the those datasets
       and then reporting the mean and confidence on this distribution.
     */
    static VarianceResult getVarianceOf(String metric, long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        ArrayList<double[]> data = new ArrayList<>();

        // get the required metric
        for (String pod : pods) {
            ArgusQueryT.DatapointsQueryResponse res = ArgusQueryT.getJvmCpuMsPerReqTimeSeriesDatapoints(timestampStart, timestampEnd, instance, domain, cell, Collections.singletonList(pod));
            if (res == null)
                continue;
            // we have valid result, create array from the datapoints we got back, sort & reverse so that we go from highest to lowest
            double[] arr = res.datapoints;//duplicate
            Arrays.sort(arr);//duplicate
            reverseArray(arr);//duplicate
            data.add(arr);
        }

        // calculate the stats
        return calculateVariance(data);
    }

    /* calculates the variance of given set of observations. This is *not* the standard statistical variance, but an
       integral metric that sorts each dataset from highest to lowest and then at each observation sums up the
       difference between min and max. The summarized number is then divided by the number of observations
     */
    static VarianceResult calculateVariance(ArrayList<double[]> from) {
        // sort the arrays in descending order
        int maxL = 0;
        for (double [] a : from) {
            //Arrays.sort(a);//duplication
            //reverseArray(a);//duplication
            // and figure out the max length
            if (maxL < a.length)
                maxL = a.length;
        }
        double result = 0;
        for (int i = 0; i < maxL; i++) {
            double min = Double.POSITIVE_INFINITY;
            double max = Double.NEGATIVE_INFINITY;
            for (double [] a : from) {
                if (i < a.length) {
                    if (a[i] < min)
                        min = a[i];
                    if (a[i] > max)
                        max = a[i];
                }
            }
            result = result + (max - min);
        }

        // if bootstrap is disabled we are done
        if (bootstrapCount == 0)
            return new VarianceResult(0, 0, result / maxL);

        // flatten the pod datasets (we don't care they are sorted as we do random sapling anyways)
        double[] input = from.stream()
                .flatMapToDouble(DoubleStream::of)
                .toArray();

        // the array of medians for the sampled datasets (not expecting normal distribution)
        double[] medians = new double[bootstrapCount];
        // create the sampled datasets and fill the medians array
        for (int i = 0; i < medians.length; i++) {
            double[] dataset = sample(input, bootstrapSize);
            medians[i] = calculateMedian(dataset);
        }
        // calculate array's median (now we expect normal distribution), and standard deviation & error
        double medianMean = calculateMean(medians);
        double sd = calculateSd(medians, medianMean);
        double se = sd / Math.sqrt(medians.length);

        // determine z-score based on the confidence intervals we want and calculate the confidence
        double zScore = 3.291; // for 0.999
        //double zScore = 2.576; // for 0.99
        //double zScore = 1.960; // for 0.95
        double confidence = se * zScore;

        return new VarianceResult(medianMean, confidence, result / maxL);
    }

    static double[] sample(double[] input, int sampleSize) {
        // Concatenate all double arrays into a single double[]
        double [] result = new double [sampleSize];
        Random rand = new Random(); //TODO: CHECK this, randomizing data is not correct
        for (int i = 0; i < sampleSize; i++) {
            int index = rand.nextInt(input.length);
            result[i] = input[index];
        }
        return result;
    }

    static void reverseArray(double [] a) {
        for (int i = 0; i < a.length / 2; i++) {
            double temp = a[i];
            a[i] = a[a.length - 1 - i];
            a[a.length - 1 - i] = temp;
        }
    }

    static double calculateMean(double [] from) {
        if (from.length == 0)
            return 0;
        double sum = 0.0;
        for (double v : from)
            sum += v;
        return sum / from.length;
    }

    static double calculateSd(double [] from, double mean) {
        if (from.length == 0)
            return 0;
        double sd = 0.0;
        for (double v : from)
            sd += Math.pow(v - mean, 2);
        return Math.sqrt(sd / from.length);
    }

    static double calculateMedian(double[] from) {
        Arrays.sort(from);
        return from[from.length / 2];
    }
}
