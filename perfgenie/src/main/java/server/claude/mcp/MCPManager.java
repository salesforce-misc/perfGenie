/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude.mcp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import server.claude.config.ClaudeConfig;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.util.*;

/**
 * Manages MCP servers and their connections
 */
@Component
public class MCPManager {
    
    private static final Logger logger = LoggerFactory.getLogger(MCPManager.class);
    
    private final Map<String, MCPClient> connectedServers = new HashMap<>();
    private final Map<String, MCPServerConfig> serverConfigs = new HashMap<>();
    private final ClaudeConfig claudeConfig;
    
    @Autowired
    public MCPManager(ClaudeConfig claudeConfig) {
        this.claudeConfig = claudeConfig;
    }
    
    @PostConstruct
    public void initialize() {
        loadMCPServers();
        // Optionally connect to all enabled servers on startup
        // connectAllServers();
    }
    
    /**
     * Load MCP server configurations from ClaudeConfig
     */
    private void loadMCPServers() {
        try {
            List<MCPServerConfig> configs = claudeConfig.getMcpServers();
            for (MCPServerConfig serverConfig : configs) {
                if (serverConfig.isEnabled()) {
                    serverConfigs.put(serverConfig.getName(), serverConfig);
                    logger.info("Loaded MCP server config: " + serverConfig.getName());
                }
            }
        } catch (Exception e) {
            logger.error("Failed to load MCP server configurations: " + e.getMessage(), e);
        }
    }
    
    /**
     * Reload MCP server configurations from ClaudeConfig
     * This should be called after the config has been reloaded
     */
    public void reloadMCPServers() {
        // Clear existing server configs
        serverConfigs.clear();
        // Reload from config
        loadMCPServers();
        logger.info("MCP server configurations reloaded");
    }
    
    /**
     * Connect to all enabled MCP servers
     */
    public void connectAllServers() {
        for (MCPServerConfig config : serverConfigs.values()) {
            if (config.isEnabled()) {
                connectServer(config.getName());
            }
        }
    }
    
    /**
     * Connect to a specific MCP server
     */
    public boolean connectServer(String serverName) {
        MCPServerConfig config = serverConfigs.get(serverName);
        if (config == null) {
            logger.error("MCP server not found: " + serverName);
            return false;
        }
        
        if (connectedServers.containsKey(serverName)) {
            logger.info("MCP server already connected: " + serverName);
            return true;
        }
        
        MCPClient client = new MCPClient(config);
        if (client.connect()) {
            connectedServers.put(serverName, client);
            logger.info("Connected to MCP server: " + serverName);
            return true;
        } else {
            logger.error("Failed to connect to MCP server: " + serverName);
            return false;
        }
    }
    
    /**
     * Disconnect from a specific MCP server
     */
    public void disconnectServer(String serverName) {
        MCPClient client = connectedServers.remove(serverName);
        if (client != null) {
            client.disconnect();
            logger.info("Disconnected from MCP server: " + serverName);
        }
    }
    
    /**
     * Disconnect from all MCP servers
     */
    @PreDestroy
    public void disconnectAllServers() {
        for (MCPClient client : connectedServers.values()) {
            client.disconnect();
        }
        connectedServers.clear();
        logger.info("Disconnected from all MCP servers");
    }
    
    /**
     * Call a tool on any available MCP server
     */
    public String callTool(String toolName, Map<String, Object> arguments) {
        for (MCPClient client : connectedServers.values()) {
            if (client.hasTool(toolName)) {
                return client.callTool(toolName, arguments);
            }
        }
        return "Tool not found: " + toolName;
    }
    
    /**
     * Call a tool on a specific MCP server
     */
    public String callTool(String serverName, String toolName, Map<String, Object> arguments) {
        MCPClient client = connectedServers.get(serverName);
        if (client == null) {
            return "MCP server not connected: " + serverName;
        }
        
        if (!client.hasTool(toolName)) {
            return "Tool not available on server " + serverName + ": " + toolName;
        }
        
        return client.callTool(toolName, arguments);
    }
    
    /**
     * Get all available tools from all connected servers
     */
    public Map<String, MCPTool> getAllAvailableTools() {
        Map<String, MCPTool> allTools = new HashMap<>();
        for (MCPClient client : connectedServers.values()) {
            allTools.putAll(client.getAvailableTools());
        }
        return allTools;
    }
    
    /**
     * Get available tools from a specific server
     */
    public Map<String, MCPTool> getAvailableTools(String serverName) {
        MCPClient client = connectedServers.get(serverName);
        if (client != null) {
            return client.getAvailableTools();
        }
        return new HashMap<>();
    }
    
    /**
     * List all connected servers
     */
    public List<String> getConnectedServers() {
        return new ArrayList<>(connectedServers.keySet());
    }
    
    /**
     * List all configured servers
     */
    public List<String> getConfiguredServers() {
        return new ArrayList<>(serverConfigs.keySet());
    }
    
    /**
     * Check if a server is connected
     */
    public boolean isServerConnected(String serverName) {
        return connectedServers.containsKey(serverName);
    }
    
    /**
     * Get server configuration
     */
    public MCPServerConfig getServerConfig(String serverName) {
        return serverConfigs.get(serverName);
    }
}

