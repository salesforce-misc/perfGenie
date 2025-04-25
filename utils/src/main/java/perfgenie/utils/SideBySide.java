package perfgenie.utils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.*;


import static perfgenie.utils.Canary.*;


public class SideBySide {
    public static long mindiff = 3600000;
    public static long maxTimeWindow = 5 * 60 * 60 * 1000; // 5 hours due to argus query limitations, need to switch to huron

    public static CanaryResponse processSideBySideCanary(long timestampStart, long timestampEnd, String cell) {
        return processSideBySideCanaryTask(timestampStart, timestampEnd, podsInstance.get(cell), podsDomain.get(cell), cell);
    }

    public static CanaryResponse processSideBySideCanaryTask(long timestampStart, long timestampEnd, String instance, String domain, String cell) {
        List<Object> record = new ArrayList<>();
        List<String> metricList = new ArrayList(Arrays.asList("rCPUTime", "jCPUTime", "cCPUTime", "sfPt", "5xx", "4xx"));
        List<String> header = new ArrayList<>();

        CanaryDetails canary = processZingCanary(String.valueOf(timestampStart), String.valueOf(timestampEnd), instance, domain, cell);
        if (canary != null && canary.pod1.size() == canary.pod2.size()) {
            record.add(timestampEnd);//epoch
            header.add("timestamp:timestamp");
            record.add(1);//tid
            header.add("tid:text");
            record.add(cell);//cell
            header.add("cell:text");

            //total request Count
            ArgusQueryT.QueryResponse reqCount1 = ArgusQueryT.getArgusMetric("reqCount", canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod1);
            ArgusQueryT.QueryResponse reqCount2 = ArgusQueryT.getArgusMetric("reqCount", canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod2);
            Double rCount1 = 0.0;
            Double rCount2 = 0.0;
            if (reqCount1 != null && reqCount2 != null) {
                rCount1 = reqCount1.getMetric();
                rCount2 = reqCount2.getMetric();
                record.add(rCount1);//reqCount1
                header.add("rCount1:number");
                record.add(rCount2);//reqCount2
                header.add("rCount2:number");
                Double rCountPercentChange = 100.0 * (rCount1 - rCount2) / rCount1;
                record.add(rCountPercentChange);//jvmCpuPercentPerReqPercentChange
                header.add("rCount %c:number");
            } else {
                return null;
            }

            //startup
            ArgusQueryT.QueryResponse startUp1 = ArgusQueryT.getStatupAVG(canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod1);
            ArgusQueryT.QueryResponse startUp2 = ArgusQueryT.getStatupAVG(canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod2);
            if (startUp1 != null && startUp2 != null) {
                record.add(startUp1.getMetric());//APT1
                header.add("startUp1:number");
                record.add(startUp2.getMetric());//APT2
                header.add("startUp2:number");
                Double startUpPercentChange = 100.0 * (startUp1.getMetric() - startUp2.getMetric()) / startUp1.getMetric();
                record.add(startUpPercentChange);//startUpPercentChange
                header.add("startUp %c:number");
            } else {
                record.add(null);
                header.add("startUp1:number");
                record.add(null);
                header.add("startUp2:number");
                record.add(null);
                header.add("startUp %c:number");
            }

            //average APT
            ArgusQueryT.QueryResponse APT1 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod1);
            ArgusQueryT.QueryResponse APT2 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod2);
            if (APT1 != null && APT2 != null) {
                record.add(APT1.getMetric());//APT1
                header.add("avgAPT1:number");
                record.add(APT2.getMetric());//APT2
                header.add("avgAPT1:number");
                Double aptPercentChange = 100.0 * (APT1.getMetric() - APT2.getMetric()) / APT1.getMetric();
                record.add(aptPercentChange);//aptPercentChange
                header.add("avgAPT %c:number");
            } else {
                record.add(null);
                header.add("avgAPT1:number");
                record.add(null);
                header.add("avgAPT1:number");
                record.add(null);
                header.add("avgAPT %c:number");
            }

            for (int i = 0; i < metricList.size(); i++) {
                ArgusQueryT.QueryResponse res1 = ArgusQueryT.getArgusMetric(metricList.get(i), canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod1);
                ArgusQueryT.QueryResponse res2 = ArgusQueryT.getArgusMetric(metricList.get(i), canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod2);
                if (res1 != null && res2 != null) {
                    record.add(res1.getMetric());
                    header.add(metricList.get(i) + "1:number");
                    record.add(res2.getMetric());
                    header.add(metricList.get(i) + "2:number");
                    Double metricPercentChange = 100.0 * ((res1.getMetric() / rCount1) - (res2.getMetric() / rCount2)) / (res1.getMetric() / rCount1);
                    record.add(metricPercentChange);
                    header.add(metricList.get(i) + "/r %c:number");
                }else {
                    record.add(null);
                    header.add(metricList.get(i) + "1:number");
                    record.add(null);
                    header.add(metricList.get(i) + "2:number");
                    record.add(null);
                    header.add(metricList.get(i) + "/r %c:number");
                }
            }
            record.add(instance);//instance
            header.add("instance:text");
            record.add(domain);//instance
            header.add("domain:text");
            record.add(cell);//cell
            header.add("cell:text");
            record.add(2);//type release:1, sidebyside:2
            header.add("type:number");

