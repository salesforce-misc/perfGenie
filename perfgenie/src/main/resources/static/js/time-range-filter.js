/**
 * Shows a time range filter popup with start and end timestamps
 * @param {number} startTimestamp - Start timestamp in epoch milliseconds
 * @param {number} endTimestamp - End timestamp in epoch milliseconds
 * @param {function} onApply - Callback function called when Apply is clicked, receives {start: number, end: number}
 * @param {function} onCancel - Optional callback function called when Cancel is clicked
 * @param {string} labelPrefix - Optional text to prepend to Start Time and End Time labels
 */
function showTimeRangeFilter(startTimestamp, endTimestamp, onApply, onCancel, labelPrefix) {
    // Validate inputs
    if (typeof startTimestamp !== 'number' || typeof endTimestamp !== 'number') {
        console.error('Invalid timestamps provided');
        return;
    }
    

    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'trf-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'trf-modal';
    modalContent.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        width: 100%;
        max-width: 400px;
        max-height: 90vh;
        overflow-y: auto;
        box-sizing: border-box;
    `;
    
    // Convert timestamps to date strings for input fields
    const startDate = new Date(startTimestamp);
    const endDate = new Date(endTimestamp);
    
    // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
    const formatForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    // Format date for display
    const formatForDisplay = (date) => {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };
    
    // Generate labels with optional prefix
    const startLabel = labelPrefix ? `${labelPrefix} Start Time:` : 'Start Time:';
    const endLabel = labelPrefix ? `${labelPrefix} End Time:` : 'End Time:';
    
    modalContent.innerHTML = `
        <div class="trf-field-container" style="margin-bottom: 20px;">
            <label class="trf-label" style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
                ${startLabel}
            </label>
            <input type="datetime-local" 
                   id="trf-start-input" 
                   class="trf-input"
                   value="${formatForInput(startDate)}"
                   style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
        
        <div class="trf-field-container" style="margin-bottom: 24px;">
            <label class="trf-label" style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
                ${endLabel}
            </label>
            <input type="datetime-local" 
                   id="trf-end-input" 
                   class="trf-input"
                   value="${formatForInput(endDate)}"
                   style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
        
        <div class="trf-button-container" style="display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
            <button id="trf-cancel-btn" 
                    class="trf-btn trf-btn-cancel"
                    style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: #666; border-radius: 4px; cursor: pointer; font-size: 14px; min-width: 80px; box-sizing: border-box;">
                Cancel
            </button>
            <button id="trf-apply-btn" 
                    class="trf-btn trf-btn-apply"
                    style="padding: 8px 16px; border: none; background: #0070d2; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; min-width: 80px; box-sizing: border-box;">
                Show timeseries
            </button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Get references to inputs
    const startInput = modalContent.querySelector('#trf-start-input');
    const endInput = modalContent.querySelector('#trf-end-input');
    const applyBtn = modalContent.querySelector('#trf-apply-btn');
    const cancelBtn = modalContent.querySelector('#trf-cancel-btn');
    
    // Validation function
    const validateInputs = () => {
        const startValue = startInput.value;
        const endValue = endInput.value;
        
        if (!startValue || !endValue) {
            alert('Please select both start and end times.');
            return false;
        }
        
        const startTime = new Date(startValue).getTime();
        const endTime = new Date(endValue).getTime();
        
        if (isNaN(startTime) || isNaN(endTime)) {
            alert('Invalid date format. Please check your input.');
            return false;
        }
        
        if (startTime >= endTime) {
            alert('Start time must be before end time.');
            return false;
        }
        
        return { start: startTime, end: endTime };
    };
    
    // Apply button click handler
    applyBtn.addEventListener('click', () => {
        const validation = validateInputs();
        if (validation) {
            // Remove modal
            document.body.removeChild(modalOverlay);
            
            // Call callback with epoch timestamps
            if (typeof onApply === 'function') {
                onApply(validation);
            }
        }
    });
    
    // Cancel button click handler
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
        
        if (typeof onCancel === 'function') {
            onCancel();
        }
    });
    
    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            document.body.removeChild(modalOverlay);
            
            if (typeof onCancel === 'function') {
                onCancel();
            }
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modalOverlay);
            document.removeEventListener('keydown', handleEscape);
            
            if (typeof onCancel === 'function') {
                onCancel();
            }
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Focus on first input
    setTimeout(() => startInput.focus(), 100);
}

// Test function
function testTimeRangeFilter() {
    console.log('=== Testing Time Range Filter ===');
    
    // Test case 1: Current time range (last 24 hours)
    console.log('\n1. Testing with last 24 hours:');
    const startTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    const endTime = Date.now(); // Now
    
    showTimeRangeFilter(startTime, endTime, 
        (result) => {
            console.log('✅ Test 1 - Apply clicked:');
            console.log('  Selected time range:', result);
            console.log('  Start epoch:', result.start);
            console.log('  End epoch:', result.end);
            console.log('  Start date:', new Date(result.start));
            console.log('  End date:', new Date(result.end));
            console.log('  Duration (hours):', (result.end - result.start) / (1000 * 60 * 60));
        },
        () => {
            console.log('❌ Test 1 - Cancelled');
        }
    );
}

