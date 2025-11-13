package perfgenie;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Response class for pidstat data that serializes to JSON format
 * 
 * Example JSON output (as array):
 * [
 *   {
 *     "scope": "usa12-casam-app-blue-5b978fb8b5-5k6zf",
 *     "metric": "cpuTimeMs",
 *     "tags": {
 *       "cell": "usa12",
 *       "datacenter": "aws-prod0-uswest2"
 *     },
 *     "displayName": "usa12-casam-app-blue-5b978fb8b5-5k6zf:cpuTimeMs",
 *     "datapoints": {
 *       "1762204200000": 68.76804652754019,
 *       "1762204260000": 54.14445648248465
 *     }
 *   }
 * ]
 * 
 * To serialize as an array, use List<PidStatResponse>:
 * List<PidStatResponse> responses = new ArrayList<>();
 * responses.add(response1);
 * responses.add(response2);
 * ObjectMapper mapper = new ObjectMapper();
 * String json = mapper.writeValueAsString(responses);
 */
public class PidStatResponse {
    
    @JsonProperty("scope")
    private String scope;
    
    @JsonProperty("metric")
    private String metric;
    
    @JsonProperty("tags")
    private Map<String, String> tags;
    
    @JsonProperty("displayName")
    private String displayName;
    
    @JsonProperty("datapoints")
    private Map<String, Double> datapoints;
    
    /**
     * Default constructor
     */
    public PidStatResponse() {
        this.tags = new HashMap<>();
        this.datapoints = new HashMap<>();
    }
    
    /**
     * Constructor with all fields
     * 
     * @param scope The scope identifier
     * @param metric The metric name
     * @param tags Map of tags
     * @param displayName The display name
     * @param datapoints Map of timestamp (as string) to value pairs
     */
    public PidStatResponse(String scope, String metric, Map<String, String> tags, 
                          String displayName, Map<String, Double> datapoints) {
        this.scope = scope;
        this.metric = metric;
        this.tags = tags != null ? tags : new HashMap<>();
        this.displayName = displayName;
        this.datapoints = datapoints != null ? datapoints : new HashMap<>();
    }
    
    /**
     * Gets the scope
     * 
     * @return The scope identifier
     */
    public String getScope() {
        return scope;
    }
    
    /**
     * Sets the scope
     * 
     * @param scope The scope identifier
     */
    public void setScope(String scope) {
        this.scope = scope;
    }
    
    /**
     * Gets the metric
     * 
     * @return The metric name
     */
    public String getMetric() {
        return metric;
    }
    
    /**
     * Sets the metric
     * 
     * @param metric The metric name
     */
    public void setMetric(String metric) {
        this.metric = metric;
    }
    
    /**
     * Gets the tags
     * 
     * @return Map of tags
     */
    public Map<String, String> getTags() {
        return tags;
    }
    
    /**
     * Sets the tags
     * 
     * @param tags Map of tags
     */
    public void setTags(Map<String, String> tags) {
        this.tags = tags != null ? tags : new HashMap<>();
    }
    
    /**
     * Adds a tag
     * 
     * @param key The tag key
     * @param value The tag value
     */
    public void addTag(String key, String value) {
        if (this.tags == null) {
            this.tags = new HashMap<>();
        }
        this.tags.put(key, value);
    }
    
    /**
     * Gets the display name
     * 
     * @return The display name
     */
    public String getDisplayName() {
        return displayName;
    }
    
    /**
     * Sets the display name
     * 
     * @param displayName The display name
     */
    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
    
    /**
     * Gets the datapoints
     * 
     * @return Map of timestamp (as string) to value pairs
     */
    public Map<String, Double> getDatapoints() {
        return datapoints;
    }
    
    /**
     * Sets the datapoints
     * 
     * @param datapoints Map of timestamp (as string) to value pairs
     */
    public void setDatapoints(Map<String, Double> datapoints) {
        this.datapoints = datapoints != null ? datapoints : new HashMap<>();
    }
    
    /**
     * Adds a datapoint
     * 
     * @param timestamp The timestamp as a string
     * @param value The value
     */
    public void addDatapoint(String timestamp, Double value) {
        if (this.datapoints == null) {
            this.datapoints = new HashMap<>();
        }
        this.datapoints.put(timestamp, value);
    }
    
    /**
     * Adds a datapoint using Long timestamp
     * 
     * @param timestamp The timestamp as a Long
     * @param value The value
     */
    public void addDatapoint(Long timestamp, Double value) {
        addDatapoint(String.valueOf(timestamp), value);
    }
    
    @Override
    public String toString() {
        return "PidStatResponse{" +
                "scope='" + scope + '\'' +
                ", metric='" + metric + '\'' +
                ", tags=" + tags +
                ", displayName='" + displayName + '\'' +
                ", datapoints=" + datapoints +
                '}';
    }
    
    /**
     * Main method for testing the PidStatResponse class
     * 
     * @param args Command line arguments (not used)
     */
    public static void main(String[] args) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            
            // Create sample PidStatResponse objects
            List<PidStatResponse> responses = new ArrayList<>();
            
            // First response
            PidStatResponse response1 = new PidStatResponse();
            response1.setScope("usa12-casam-app-blue-5b978fb8b5-5k6zf");
            response1.setMetric("cpuTimeMs");
            response1.addTag("cell", "usa12");
            response1.addTag("datacenter", "aws-prod0-uswest2");
            response1.setDisplayName("usa12-casam-app-blue-5b978fb8b5-5k6zf:cpuTimeMs");
            response1.addDatapoint("1762204200000", 68.76804652754019);
            response1.addDatapoint("1762204260000", 54.14445648248465);
            responses.add(response1);
            
            // Second response (different metric)
            PidStatResponse response2 = new PidStatResponse();
            response2.setScope("usa12-casam-app-blue-5b978fb8b5-5k6zf");
            response2.setMetric("gcCpu");
            response2.addTag("cell", "usa12");
            response2.addTag("datacenter", "aws-prod0-uswest2");
            response2.setDisplayName("usa12-casam-app-blue-5b978fb8b5-5k6zf:gcCpu");
            response2.addDatapoint("1762204200000", 12.345);
            response2.addDatapoint("1762204260000", 15.678);
            responses.add(response2);
            
            // Serialize to JSON array
            String json = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(responses);
            
            System.out.println("========================================");
            System.out.println("PidStatResponse JSON Output:");
            System.out.println("========================================");
            System.out.println(json);
            System.out.println("========================================");
            
            // Test deserialization (optional)
            List<PidStatResponse> deserialized = mapper.readValue(json, 
                mapper.getTypeFactory().constructCollectionType(List.class, PidStatResponse.class));
            
            System.out.println("\nDeserialized " + deserialized.size() + " response(s):");
            for (PidStatResponse resp : deserialized) {
                System.out.println("  - " + resp.getScope() + ":" + resp.getMetric() + 
                                  " (" + resp.getDatapoints().size() + " datapoints)");
            }
            
        } catch (JsonProcessingException e) {
            System.err.println("Error serializing/deserializing JSON: " + e.getMessage());
            e.printStackTrace();
        }
    }
}

