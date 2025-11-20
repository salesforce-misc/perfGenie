/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude;

import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import server.claude.config.ClaudeConfig;
import server.claude.model.ClaudeMessage;
import server.claude.model.ClaudeRequest;
import server.claude.model.ClaudeResponse;
import server.claude.mcp.MCPManager;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.mockito.Mockito.*;
import static org.testng.Assert.*;

public class ClaudeServiceTest {

    @Mock
    private ClaudeConfig claudeConfig;
    
    @Mock
    private MCPManager mcpManager;

    private ClaudeService claudeService;

    @BeforeMethod
    public void setup() {
        MockitoAnnotations.openMocks(this);
        // Mock configuration values
        when(claudeConfig.getAuthToken()).thenReturn("test-token");
        when(claudeConfig.getModel()).thenReturn("claude-3-sonnet-20240229");
        when(claudeConfig.isUseBedrock()).thenReturn(false);
        when(claudeConfig.getApiUrl()).thenReturn("https://api.anthropic.com/v1/messages");
        
        claudeService = new ClaudeService(claudeConfig, mcpManager);
        claudeService.init(); // Initialize the HTTP client
    }

    @Test
    public void testSendMessage() throws IOException {
        // This test requires a real API token to work
        // It will load configuration from application.properties and ~/.claude/settings.json
        
        // Use real config for integration test - it will load from config file
        ClaudeConfig realConfig = new ClaudeConfig();
        
        // Check if auth token is available (from config file or env)
        String authToken = realConfig.getAuthToken();
        if (authToken == null || authToken.isEmpty()) {
            System.out.println("Skipping integration test - No auth token found in config file (~/.claude/settings.json) or environment");
            System.out.println("Please configure claude.config.path in application.properties or set ANTHROPIC_AUTH_TOKEN env var");
            return;
        }
        
        // For integration test, we need a real MCPManager
        MCPManager realMCPManager = new MCPManager(realConfig);
        ClaudeService realService = new ClaudeService(realConfig, realMCPManager);
        realService.init();
        
        try {
            // Send a simple test message
            ClaudeResponse response = realService.sendMessage("Hello, this is a test message. Please respond with 'Test successful'.");
            
            assertNotNull(response, "Response should not be null");
            assertNotNull(response.getContent(), "Response content should not be null");
            assertFalse(response.getContent().isEmpty(), "Response should have content");
            
            String textContent = response.getTextContent();
            assertNotNull(textContent, "Text content should not be null");
            assertFalse(textContent.isEmpty(), "Text content should not be empty");
            
            System.out.println("Claude API Test Response:");
            System.out.println("ID: " + response.getId());
            System.out.println("Model: " + response.getModel());
            System.out.println("Content: " + textContent);
            if (response.getUsage() != null) {
                System.out.println("Input Tokens: " + response.getUsage().getInputTokens());
                System.out.println("Output Tokens: " + response.getUsage().getOutputTokens());
            }
            
        } finally {
            realService.cleanup();
        }
    }

    @Test
    public void testSendMessageWithHistory() throws IOException {
        // Use real config for integration test - it will load from config file
        ClaudeConfig realConfig = new ClaudeConfig();
        
        // Check if auth token is available (from config file or env)
        String authToken = realConfig.getAuthToken();
        if (authToken == null || authToken.isEmpty()) {
            System.out.println("Skipping integration test - No auth token found in config file (~/.claude/settings.json) or environment");
            return;
        }
        
        MCPManager realMCPManager = new MCPManager(realConfig);
        ClaudeService realService = new ClaudeService(realConfig, realMCPManager);
        realService.init();
        
        try {
            // Create conversation history
            List<ClaudeMessage> history = new ArrayList<>();
            history.add(new ClaudeMessage("user", "What is 2+2?"));
            history.add(new ClaudeMessage("assistant", "2+2 equals 4."));
            
            // Send follow-up message
            ClaudeResponse response = realService.sendMessage("What is 2+2+2?", history);
            
            assertNotNull(response, "Response should not be null");
            String textContent = response.getTextContent();
            assertNotNull(textContent, "Text content should not be null");
            assertFalse(textContent.isEmpty(), "Text content should not be empty");
            
            System.out.println("Claude API Test with History Response:");
            System.out.println("Content: " + textContent);
            
        } finally {
            realService.cleanup();
        }
    }

    @Test
    public void testSendRequest() throws IOException {
        // Use real config for integration test - it will load from config file
        ClaudeConfig realConfig = new ClaudeConfig();
        
        // Check if auth token is available (from config file or env)
        String authToken = realConfig.getAuthToken();
        if (authToken == null || authToken.isEmpty()) {
            System.out.println("Skipping integration test - No auth token found in config file (~/.claude/settings.json) or environment");
            return;
        }
        
        MCPManager realMCPManager = new MCPManager(realConfig);
        ClaudeService realService = new ClaudeService(realConfig, realMCPManager);
        realService.init();
        
        try {
            // Create a custom request
            List<ClaudeMessage> messages = new ArrayList<>();
            messages.add(new ClaudeMessage("user", "Say 'API test successful' and nothing else."));
            
            ClaudeRequest request = new ClaudeRequest(realConfig.getModel(), messages);
            request.setMaxTokens(50);
            
            ClaudeResponse response = realService.sendRequest(request);
            
            assertNotNull(response, "Response should not be null");
            String textContent = response.getTextContent();
            assertNotNull(textContent, "Text content should not be null");
            
            System.out.println("Claude API Custom Request Test Response:");
            System.out.println("Content: " + textContent);
            
        } finally {
            realService.cleanup();
        }
    }

    @Test
    public void testConfigurationLoading() {
        // Test that configuration can be loaded
        ClaudeConfig config = new ClaudeConfig();
        
        assertNotNull(config, "Config should not be null");
        // Config should have default or loaded values
        assertNotNull(config.getModel(), "Model should not be null");
        
        System.out.println("Configuration Test:");
        System.out.println("Model: " + config.getModel());
        System.out.println("Use Bedrock: " + config.isUseBedrock());
        System.out.println("API URL: " + config.getApiUrl());
    }
}

