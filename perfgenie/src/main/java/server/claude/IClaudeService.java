/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude;

import server.claude.model.ClaudeMessage;
import server.claude.model.ClaudeRequest;
import server.claude.model.ClaudeResponse;
import server.claude.mcp.MCPTool;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Service interface for interacting with Claude API
 */
public interface IClaudeService {
    
    /**
     * Send a message to Claude and get a response
     * 
     * @param userMessage The user's message to send
     * @return ClaudeResponse containing the API response
     * @throws IOException if there's an error communicating with the API
     */
    ClaudeResponse sendMessage(String userMessage) throws IOException;
    
    /**
     * Send a message to Claude with conversation history
     * 
     * @param userMessage The user's message to send
     * @param conversationHistory Previous messages in the conversation
     * @return ClaudeResponse containing the API response
     * @throws IOException if there's an error communicating with the API
     */
    ClaudeResponse sendMessage(String userMessage, List<ClaudeMessage> conversationHistory) throws IOException;
    
    /**
     * Send a request to Claude API
     * 
     * @param request The ClaudeRequest to send
     * @return ClaudeResponse containing the API response
     * @throws IOException if there's an error communicating with the API
     */
    ClaudeResponse sendRequest(ClaudeRequest request) throws IOException;
    
    /**
     * Send a message to Claude with MCP tool context
     * 
     * @param userMessage The user's message to send
     * @param includeMCPContext Whether to include MCP tool information in the message
     * @return ClaudeResponse containing the API response
     * @throws IOException if there's an error communicating with the API
     */
    ClaudeResponse sendMessageWithMCPContext(String userMessage, boolean includeMCPContext) throws IOException;
    
    /**
     * Call an MCP tool
     * 
     * @param toolName The name of the tool to call
     * @param arguments The arguments for the tool
     * @return The result from the tool
     */
    String callMCPTool(String toolName, Map<String, Object> arguments);
    
    /**
     * Call an MCP tool on a specific server
     * 
     * @param serverName The name of the MCP server
     * @param toolName The name of the tool to call
     * @param arguments The arguments for the tool
     * @return The result from the tool
     */
    String callMCPTool(String serverName, String toolName, Map<String, Object> arguments);
    
    /**
     * Get all available MCP tools from all connected servers
     * 
     * @return Map of tool names to MCPTool objects
     */
    Map<String, MCPTool> getAvailableMCPTools();
    
    /**
     * Get available MCP tools from a specific server
     * 
     * @param serverName The name of the MCP server
     * @return Map of tool names to MCPTool objects
     */
    Map<String, MCPTool> getAvailableMCPTools(String serverName);
    
    /**
     * Connect to an MCP server
     * 
     * @param serverName The name of the server to connect to
     * @return true if connection was successful
     */
    boolean connectMCPServer(String serverName);
    
    /**
     * Connect to all enabled MCP servers
     */
    void connectAllMCPServers();
    
    /**
     * Disconnect from an MCP server
     * 
     * @param serverName The name of the server to disconnect from
     */
    void disconnectMCPServer(String serverName);
    
    /**
     * Get list of connected MCP servers
     * 
     * @return List of server names
     */
    List<String> getConnectedMCPServers();
    
    /**
     * Get list of configured MCP servers
     * 
     * @return List of server names
     */
    List<String> getConfiguredMCPServers();
    
    /**
     * Check if an MCP server is connected
     * 
     * @param serverName The name of the server
     * @return true if the server is connected
     */
    boolean isMCPServerConnected(String serverName);
}