            record.add(getCanaryDashboardURL(canary.pod1,canary.pod2,canary.finalStart,canary.finalEnd,instance,domain,cell));
            header.add("dashboard:url");

            record.add(getMetricDashboardURL(canary.finalStart,canary.finalEnd,instance,domain,cell));
            header.add("metrics:url");

            VarianceResult varianceZulu = Variance.getVarianceOf("jvmCpuMs", canary.finalStart,canary.finalEnd,instance,domain,cell, canary.pod1);
            VarianceResult varianceZing = Variance.getVarianceOf("jvmCpuMs", canary.finalStart,canary.finalEnd,instance,domain,cell, canary.pod2);
            record.add(varianceZulu.variance);
            header.add("varianceZulu:number");
            record.add(varianceZing.variance);
            header.add("varianceZing:number");

            return new CanaryResponse(header,record);
        }
        return null;
    }

    public static String getCanaryDashboardURL(List<String> pod1, List<String> pod2, long curfinalStart,
                                               long curfinalEnd, String instance, String domain, String cell) {
        String URL = "https://moncloud-grafana.sfproxy.monitoring.aws-esvc1-useast2.aws.sfdc.cl/d/evIw19pHz/zulu-zing-canary-falcon-rpulle-automation?orgId=1&";
        URL = URL + "&var-cell1=" + cell;
        URL = URL + "&var-cell2=" + cell;
        URL = URL + "&var-functional_domain1=" + domain;
        URL = URL + "&var-functional_domain2=" + domain;
        URL = URL + "&var-falcon_instance1=" + instance;
        URL = URL + "&var-falcon_instance2=" + instance;
        URL = URL + "&var-interval=1m";
        URL = URL + "&var-prev=0m";
        for (int i = 0; i < pod2.size(); i++) {
            URL = URL + "&var-pod2=" + pod2.get(i);
        }
        for (int i = 0; i < pod1.size(); i++) {
            URL = URL + "&var-pod1=" + pod1.get(i);
        }
        URL = URL + "&from=" + curfinalStart;
        URL = URL + "&to=" + curfinalEnd;
        return URL;
    }

    public static String getMetricDashboardURL(long curfinalStart, long curfinalEnd, String instance, String
            domain, String cell) {
        String URL1 = "https://monitoring.internal.salesforce.com/argusmvp/#/dashboards/94076428?&span=1m&aggregate=avg&k8s_pod_name=%2A&substrate=aws";
        URL1 = URL1 + "&cell=" + cell;
        URL1 = URL1 + "&instance=" + instance;
        URL1 = URL1 + "&domain=" + domain;
        URL1 = URL1 + "&start=" + curfinalStart;
        URL1 = URL1 + "&end=" + curfinalEnd;
        System.out.println(URL1);
        return URL1;
    }


    public static CanaryDetails processZingCanary(String start, String end, String instance, String domain, String cell) {
        String metric = ArgusQueryT.getGCMetric(start, end, instance, domain, cell);
        return parse(metric);
    }

    public static class CanaryDetails {
        public List<String> podall1;
        public List<String> podall2;
        public List<String> pod1;
        public List<String> pod2;
        public int count1;
        public int count2;
        public long finalStart;
        public long finalEnd;

        CanaryDetails() {
            podall1 = new ArrayList<>();
            podall2 = new ArrayList<>();
            pod1 = new ArrayList<>();
            pod2 = new ArrayList<>();
            count1 = 0;
            count2 = 0;
            finalStart = 0L;
            finalEnd = 0L;
        }
    }

    public static CanaryDetails parse(String metric) {

        CanaryDetails canary = new CanaryDetails();

        List<long[]> zingtimeRanges = new ArrayList<>();
        List<long[]> zulutimeRanges = new ArrayList<>();
        List<long[]> zingtimeRanges1 = new ArrayList<>();
        List<long[]> zulutimeRanges1 = new ArrayList<>();


        JSONObject jsonObject = new JSONObject(metric);
        JSONArray jsonArray = jsonObject.getJSONArray("array");
        for (int i = 0; i < jsonArray.length(); i++) {
            JSONObject object = jsonArray.getJSONObject(i);
            JSONObject datapoints = object.getJSONObject("datapoints");
            JSONObject tags = object.getJSONObject("tags");
            Iterator keys = datapoints.keys();
            //System.out.println("pod: " + tags.get("k8s_pod_name"));
            String pod = tags.get("k8s_pod_name").toString();
            int type = 0;
            long start = -1;
            long end = -1;
            boolean enter = true;

            List<Long> tmplist = new ArrayList<>();
            while (keys.hasNext()) {
                String k = keys.next().toString();
                tmplist.add(Long.parseLong(k));
            }
            Collections.sort(tmplist);

            for (int j = 0; j < tmplist.size(); j++) {
                Long k = tmplist.get(j);
                if (enter) {
                    start = k;
                    if (datapoints.getDouble(String.valueOf(k)) == -1) {
                        type = 0;
                    } else {
                        type = 1;
                    }
                    enter = false;
                } else {
                    if (type != 1 && !(datapoints.getDouble(String.valueOf(k)) == -1 && type == 0)) {
                        zingtimeRanges.add(new long[]{start, end});
                        zingtimeRanges1.add(new long[]{start, end});
                        canary.podall2.add(pod);
                        //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + " zing diff:" + (end - start));
                        type = 1;
                        if ((end - start) > mindiff) {
                            canary.count2++;
                        }
                        start = k;
                    } else if (type != 0 && !(datapoints.getDouble(String.valueOf(k)) != -1 && type == 1)) {
                        zulutimeRanges.add(new long[]{start, end});
                        zulutimeRanges1.add(new long[]{start, end});
                        canary.podall1.add(pod);
                        //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + "zulu diff:" + (end - start));
                        type = 0;
                        start = k;
                        canary.count1++;
                    }
                }
                end = k;
            }
            //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + " diff:" + (end - start));

            if (type == 0) {
                if ((end - start) > mindiff) {
                    canary.count2++;
                }
                zingtimeRanges.add(new long[]{start, end});
                zingtimeRanges1.add(new long[]{start, end});
                canary.podall2.add(pod);
            } else {
                zulutimeRanges.add(new long[]{start, end});
                zulutimeRanges1.add(new long[]{start, end});
                canary.podall1.add(pod);
                canary.count1++;
            }
        }
        System.out.println(" canary.count2:" + canary.count2 + " canary.count1:" + canary.count1);

        if (canary.count2 == 0) {
            return null;
        }

        Canary.Result result = findLargestIntersection(zingtimeRanges, canary.count2);
        HashMap<Integer, Boolean> zingpods = new HashMap<>();
        if (result != null && result.largestIntersection != null) {
            System.out.println("Largest Intersection zing: Start = " + result.largestIntersection[0] + ", End = " + result.largestIntersection[1] + " diff:" + (result.largestIntersection[0] - result.largestIntersection[1]));
            System.out.println("Combination for largest intersection:");
            for (long[] range : result.finalCombination) {

                for (int k = 0; k < zingtimeRanges1.size(); k++) {
                    if (!zingpods.containsKey(k)) {
                        long[] tmp = zingtimeRanges1.get(k);
                        if (tmp[0] == range[0] && tmp[1] == range[1]) {
                            zingpods.put(k, true);
                            System.out.println(canary.podall2.get(k) + ":" + Arrays.toString(range));
                            //URL = URL + "&var-pod2=" + zingkpods.get(k);
                            canary.pod2.add(canary.podall2.get(k));
                            break;
                        }
                    }
                }
            }
        } else {
            System.out.println(" No valid intersection found1.");
            return null;
        }

        if (canary.count2 == 0) {
            return null;
        }
        Canary.Result result1 = findLargestIntersection(zulutimeRanges, canary.count2);
        HashMap<Integer, Boolean> zulupods = new HashMap<>();
        if (result1 != null && result1.largestIntersection != null) {
            System.out.println("Largest Intersection zulu: Start = " + result1.largestIntersection[0] + ", End = " + result1.largestIntersection[1] + " diff:" + (result1.largestIntersection[0] - result1.largestIntersection[1]));
            System.out.println("Combination for largest intersection:");
            for (long[] range : result1.finalCombination) {
                for (int k = 0; k < zulutimeRanges1.size(); k++) {
                    if (!zulupods.containsKey(k)) {
                        long[] tmp = zulutimeRanges1.get(k);
                        if (tmp[0] == range[0] && tmp[1] == range[1]) {
                            zulupods.put(k, true);
                            System.out.println(canary.podall1.get(k) + ":" + Arrays.toString(range));
                            canary.pod1.add(canary.podall1.get(k));
                            break;
                        }
                    }
                }
            }
        } else {
            System.out.println("No valid intersection found2.");
            return null;
        }

        canary.finalStart = result.largestIntersection[0];
        if (result1.largestIntersection[0] > canary.finalStart) {
            canary.finalStart = result1.largestIntersection[0];
        }

        canary.finalEnd = result.largestIntersection[1];
        if (result1.largestIntersection[1] < canary.finalEnd) {
            canary.finalEnd = result1.largestIntersection[1];
        }

        long finalDiff = canary.finalEnd - canary.finalStart;

        System.out.println(" start: " + canary.finalStart + " end: " + canary.finalEnd + " finalDiff: " + finalDiff);

        //argus time window limit check
        if (maxTimeWindow < (canary.finalEnd - canary.finalStart)) {
            long diff = (canary.finalEnd - canary.finalStart - maxTimeWindow) / 2;
            canary.finalEnd = canary.finalEnd - diff - 1;
            canary.finalStart = canary.finalStart + diff + 1;
            System.out.println(" adjusted start: " + canary.finalStart + " end: " + canary.finalEnd + " finalDiff: " + finalDiff);
        }
        return canary;
    }

    public static Canary.Result findLargestIntersection(List<long[]> timeRanges, int k) {
        if (timeRanges == null || timeRanges.size() < k) {
            return null;  // Not enough ranges to choose from
        }

        // Sort the ranges by their start time
        timeRanges.sort(Comparator.comparingLong(range -> range[0]));

        long[] bestIntersection = null;
        long bestIntersectionSize = 0;
        List<long[]> finalCombination = null;

        // Generate all combinations of `k` ranges
        List<List<long[]>> combinations = generateCombinations(timeRanges, k);

        // Debugging: Output the combinations and check each one
        System.out.println("Total combinations: " + combinations.size());

        for (List<long[]> combination : combinations) {
            long intersectionStart = combination.get(0)[0];
            long intersectionEnd = combination.get(0)[1];

            // Check the intersection of this combination
            for (long[] range : combination) {
                intersectionStart = Math.max(intersectionStart, range[0]);
                intersectionEnd = Math.min(intersectionEnd, range[1]);

                if (intersectionStart > intersectionEnd) {
                    break;  // No intersection in this combination
                }
            }

            // If the intersection is valid, check if it's the largest we've found
            if (intersectionStart <= intersectionEnd) {
                long intersectionSize = intersectionEnd - intersectionStart;
                if (intersectionSize > bestIntersectionSize) {
                    bestIntersectionSize = intersectionSize;
                    bestIntersection = new long[]{intersectionStart, intersectionEnd};
                    finalCombination = combination;  // Store the combination that gave the largest intersection
                }
            }
        }

        // Return the result with the largest intersection and the corresponding combination
        if (bestIntersection != null) {
            return new Canary.Result(bestIntersection, finalCombination);
        } else {
            return null;
        }
    }

    // Generate combinations of k elements from a list
    private static List<List<long[]>> generateCombinations(List<long[]> list, int k) {
        List<List<long[]>> combinations = new ArrayList<>();
        generateCombinationsHelper(list, k, 0, new ArrayList<>(), combinations);
        return combinations;
    }

    private static void generateCombinationsHelper(List<long[]> list, int k, int start, List<long[]>
            current, List<List<long[]>> combinations) {
        if (current.size() == k) {
            combinations.add(new ArrayList<>(current));
            return;
        }

        for (int i = start; i < list.size(); i++) {
            current.add(list.get(i));
            generateCombinationsHelper(list, k, i + 1, current, combinations);
            current.remove(current.size() - 1);
        }
    }

    public static void main(String[] args) {
        try {
            int start = 6;
            int end = 4;

            for (int lastndays = end; lastndays <= start; lastndays++) {
                for (String cell : ArgusQueryT.pc.config.keySet()) {
                    if ((boolean) ArgusQueryT.pc.config.get(cell).get("enabled") == true && cell.equals("usa62s")) {
                        System.out.println(((List) ArgusQueryT.pc.config.get(cell).get("peak")).get(0));
                        long tmp1 = Canary.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.config.get(cell).get("peak")).get(0)));
                        long tmp2 = Canary.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.config.get(cell).get("peak")).get(1)));
                        tmp1 = tmp1 - lastndays * 24 * 60 * 60 * 1000;
                        tmp2 = tmp2 - lastndays * 24 * 60 * 60 * 1000;
                        CanaryResponse response = processSideBySideCanary(tmp1, tmp2, cell);
                        String dateString1 = Utils.convertEpochToUTCString(tmp1);
                        String dateString2 = Utils.convertEpochToUTCString(tmp2);
                        System.out.println(dateString1 + ":" + dateString2 + ":" + cell + "--->" + Utils.toJson(response));
                    }
                }
            }
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}