// Test function for specific date range
function testSpecificDateRange() {
    console.log('\n=== Testing Specific Date Range ===');
    
    // Test case 2: Specific date range (January 1-15, 2024)
    console.log('\n2. Testing with specific date range (Jan 1-15, 2024):');
    const specificStart = new Date('2024-01-01T00:00:00').getTime();
    const specificEnd = new Date('2024-01-15T23:59:59').getTime();
    
    showTimeRangeFilter(specificStart, specificEnd, 
        (result) => {
            console.log('✅ Test 2 - Apply clicked:');
            console.log('  Selected time range:', result);
            console.log('  Start date:', new Date(result.start));
            console.log('  End date:', new Date(result.end));
            console.log('  Duration (days):', (result.end - result.start) / (1000 * 60 * 60 * 24));
        },
        () => {
            console.log('❌ Test 2 - Cancelled');
        }
    );
}

// Test function for edge cases
function testEdgeCases() {
    console.log('\n=== Testing Edge Cases ===');
    
    // Test case 3: Very short time range (1 minute)
    console.log('\n3. Testing with very short range (1 minute):');
    const shortStart = Date.now() - (60 * 1000); // 1 minute ago
    const shortEnd = Date.now(); // Now
    
    showTimeRangeFilter(shortStart, shortEnd, 
        (result) => {
            console.log('✅ Test 3 - Apply clicked:');
            console.log('  Selected time range:', result);
            console.log('  Duration (minutes):', (result.end - result.start) / (1000 * 60));
        },
        () => {
            console.log('❌ Test 3 - Cancelled');
        }
    );
}

// Test function for invalid inputs
function testInvalidInputs() {
    console.log('\n=== Testing Invalid Inputs ===');
    
    // Test case 4: Invalid timestamps (start > end)
    console.log('\n4. Testing with invalid timestamps (start > end):');
    const invalidStart = Date.now();
    const invalidEnd = Date.now() - (60 * 1000); // 1 minute before start
    
    showTimeRangeFilter(invalidStart, invalidEnd, 
        (result) => {
            console.log('❌ Test 4 - Should not reach here with invalid input');
        },
        () => {
            console.log('✅ Test 4 - Correctly handled invalid input');
        }
    );
}

// Test function for very long time range
function testLongTimeRange() {
    console.log('\n=== Testing Long Time Range ===');
    
    // Test case 5: Long time range (1 year)
    console.log('\n5. Testing with long range (1 year):');
    const longStart = Date.now() - (365 * 24 * 60 * 60 * 1000); // 1 year ago
    const longEnd = Date.now(); // Now
    
    showTimeRangeFilter(longStart, longEnd, 
        (result) => {
            console.log('✅ Test 5 - Apply clicked:');
            console.log('  Selected time range:', result);
            console.log('  Start date:', new Date(result.start));
            console.log('  End date:', new Date(result.end));
            console.log('  Duration (days):', (result.end - result.start) / (1000 * 60 * 60 * 24));
        },
        () => {
            console.log('❌ Test 5 - Cancelled');
        }
    );
}

// Run all tests
function runAllTests() {
    console.log('🚀 Starting Time Range Filter Tests...');
    
    // Run tests with delays to avoid overlapping modals
    testTimeRangeFilter();
    
    setTimeout(() => {
        testSpecificDateRange();
    }, 2000);
    
    setTimeout(() => {
        testEdgeCases();
    }, 4000);
    
    setTimeout(() => {
        testInvalidInputs();
    }, 6000);
    
    setTimeout(() => {
        testLongTimeRange();
    }, 8000);
    
    setTimeout(() => {
        console.log('\n🎉 All tests completed! Check the console for results.');
    }, 10000);
}

// Test function with label prefix
function testWithLabelPrefix() {
    console.log('\n=== Testing with Label Prefix ===');
    
    // Get current time and 1 hour ago
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    console.log('Testing with label prefix "Event":');
    console.log('Start:', new Date(hourAgo));
    console.log('End:', new Date(now));
    
    showTimeRangeFilter(hourAgo, now, 
        (result) => {
            console.log('✅ Label Prefix Test - Apply clicked:');
            console.log('  Selected time range:', result);
            console.log('  Start date:', new Date(result.start));
            console.log('  End date:', new Date(result.end));
            console.log('  Duration (hours):', (result.end - result.start) / (1000 * 60 * 60));
        },
        () => {
            console.log('❌ Label Prefix Test - Cancelled');
        },
        'Event' // Label prefix
    );
}

// Example usage and test runner
console.log('Time Range Filter loaded. Available functions:');
console.log('- testTimeRangeFilter() - Test with last 24 hours');
console.log('- testSpecificDateRange() - Test with specific dates');
console.log('- testEdgeCases() - Test with short time range');
console.log('- testInvalidInputs() - Test with invalid inputs');
console.log('- testLongTimeRange() - Test with long time range');
console.log('- testWithLabelPrefix() - Test with label prefix');
console.log('- runAllTests() - Run all tests with delays');
console.log('\nTo run a specific test, call the function name in the console.');
console.log('To run all tests, call: runAllTests()');

// Auto-run basic test if in browser environment
if (typeof window !== 'undefined') {
    console.log('\n🌐 Browser environment detected. You can run tests now!');
    console.log('Try: testTimeRangeFilter()');
}
