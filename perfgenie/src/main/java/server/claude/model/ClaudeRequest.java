/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.claude.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Represents a request to the Claude API
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClaudeRequest {
    
    @JsonProperty("model")
    private String model;
    
    @JsonProperty("max_tokens")
    private int maxTokens;
    
    @JsonProperty("messages")
    private List<ClaudeMessage> messages;
    
    @JsonProperty("stream")
    private boolean stream;
    
    @JsonProperty("anthropic_version")
    private String anthropicVersion;
    
    public ClaudeRequest() {
        this.maxTokens = 1000;
        this.stream = false;
        this.anthropicVersion = "bedrock-2023-05-31";
    }
    
    public ClaudeRequest(String model, List<ClaudeMessage> messages) {
        this();
        this.model = model;
        this.messages = messages;
    }
    
    public String getModel() {
        return model;
    }
    
    public void setModel(String model) {
        this.model = model;
    }
    
    public int getMaxTokens() {
        return maxTokens;
    }
    
    public void setMaxTokens(int maxTokens) {
        this.maxTokens = maxTokens;
    }
    
    public List<ClaudeMessage> getMessages() {
        return messages;
    }
    
    public void setMessages(List<ClaudeMessage> messages) {
        this.messages = messages;
    }
    
    public boolean isStream() {
        return stream;
    }
    
    public void setStream(boolean stream) {
        this.stream = stream;
    }
    
    public String getAnthropicVersion() {
        return anthropicVersion;
    }
    
    public void setAnthropicVersion(String anthropicVersion) {
        this.anthropicVersion = anthropicVersion;
    }
}







