package perfgenie.utils;
import java.util.Map;

public class ArgusConfig {
    public ArgusConfig(){}
    Map<String,String> queries;
    Map<String,Map<String,String>> metrics;
    public Map<String,String> getQueries() {
        return queries;
    }
    public void setQueries(Map<String, String> queries) {
        this.queries = queries;
    }
    public Map<String,Map<String,String>> getMetrics() {
        return metrics;
    }
    public void setMetrics(Map<String,Map<String,String>> metrics) {
        this.metrics = metrics;
    }
}
