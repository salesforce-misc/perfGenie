package perfgenie.utils;

import java.util.Map;

public class PodConfig {
    public PodConfig(){}
    public Map<String, Map<String,Object>> getConfig() {
        return config;
    }

    public void setConfig(Map<String, Map<String,Object>> config) {
        this.config = config;
    }

    Map<String, Map<String,Object>> config;
}
