package perfgenie.utils;

import java.util.*;
import java.util.stream.DoubleStream;

/* Triple for median, confidence and variance.

   Reports median of the dataset calculated with the help of dataset bootstrapping, its confidence intervals and the
   variance of the original dataset across all pods.

   We use median because the input dataset (average cpu time per request) is not expected to follow a normal
   distribution, which the mean assumes.
 */
class VarianceResult {
    double median;
    double confidence;
    double variance;
    double timeVariance;

    VarianceResult(double median, double confidence, double variance, double timeVariance) {
        this.median = median;
        this.confidence = confidence;
        this.variance = variance;
        this.timeVariance = timeVariance;
    }
}

public class Variance {
    /* Number of bootstrapped dataset to generate. 0 to disable dataset bootstrapping (confidence intervals will not
       work when bootstrap is disabled.
     */
    static int BOOTSTRAP_COUNT = 1000;//1000;

    /* Length of the bootstrapped datasets (number of samples per dataset). Setting this to 0 will make the bootstrapped
       length identical to the longest input dataset (pod).
     */
    static int BOOTSTRAP_LENGTH = 0;

    /* Threshold for two times to be considered part of the same window in time based variance calculations. The default
       value of 50000 ms assumes 1m measurement distance and min time being always selected for comparison.
     */
    static int TIME_THRESHOLD_MS = 50000;

    /* Gets variance info for given metric.

       We get the metric for all selected pods and times and then calculate the variance, which is defined as
       sum(max - min) / length across pods and observations with observations sorted from highest to lowest.
       The function also calculates the median value and its confidence using bootstrap, if bootstrap count is greater
       than zero. This works by taking N samples from all the pod's values, calculating medians of the those datasets
       and then reporting the mean and confidence on this distribution.

       Bootstrapping the dataset is a common statistical technique to determine confidence in statistical values (see
       https://en.wikipedia.org/wiki/Bootstrapping_(statistics)). The default way of confidence interval measurements
       is not very precise, because we usually report the statistic of the dataset (say median) with confidence intervals
       calculated from the dataset itself - i.e. we pair an aggregate of the dataset with a confidence interval of the
       dataset itself which is not the same thing.

       Bootstrapping instead resamples the original dataset many times and calculates the desired statistic for each of
       the resampled datasets, giving us a distribution of the statistic itself. We then aggregate the distribution
       and report its confidence intervals (now calculated correctly from the statistic itself).

       An important feature of bootstrapping is that it is non-parametric, i.e. it does not assume anything about the
       input dataset and that it works with all kinds of statistics (for now we use it to calculate median of the dataset,
       but p99, or similar metrics would work exactly the same.
     */
    static VarianceResult getVarianceOf(String metric, long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        // get results for all pods, each pod will be its own array
        ArgusQueryT.DatapointsQueryResponse res = ArgusQueryT.getJvmCpuMsPerReqTimeSeriesDatapoints(timestampStart, timestampEnd, instance, domain, cell, pods);
        if (res != null)
            return calculate(res.getDatapoints());
        return new VarianceResult(Double.NaN, Double.NaN, Double.NaN, Double.NaN);
    }

    static VarianceResult calculate(ArrayList<AbstractMap.SimpleEntry<double[], double[]>> from) {
        // get the max length of input datasets which is useful for both variance and bootstrap calculation
        int maxL = 0;
        for (AbstractMap.SimpleEntry<double[], double[]> entry : from) {
            int l = entry.getKey().length;
            if (maxL < l)
                maxL = l;
        }

        // flatten the pod datasets (we don't care they are sorted as we do random sapling anyways)
        double[] input = from.stream()
                .map(AbstractMap.SimpleEntry::getValue)
                .flatMapToDouble(DoubleStream::of)
                .toArray();

        // determine the median value and its confidence interval using the bootstrap
        double[] medians = new double[BOOTSTRAP_COUNT == 0 ? 1 : BOOTSTRAP_COUNT];
        if (BOOTSTRAP_COUNT == 0) { // no bootstrap
            medians[0] = calculateMedian(input);
        } else { // populate the entire medians array with medians of random samples from the input
            Random rand = new Random(43); // use known seed for reproducibility
            for (int i = 0; i < medians.length; i++) {
                double[] dataset = sample(input, (BOOTSTRAP_LENGTH == 0) ? maxL : BOOTSTRAP_LENGTH, rand);
                medians[i] = calculateMedian(dataset);
            }
        }

        // calculate the variances
        double timeVariance = calculateTimeVariance(from, maxL);
        double variance = calculateVariance(from, maxL);

        // summarize the medians array and calculate its confidence intervals (if no bootstrap just return the median
        // there
        if (medians.length == 1) {
            return new VarianceResult(medians[0], 0, variance, timeVariance);
        } else {
            double medianMean = calculateMean(medians);
            double sd = calculateSd(medians, medianMean);
            double se = sd / Math.sqrt(medians.length);

            // determine z-score based on the confidence intervals we want and calculate the confidence
            double zScore = 3.291; // for 0.999
            //double zScore = 2.576; // for 0.99
            //double zScore = 1.960; // for 0.95
            double confidence = se * zScore;

            return new VarianceResult(medianMean, confidence, variance, timeVariance);
        }
    }

