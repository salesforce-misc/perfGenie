/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude;

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import server.claude.config.ClaudeConfig;
import server.claude.model.ClaudeMessage;
import server.claude.model.ClaudeRequest;
import server.claude.model.ClaudeResponse;
import server.claude.mcp.MCPManager;
import server.claude.mcp.MCPTool;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Service implementation for interacting with Claude API
 */
@Service
public class ClaudeService implements IClaudeService {
    
    private static final Logger logger = LoggerFactory.getLogger(ClaudeService.class);
    
    private final ClaudeConfig config;
    private final ObjectMapper objectMapper;
    private final MCPManager mcpManager;
    private OkHttpClient httpClient;
    
    @Autowired
    public ClaudeService(ClaudeConfig config, MCPManager mcpManager) {
        this.config = config;
        this.mcpManager = mcpManager;
        this.objectMapper = new ObjectMapper();
    }
    
    @PostConstruct
    public void init() {
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
        
        // Optionally connect to all enabled MCP servers on startup
        // Uncomment if you want automatic connection
        // mcpManager.connectAllServers();
        
        logger.info("ClaudeService initialized");
    }
    
    @PreDestroy
    public void cleanup() {
        if (httpClient != null) {
            httpClient.dispatcher().executorService().shutdown();
            httpClient.connectionPool().evictAll();
            logger.info("ClaudeService cleaned up");
        }
    }
    
    @Override
    public ClaudeResponse sendMessage(String userMessage) throws IOException {
        return sendMessage(userMessage, null);
    }
    
    @Override
    public ClaudeResponse sendMessage(String userMessage, List<ClaudeMessage> conversationHistory) throws IOException {
        // Build messages list
        List<ClaudeMessage> messages = new java.util.ArrayList<>();
        
        // Add conversation history if provided
        if (conversationHistory != null) {
            messages.addAll(conversationHistory);
        }
        
        // Add user message
        messages.add(new ClaudeMessage("user", userMessage));
        
        // Create request
        ClaudeRequest request = new ClaudeRequest(config.getModel(), messages);
        
        return sendRequest(request);
    }
    
