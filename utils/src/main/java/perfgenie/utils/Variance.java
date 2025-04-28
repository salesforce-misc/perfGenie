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
            return calculateVariance(res.getDatapoints());
        return null;
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
    static VarianceResult calculateVariance(ArrayList<double[]> from) {
        // sort the arrays in descending order and figure the longest one
        int maxL = 0;
        for (double [] a : from) {
            Arrays.sort(a);
            reverseArray(a);
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
        Random rand = new Random(43); // use known seed for reproducibility
        for (int i = 0; i < medians.length; i++) {
            double[] dataset = sample(input, bootstrapSize, rand);
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