    /* Calculates the variance in time of the given dataset

       We do this by summing up the max and min values for each time interval across the pods for which we have the data
       for the time. To normalize we divide by the number of distinct time values.
     */

    static double calculateTimeVariance(ArrayList<AbstractMap.SimpleEntry<double[], double[]>> input, int maxL) {
        int[] indices = new int[input.size()];
        double result = 0;
        int observations = 0;
        while (true) {
            double t = smallestTime(indices, input);
            if (t == Double.POSITIVE_INFINITY) // all indices have ended
                break;
            double min = Double.POSITIVE_INFINITY;
            double max = Double.NEGATIVE_INFINITY;
            for (int i = 0; i < indices.length; i++) {
                int idx = indices[i];
                if (idx >= input.get(i).getKey().length)
                    continue;
                double tt = input.get(i).getKey()[idx];
                if (!isSameTime(t, tt))
                    continue;
                double v = input.get(i).getValue()[idx];
                indices[i]++;
                if (v < min)
                    min = v;
                if (v > max)
                    max = v;
            }
            result = result + (max - min);
            observations++;
        }
        if (observations != 0)
            result = result / observations;
        return result;
    }

    static double smallestTime(int[] indices, ArrayList<AbstractMap.SimpleEntry<double[], double[]>> input) {
        double result = Double.POSITIVE_INFINITY;
        for (int i = 0; i < indices.length; i++) {
            int idx = indices[i];
            if (idx >= input.get(i).getKey().length)
                continue;
            double t = input.get(i).getKey()[idx];
            if (t < result)
                result = t;
        }
        return result;
    }

    /* Assuming the timestamps in milliseconds and interval duration of 60 seconds (as the test data are), we assume that
       any two values within 45 seconds of each other belong to the same time. Note that we already obtained t1 as the
       smallest time available.
     */
    static boolean isSameTime(double t1, double t2) {
        return Math.abs(t2 - t1) < TIME_THRESHOLD_MS;
    }

    /* Calculates the variance of given set of observations. This is *not* the standard statistical variance, but an
       integral metric that sorts each dataset from highest to lowest and then at each observation sums up the
       difference between min and max. The summarized number is then divided by the number of observations for
       normalization.

       We first sort the datapoints within each pod from largest to smallest to reduce noise in the comparison. This is
       because time is not considered in the later measurements thus by removing it by sorting we make the calculated
       variance more representative of the actual variance of the dataset wrt the calculated metric. As an example
       consider two cells with the following results:

       A:   10  1 10  1 10  1 ...
       B:    1 10  1 10  1 10 ...

       While the cells alternate in *time*, their actual performance over time is identical (their mean & median would
       be as well). Sorting in this case makes sure that we are comparing the overall performance and the characteristics
       of the performance curve in general. That said, if the performance curve differs, sorting will not obscure it:

       A:   10  1  1 10  1  1 10  1  1 ...
       B:   10  1 10  1 10  1 10  1 10 ...

       When sorted:

       A:   10 10 10  1  1  1  1  1  1 ...
       B:   10 10 10 10 10  1  1  1  1 ...
                     _____
                       |
                       | This is the area where node B is worse

        The sorting in general helps capturing the shape of the variance rather than temporal fluctuations. This is not
        to say that temporal fluctuations are not important, but for the purpose of dataset comparison by median, which
        itself is time-insensitive, time-based variance is not necessary and will not perform that well.

        To rephrase: The point of the variance calculation is not to determine if the datasets are similar in time, but
        if the datasets are differ in a way that can affect the calculated statistic (median/mean in our case).
     */
    static double calculateVariance(ArrayList<AbstractMap.SimpleEntry<double[], double[]>> input, int maxL) {
        // sort the value arrays
        ArrayList<double[]> inputValues = new ArrayList<>();
        for (AbstractMap.SimpleEntry<double[], double[]> a : input) {
            double[] arr = a.getValue();
            Arrays.sort(arr);
            reverseArray(arr);
            inputValues.add(arr);
            // a bit of defense - set the values to null because we have just sorted the array above and we do not want
            // to do any stats on sorted array later
            a.setValue(null);
        }
        // calculate variance
        double result = 0;
        for (int i = 0; i < maxL; i++) {
            double min = Double.POSITIVE_INFINITY;
            double max = Double.NEGATIVE_INFINITY;
            for (double [] a : inputValues) {
                if (i < a.length) {
                    if (a[i] < min)
                        min = a[i];
                    if (a[i] > max)
                        max = a[i];
                }
            }
            result = result + (max - min);
        }
        return result / maxL;
    }

    /* Generates a random sample from the input vector.

       re TODO:
       We are generating large set of randomized datasets from the input vector (which comes from all the pods we have).
       The randomization is statistically correct (provided there is enough samples) as it does not *reduce* the dataset
       but inflate its size instead. This means that for any observation in the original dataset, the chance of being
       obscured by the bootstrap sampling is essentially 0. Sampling with replacement ensures that the input dataset
       maintains its statistical properties.
     */
    static double[] sample(double[] input, int sampleSize, Random rand) {
        double [] result = new double [sampleSize];
        //Random rand = new Random(); //TODO: CHECK this, randomizing data is not correct
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
