/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * MCP (Model Context Protocol) client for communicating with MCP servers
 */
public class MCPClient {
    
    private static final Logger logger = LoggerFactory.getLogger(MCPClient.class);
    
    private final MCPServerConfig config;
    private final ObjectMapper objectMapper;
    private Process serverProcess;
    private BufferedReader serverOutput;
    private PrintWriter serverInput;
    private boolean connected = false;
    private Map<String, MCPTool> availableTools = new HashMap<>();
    
    public MCPClient(MCPServerConfig config) {
        this.config = config;
        this.objectMapper = new ObjectMapper();
    }
    
    /**
     * Connect to the MCP server
     */
    public boolean connect() {
        try {
            // Build command
            List<String> command = new ArrayList<>();
            command.add(config.getCommand());
            if (config.getArgs() != null) {
                command.addAll(config.getArgs());
            }
            
            // Set up environment
            ProcessBuilder processBuilder = new ProcessBuilder(command);
            if (config.getEnv() != null) {
                processBuilder.environment().putAll(config.getEnv());
            }
            
            // Start the server process
            serverProcess = processBuilder.start();
            serverOutput = new BufferedReader(new InputStreamReader(serverProcess.getInputStream()));
            serverInput = new PrintWriter(new OutputStreamWriter(serverProcess.getOutputStream()), true);
            
            // Initialize MCP connection
            if (initializeMCP()) {
                connected = true;
                logger.info("Connected to MCP server: " + config.getName());
                return true;
            } else {
                disconnect();
                return false;
            }
            
        } catch (Exception e) {
            logger.error("Failed to connect to MCP server " + config.getName() + ": " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Initialize MCP connection with the server
     */
    private boolean initializeMCP() {
        try {
            // Send initialize request
            ObjectNode initRequest = objectMapper.createObjectNode();
            initRequest.put("jsonrpc", "2.0");
            initRequest.put("id", 1);
            initRequest.put("method", "initialize");
            
            ObjectNode params = objectMapper.createObjectNode();
            params.put("protocolVersion", "2024-11-05");
            params.set("capabilities", objectMapper.createObjectNode());
            ObjectNode clientInfo = objectMapper.createObjectNode();
            clientInfo.put("name", "claude-java-client");
            clientInfo.put("version", "1.0.0");
            params.set("clientInfo", clientInfo);
            
            initRequest.set("params", params);
            
            sendRequest(initRequest);
            
            // Read response
            String response = readResponse();
            if (response != null) {
                JsonNode responseNode = objectMapper.readTree(response);
                if (responseNode.has("result")) {
                    // Get available tools
                    loadAvailableTools();
                    return true;
                }
            }
            
            return false;
            
        } catch (Exception e) {
            logger.error("Failed to initialize MCP connection: " + e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Load available tools from the server
     */
    private void loadAvailableTools() {
        try {
            // Request tools list
            ObjectNode toolsRequest = objectMapper.createObjectNode();
            toolsRequest.put("jsonrpc", "2.0");
            toolsRequest.put("id", 2);
            toolsRequest.put("method", "tools/list");
            
            sendRequest(toolsRequest);
            
            String response = readResponse();
            if (response != null) {
                JsonNode responseNode = objectMapper.readTree(response);
                if (responseNode.has("result") && responseNode.get("result").has("tools")) {
                    JsonNode tools = responseNode.get("result").get("tools");
                    for (JsonNode tool : tools) {
                        MCPTool mcpTool = objectMapper.treeToValue(tool, MCPTool.class);
                        availableTools.put(mcpTool.getName(), mcpTool);
                    }
                }
            }
            
        } catch (Exception e) {
            logger.error("Failed to load tools from MCP server: " + e.getMessage(), e);
        }
    }
    
    /**
     * Call a tool on the MCP server
     */
    public String callTool(String toolName, Map<String, Object> arguments) {
        if (!connected) {
            return "Error: Not connected to MCP server";
        }
        
        try {
            ObjectNode toolRequest = objectMapper.createObjectNode();
            toolRequest.put("jsonrpc", "2.0");
            toolRequest.put("id", System.currentTimeMillis());
            toolRequest.put("method", "tools/call");
            
            ObjectNode params = objectMapper.createObjectNode();
            params.put("name", toolName);
            params.set("arguments", objectMapper.valueToTree(arguments));
            
            toolRequest.set("params", params);
            
            sendRequest(toolRequest);
            
            String response = readResponse();
            if (response != null) {
                JsonNode responseNode = objectMapper.readTree(response);
                if (responseNode.has("result")) {
                    JsonNode result = responseNode.get("result");
                    if (result.has("content")) {
                        JsonNode content = result.get("content");
                        if (content.isArray() && content.size() > 0) {
                            JsonNode firstContent = content.get(0);
                            if (firstContent.has("text")) {
                                return firstContent.get("text").asText();
                            }
                        }
                    }
                } else if (responseNode.has("error")) {
                    return "Error: " + responseNode.get("error").get("message").asText();
                }
            }
            
            return "No response from MCP server";
            
        } catch (Exception e) {
            logger.error("Error calling tool: " + e.getMessage(), e);
            return "Error calling tool: " + e.getMessage();
        }
    }
    
    /**
     * Get available tools
     */
    public Map<String, MCPTool> getAvailableTools() {
        return new HashMap<>(availableTools);
    }
    
    /**
     * Check if a tool is available
     */
    public boolean hasTool(String toolName) {
        return availableTools.containsKey(toolName);
    }
    
    /**
     * Send a request to the server
     */
    private void sendRequest(ObjectNode request) {
        try {
            String requestJson = objectMapper.writeValueAsString(request);
            serverInput.println(requestJson);
            serverInput.flush();
        } catch (Exception e) {
            logger.error("Failed to send request: " + e.getMessage(), e);
        }
    }
    
    /**
     * Read a response from the server
     */
    private String readResponse() {
        try {
            String line = serverOutput.readLine();
            if (line != null && !line.trim().isEmpty()) {
                return line.trim();
            }
        } catch (IOException e) {
            logger.error("Failed to read response: " + e.getMessage(), e);
        }
        return null;
    }
    
    /**
     * Disconnect from the MCP server
     */
    public void disconnect() {
        connected = false;
        
        if (serverInput != null) {
            serverInput.close();
        }
        if (serverOutput != null) {
            try {
                serverOutput.close();
            } catch (IOException e) {
                // Ignore
            }
        }
        if (serverProcess != null) {
            serverProcess.destroy();
            try {
                if (!serverProcess.waitFor(5, TimeUnit.SECONDS)) {
                    serverProcess.destroyForcibly();
                }
            } catch (InterruptedException e) {
                serverProcess.destroyForcibly();
            }
        }
    }
    
    /**
     * Check if connected
     */
    public boolean isConnected() {
        return connected;
    }
    
    /**
     * Get server name
     */
    public String getServerName() {
        return config.getName();
    }
}

