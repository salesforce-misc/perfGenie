package perfgenie.utils;

public class PerfGenieConstants {


    public static final Integer MAX_EVENT_SIZE = 1024;
    public static final String SOURCE_KEY = "source";
    public static final String PERFGENIE = "genie";
    public static final String SFDC = "maiev";
    public static final String TENANT_KEY = "tenant-id";
    //public static final String SFDC_TENANT_KEY = "tenant-id";
    public static final String PERFGENIE_EVENT_TAG = "-tenant-";
    public static final String PERFGENIE_LARGE_TAG = "-large-files-";
    public static final String PERFGENIE_JSTACK_EVENT_NAME = "json-jstack";

    public static String getEventNameSpace(final String tenant, final boolean isGenie){
        return isGenie ? PERFGENIE+PERFGENIE_EVENT_TAG+tenant: SFDC+PERFGENIE_EVENT_TAG+tenant;
    }
    public static String getLargeEventNameSpace(final String tenant, final boolean isGenie){
        return isGenie ? PERFGENIE+PERFGENIE_LARGE_TAG+tenant: SFDC+PERFGENIE_LARGE_TAG+tenant;
    }
}
