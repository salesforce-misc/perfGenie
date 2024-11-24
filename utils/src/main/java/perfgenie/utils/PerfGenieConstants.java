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

    public static final String PERFGENIE_GOLD_TAG = "gold";

    public static final String NAMESPACE_EVENT_META = "event-meta-data";

    public static String getMetatNameSpace(final String tenant, final String source, final String goldNamespace){
        if (source == null) {
            return SFDC + PERFGENIE_EVENT_TAG + tenant;
        }
        if(source.replace("=", "").equals(PERFGENIE_GOLD_TAG)){//return gold name space
            return goldNamespace;
        }
        return source.replace("=", "").equals(PERFGENIE) ? NAMESPACE_EVENT_META : SFDC+PERFGENIE_EVENT_TAG+tenant;
    }
    public static String getEventNameSpace(final String tenant, final String source, final String goldNamespace){

        if (source == null) {
            return SFDC + PERFGENIE_EVENT_TAG + tenant;
        }
        if (source.replace("=", "").equals(PERFGENIE_GOLD_TAG)) {//return gold name space
            return goldNamespace;
        } else if (source.replace("=", "").equals(PERFGENIE)) {
            return PERFGENIE + PERFGENIE_EVENT_TAG + tenant;
        } else {
            return SFDC + PERFGENIE_EVENT_TAG + tenant;
        }
    }
    public static String getLargeEventNameSpace(final String tenant, final String source, final String goldNamespace){
        if (source == null) {
            return SFDC + PERFGENIE_LARGE_TAG + tenant;
        }
        if (source.replace("=", "").equals(PERFGENIE_GOLD_TAG)) {//return gold name space
            return goldNamespace;
        } else if (source.replace("=", "").equals(PERFGENIE)) {
            return PERFGENIE + PERFGENIE_LARGE_TAG + tenant;
        } else {
            return SFDC + PERFGENIE_LARGE_TAG + tenant;
        }
    }
}