    @Override
    public ClaudeResponse sendRequest(ClaudeRequest request) throws IOException {
        String json;
        if (config.isUseBedrock()) {
            // For Bedrock, create a custom JSON payload without model and stream fields
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("max_tokens", request.getMaxTokens());
            payload.put("messages", request.getMessages());
            payload.put("anthropic_version", request.getAnthropicVersion());
            json = objectMapper.writeValueAsString(payload);
        } else {
            json = objectMapper.writeValueAsString(request);
        }
        
        RequestBody body = RequestBody.create(
                MediaType.parse("application/json; charset=utf-8"),
                json
        );
        
        Request.Builder requestBuilder = new Request.Builder()
                .url(config.getApiUrl())
                .post(body);
        
        // Add headers based on configuration
        if (config.isUseBedrock()) {
            // For Bedrock, we need to use x-api-key header and anthropic_version
            requestBuilder.addHeader("x-api-key", config.getAuthToken());
            requestBuilder.addHeader("Content-Type", "application/json");
            requestBuilder.addHeader("anthropic_version", "2023-06-01");
        } else {
            requestBuilder.addHeader("x-api-key", config.getAuthToken());
            requestBuilder.addHeader("Content-Type", "application/json");
            requestBuilder.addHeader("anthropic-version", "2023-06-01");
        }
        
        Request httpRequest = requestBuilder.build();
        
        // Debug output
        logger.debug("=== API Request Debug ===");
        logger.debug("URL: " + httpRequest.url());
        logger.debug("Method: " + httpRequest.method());
        logger.debug("Headers: " + httpRequest.headers());
        logger.debug("Body: " + json);
        logger.debug("========================");
        
        try (Response response = httpClient.newCall(httpRequest).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "Unknown error";
                logger.error("Claude API error: HTTP {} - {}", response.code(), errorBody);
                throw new IOException("HTTP " + response.code() + ": " + errorBody);
            }
            
            String responseBody = response.body().string();
            return objectMapper.readValue(responseBody, ClaudeResponse.class);
        }
    }
    
    /**
     * Call an MCP tool
     * 
     * @param toolName The name of the tool to call
     * @param arguments The arguments for the tool
     * @return The result from the tool
     */
    public String callMCPTool(String toolName, Map<String, Object> arguments) {
        if (arguments == null) {
            arguments = new HashMap<>();
        }
        return mcpManager.callTool(toolName, arguments);
    }
    
    /**
     * Call an MCP tool on a specific server
     * 
     * @param serverName The name of the MCP server
     * @param toolName The name of the tool to call
     * @param arguments The arguments for the tool
     * @return The result from the tool
     */
    public String callMCPTool(String serverName, String toolName, Map<String, Object> arguments) {
        if (arguments == null) {
            arguments = new HashMap<>();
        }
        return mcpManager.callTool(serverName, toolName, arguments);
    }
    
    /**
     * Get all available MCP tools from all connected servers
     * 
     * @return Map of tool names to MCPTool objects
     */
    public Map<String, MCPTool> getAvailableMCPTools() {
        return mcpManager.getAllAvailableTools();
    }
    
    /**
     * Get available MCP tools from a specific server
     * 
     * @param serverName The name of the MCP server
     * @return Map of tool names to MCPTool objects
     */
    public Map<String, MCPTool> getAvailableMCPTools(String serverName) {
        return mcpManager.getAvailableTools(serverName);
    }
    
    /**
     * Connect to an MCP server
     * 
     * @param serverName The name of the server to connect to
     * @return true if connection was successful
     */
    public boolean connectMCPServer(String serverName) {
        return mcpManager.connectServer(serverName);
    }
    
    /**
     * Connect to all enabled MCP servers
     */
    public void connectAllMCPServers() {
        mcpManager.connectAllServers();
    }
    
    /**
     * Disconnect from an MCP server
     * 
     * @param serverName The name of the server to disconnect from
     */
    public void disconnectMCPServer(String serverName) {
        mcpManager.disconnectServer(serverName);
    }
    
    /**
     * Get list of connected MCP servers
     * 
     * @return List of server names
     */
    public List<String> getConnectedMCPServers() {
        return mcpManager.getConnectedServers();
    }
    
    /**
     * Get list of configured MCP servers
     * 
     * @return List of server names
     */
    public List<String> getConfiguredMCPServers() {
        return mcpManager.getConfiguredServers();
    }
    
    /**
     * Check if an MCP server is connected
     * 
     * @param serverName The name of the server
     * @return true if the server is connected
     */
    public boolean isMCPServerConnected(String serverName) {
        return mcpManager.isServerConnected(serverName);
    }
    
    /**
     * Send a message to Claude with MCP tool context
     * This method enhances the user message with information about available MCP tools
     * 
     * @param userMessage The user's message
     * @param includeMCPContext Whether to include MCP tool information in the message
     * @return ClaudeResponse containing the API response
     * @throws IOException if there's an error communicating with the API
     */
    public ClaudeResponse sendMessageWithMCPContext(String userMessage, boolean includeMCPContext) throws IOException {
        if (includeMCPContext) {
            Map<String, MCPTool> tools = getAvailableMCPTools();
            if (!tools.isEmpty()) {
                StringBuilder context = new StringBuilder(userMessage);
                context.append("\n\nAvailable MCP Tools:\n");
                for (MCPTool tool : tools.values()) {
                    context.append("- ").append(tool.getName());
                    if (tool.getDescription() != null && !tool.getDescription().isEmpty()) {
                        context.append(": ").append(tool.getDescription());
                    }
                    context.append("\n");
                }
                userMessage = context.toString();
            }
        }
        return sendMessage(userMessage);
    }
}

