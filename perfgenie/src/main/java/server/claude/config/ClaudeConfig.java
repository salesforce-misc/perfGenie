/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import server.claude.mcp.MCPServerConfig;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Configuration loader for Claude settings
 */
@Component
public class ClaudeConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(ClaudeConfig.class);
    private static final String DEFAULT_CONFIG_PATH = System.getProperty("user.home") + "/.claude/settings.json";
    
    @Value("${claude.config.path:${user.home}/.claude/settings.json}")
    private String configPath;
    
    @Value("${claude.auth.token:}")
    private String authToken;
    
    @Value("${claude.bedrock.base.url:}")
    private String bedrockBaseUrl;
    
    @Value("${claude.model:claude-3-sonnet-20240229}")
    private String model;
    
    @Value("${claude.use.bedrock:false}")
    private boolean useBedrock;
    
    @Value("${claude.skip.bedrock.auth:false}")
    private boolean skipBedrockAuth;
    
    private List<MCPServerConfig> mcpServers;
    
    public ClaudeConfig() {
        // Initialize defaults for non-Spring usage
        this.model = "claude-3-sonnet-20240229";
        this.useBedrock = false;
        this.skipBedrockAuth = false;
        this.configPath = DEFAULT_CONFIG_PATH;
        this.mcpServers = new ArrayList<>();
        this.authToken = null; // Will be loaded from config file or env
        this.bedrockBaseUrl = null; // Will be loaded from config file or env
        // Call loadConfig manually for non-Spring usage
        loadConfig();
    }
    
    @PostConstruct
    public void loadConfig() {
        // Initialize defaults if not set by Spring
        if (this.model == null) {
            this.model = "claude-3-sonnet-20240229";
        }
        if (this.configPath == null || this.configPath.isEmpty()) {
            this.configPath = DEFAULT_CONFIG_PATH;
        }
        try {
            String actualConfigPath = configPath != null && !configPath.isEmpty() 
                    ? configPath 
                    : DEFAULT_CONFIG_PATH;
            
            File configFile = new File(actualConfigPath);
            if (configFile.exists()) {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode config = mapper.readTree(configFile);
                
                // Load environment variables from config file
                JsonNode env = config.get("env");
                if (env != null) {
                    if (env.has("ANTHROPIC_AUTH_TOKEN") && (authToken == null || authToken.isEmpty())) {
                        this.authToken = env.get("ANTHROPIC_AUTH_TOKEN").asText();
                    }
                    if (env.has("ANTHROPIC_BEDROCK_BASE_URL") && (bedrockBaseUrl == null || bedrockBaseUrl.isEmpty())) {
                        this.bedrockBaseUrl = env.get("ANTHROPIC_BEDROCK_BASE_URL").asText();
                    }
                    if (env.has("CLAUDE_CODE_USE_BEDROCK")) {
                        this.useBedrock = "1".equals(env.get("CLAUDE_CODE_USE_BEDROCK").asText());
                    }
                    if (env.has("CLAUDE_CODE_SKIP_BEDROCK_AUTH")) {
                        this.skipBedrockAuth = "1".equals(env.get("CLAUDE_CODE_SKIP_BEDROCK_AUTH").asText());
                    }
                    
                    // Handle NODE_EXTRA_CA_CERTS for SSL certificate bundle
                    if (env.has("NODE_EXTRA_CA_CERTS")) {
                        String caCertPath = env.get("NODE_EXTRA_CA_CERTS").asText();
                        if (caCertPath != null && !caCertPath.trim().isEmpty()) {
                            // Check if already set in environment
                            String existingCaCert = System.getenv("NODE_EXTRA_CA_CERTS");
                            if (existingCaCert == null || existingCaCert.isEmpty()) {
                                // Check if the certificate file exists
                                File caCertFile = new File(caCertPath);
                                if (caCertFile.exists() && caCertFile.isFile()) {
                                    // Set as system property for Java SSL context
                                    System.setProperty("javax.net.ssl.trustStore", caCertPath);
                                    System.setProperty("NODE_EXTRA_CA_CERTS", caCertPath);
                                    logger.info("NODE_EXTRA_CA_CERTS set to: " + caCertPath);
                                } else {
                                    logger.warn("NODE_EXTRA_CA_CERTS file does not exist: " + caCertPath);
                                }
                            } else {
                                logger.debug("NODE_EXTRA_CA_CERTS already set in environment: " + existingCaCert);
                            }
                        }
                    }
                }
                
                // Load model from config file if not set via properties
                if (config.has("model") && "claude-3-sonnet-20240229".equals(this.model)) {
                    this.model = config.get("model").asText();
                }
                
                // Load MCP servers
                this.mcpServers = new ArrayList<>();
                JsonNode mcpServersNode = config.get("mcp_servers");
                if (mcpServersNode != null && mcpServersNode.isArray()) {
                    ObjectMapper mcpMapper = new ObjectMapper();
                    for (JsonNode serverNode : mcpServersNode) {
                        MCPServerConfig serverConfig = mcpMapper.treeToValue(serverNode, MCPServerConfig.class);
                        this.mcpServers.add(serverConfig);
                    }
                }
            }
            
            // Initialize mcpServers if not loaded
            if (this.mcpServers == null) {
                this.mcpServers = new ArrayList<>();
            }
            
            // Fallback to environment variables if not set
            if (authToken == null || authToken.isEmpty()) {
                authToken = System.getenv("ANTHROPIC_AUTH_TOKEN");
            }
            
            logger.info("=== Claude Configuration Loaded ===");
            logger.info("Auth Token: " + (authToken != null && !authToken.isEmpty() 
                    ? authToken.substring(0, Math.min(10, authToken.length())) + "..." 
                    : "not set"));
            logger.info("Bedrock Base URL: " + bedrockBaseUrl);
            logger.info("Model: " + model);
            logger.info("Use Bedrock: " + useBedrock);
            logger.info("Skip Bedrock Auth: " + skipBedrockAuth);
            logger.info("API URL: " + getApiUrl());
            logger.info("================================");
            
        } catch (IOException e) {
            logger.warn("Failed to load Claude configuration from " + configPath, e);
            logger.info("Using default/Spring Boot configuration...");
            
            // Fallback to environment variables
            if (authToken == null || authToken.isEmpty()) {
                authToken = System.getenv("ANTHROPIC_AUTH_TOKEN");
            }
        }
    }
    
    public String getAuthToken() {
        return authToken;
    }
    
    public String getBedrockBaseUrl() {
        return bedrockBaseUrl;
    }
    
    public String getModel() {
        return model;
    }
    
    public boolean isUseBedrock() {
        return useBedrock;
    }
    
    public boolean isSkipBedrockAuth() {
        return skipBedrockAuth;
    }
    
    public List<MCPServerConfig> getMcpServers() {
        return mcpServers != null ? mcpServers : new ArrayList<>();
    }
    
    public String getApiUrl() {
        if (useBedrock && bedrockBaseUrl != null && !bedrockBaseUrl.isEmpty()) {
            try {
                String encodedModel = java.net.URLEncoder.encode(model, "UTF-8");
                return bedrockBaseUrl + "/model/" + encodedModel + "/invoke";
            } catch (Exception e) {
                // Fallback to unencoded if encoding fails
                return bedrockBaseUrl + "/model/" + model + "/invoke";
            }
        } else {
            return "https://api.anthropic.com/v1/messages";
        }
    }
    
    /**
     * Load configuration from a specific file path
     * @param filePath The path to the configuration file
     * @return true if the file was successfully loaded, false otherwise
     */
    public boolean loadConfigFromPath(String filePath) {
        if (filePath == null || filePath.isEmpty()) {
            return false;
        }
        
        File configFile = new File(filePath);
        if (!configFile.exists()) {
            logger.debug("Config file does not exist: " + filePath);
            return false;
        }
        
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode config = mapper.readTree(configFile);
            
            // Load environment variables from config file
            JsonNode env = config.get("env");
            if (env != null) {
                if (env.has("ANTHROPIC_AUTH_TOKEN") && (authToken == null || authToken.isEmpty())) {
                    this.authToken = env.get("ANTHROPIC_AUTH_TOKEN").asText();
                    logger.info("Loaded auth token from " + filePath);
                }
                if (env.has("ANTHROPIC_BEDROCK_BASE_URL") && (bedrockBaseUrl == null || bedrockBaseUrl.isEmpty())) {
                    this.bedrockBaseUrl = env.get("ANTHROPIC_BEDROCK_BASE_URL").asText();
                }
                if (env.has("CLAUDE_CODE_USE_BEDROCK")) {
                    this.useBedrock = "1".equals(env.get("CLAUDE_CODE_USE_BEDROCK").asText());
                }
                if (env.has("CLAUDE_CODE_SKIP_BEDROCK_AUTH")) {
                    this.skipBedrockAuth = "1".equals(env.get("CLAUDE_CODE_SKIP_BEDROCK_AUTH").asText());
                }
                
                // Handle NODE_EXTRA_CA_CERTS for SSL certificate bundle
                if (env.has("NODE_EXTRA_CA_CERTS")) {
                    String caCertPath = env.get("NODE_EXTRA_CA_CERTS").asText();
                    if (caCertPath != null && !caCertPath.trim().isEmpty()) {
                        // Check if already set in environment
                        String existingCaCert = System.getenv("NODE_EXTRA_CA_CERTS");
                        if (existingCaCert == null || existingCaCert.isEmpty()) {
                            // Check if the certificate file exists
                            File caCertFile = new File(caCertPath);
                            if (caCertFile.exists() && caCertFile.isFile()) {
                                // Set as system property for Java SSL context
                                System.setProperty("javax.net.ssl.trustStore", caCertPath);
                                System.setProperty("NODE_EXTRA_CA_CERTS", caCertPath);
                                logger.info("NODE_EXTRA_CA_CERTS set to: " + caCertPath);
                            } else {
                                logger.warn("NODE_EXTRA_CA_CERTS file does not exist: " + caCertPath);
                            }
                        } else {
                            logger.debug("NODE_EXTRA_CA_CERTS already set in environment: " + existingCaCert);
                        }
                    }
                }
            }
            
            // Load model from config file if not set via properties
            if (config.has("model") && "claude-3-sonnet-20240229".equals(this.model)) {
                this.model = config.get("model").asText();
            }
            
            // Load MCP servers
            JsonNode mcpServersNode = config.get("mcp_servers");
            if (mcpServersNode != null && mcpServersNode.isArray()) {
                ObjectMapper mcpMapper = new ObjectMapper();
                this.mcpServers = new ArrayList<>();
                for (JsonNode serverNode : mcpServersNode) {
                    MCPServerConfig serverConfig = mcpMapper.treeToValue(serverNode, MCPServerConfig.class);
                    this.mcpServers.add(serverConfig);
                }
            }
            
            // Fallback to environment variables if still not set
            if (authToken == null || authToken.isEmpty()) {
                authToken = System.getenv("ANTHROPIC_AUTH_TOKEN");
            }
            
            logger.info("Configuration reloaded from " + filePath);
            return true;
            
        } catch (IOException e) {
            logger.warn("Failed to load Claude configuration from " + filePath, e);
            return false;
        }
    }
}

