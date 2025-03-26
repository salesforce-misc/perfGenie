package perfgenie.utils;

public class ArgusQueryT {
    static String containerResourceCount = "GROUPBYTAG(START:END:kube-state-metrics.aws.INSTANCE.DOMAIN:kube_pod_container_resource_requests{k8s_container_name=coreapp,k8s_pod_name=POD,resource=cpu}:max:all-max,#k8s_container_name#,#SUM#)";
    static String containerCPUSecondsTotalDiff = "DIFF(\n" +
            "  GROUPBYTAG(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD}:max:all-max,#k8s_container_name#,#SUM#),\n" +
            "  GROUPBYTAG(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD}:min:all-min,#k8s_container_name#,#SUM#)\n" +
            ")";
    static String requestCPUSecondsTotalDiff = "DIFF(\n" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max,#k8s_container_name#,#SUM#),\n" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min,#k8s_container_name#,#SUM#)\n" +
            ")";
    static String totalTrustRequestCountLast_1_Min_Avg = "DOWNSAMPLE(\n" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,#k8s_container_name#,#SUM#,#union#),\n" +
            "  #1d-sum#,#0#,#abs#\n" +
            ")";
    static String totalRequestsLogMetric_COUNT = "DIFF(\n" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-COUNT{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max,#k8s_container_name#,#SUM#),\n" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-COUNT{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min,#k8s_container_name#,#SUM#)\n" +
            ")";
    static String avgJvmCpuPercent = "DOWNSAMPLE(\n" +
            "  ALIASBYREGEX(\n" +
            "    ALIAS(\n" +
            "      GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.processCpuLoadPercent.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),\n" +
            "      #:#,#literal#,#CELL#,#literal#\n" +
            "    ),\n" +
            "    #(.*)::\\{#\n" +
            "  ),\n" +
            "  #1d-avg#,#0#,#abs#\n" +
            ")";
    static String avgAPT = "DOWNSAMPLE(\n" +
            "  ALIASBYREGEX(\n" +
            "    ALIAS(\n" +
            "      GROUPBYTAG(\n" +
            "        GROUPBYTAG(\n" +
            "          GROUPBYTAG(\n" +
            "            START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestTime.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,#k8s_pod_name#,#SCALE#,#union#\n" +
            "          ),\n" +
            "          #k8s_container_name#,#SUM#,#union#\n" +
            "        ),\n" +
            "        FILL(\n" +
            "          CULL_BELOW(\n" +
            "            GROUPBYTAG(\n" +
            "              START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,#k8s_container_name#,#SUM#,#union#\n" +
            "            ),\n" +
            "            #1#,#value#\n" +
            "          ),\n" +
            "          #1m#,#0m#,#1#\n" +
            "        ),\n" +
            "        #k8s_container_name#,#DIVIDE#\n" +
            "      ),\n" +
            "      #:#,#literal#,#CELL#,#literal#\n" +
            "    ),\n" +
            "    #(.*)::\\{#\n" +
            "  ),\n" +
            "  #1d-avg#,#0#,#abs#\n" +
            ")";
}
