/**
 * Modern Accordion Component - Reusable initialization function
 * 
 * @param {string} headerId - ID of the accordion header element
 * @param {string} contentId - ID of the accordion content element
 * @param {boolean} startExpanded - Whether to start expanded (default: false)
 */
function initModernAccordion(headerId, contentId, startExpanded) {
    const accordionHeader = document.getElementById(headerId);
    const accordionContent = document.getElementById(contentId);
    
    if (!accordionHeader || !accordionContent) {
        console.warn('Modern Accordion: Header or content element not found', { headerId, contentId });
        return;
    }
    
    // Remove existing listeners by cloning
    const newHeader = accordionHeader.cloneNode(true);
    accordionHeader.parentNode.replaceChild(newHeader, accordionHeader);
    
    // Set initial state
    if (startExpanded) {
        // Start expanded (active: true)
        accordionContent.classList.add('active');
        newHeader.classList.add('active');
        accordionContent.style.display = 'block';
        accordionContent.style.overflow = 'hidden';
        // Force reflow to ensure active class is applied
        accordionContent.offsetHeight;
        // Set height to auto after measuring
        const targetHeight = accordionContent.scrollHeight;
        accordionContent.style.height = targetHeight + 'px';
        // After a brief moment, set to auto for flexibility
        setTimeout(function() {
            if (accordionContent.classList.contains('active')) {
                accordionContent.style.height = 'auto';
            }
        }, 100);
    } else {
        // Start collapsed (active: false)
        accordionContent.classList.remove('active');
        newHeader.classList.remove('active');
        accordionContent.style.height = '0px';
        accordionContent.style.overflow = 'hidden';
        accordionContent.style.display = 'block'; // Keep it block for height transition
    }
    
    // Add click handler
    newHeader.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = accordionContent.classList.contains('active');
        
        if (isActive) {
            // Collapsing - smooth slide up (jQuery UI style)
            const startHeight = accordionContent.scrollHeight;
            accordionContent.style.height = startHeight + 'px';
            accordionContent.style.overflow = 'hidden';
            
            // Force reflow
            accordionContent.offsetHeight;
            
            // Remove active class and animate to 0
            accordionContent.classList.remove('active');
            newHeader.classList.remove('active');
            accordionContent.style.height = '0px';
            
            // Clean up after animation
            setTimeout(function() {
                if (!accordionContent.classList.contains('active')) {
                    accordionContent.style.height = '';
                    accordionContent.style.overflow = '';
                }
            }, 350);
            
            // Remove inline styles when closing - CSS will handle the default state
            newHeader.style.removeProperty('background');
            newHeader.style.removeProperty('background-image');
            newHeader.style.removeProperty('background-color');
            newHeader.style.removeProperty('color');
            newHeader.style.removeProperty('border');
            newHeader.style.removeProperty('border-radius');
            newHeader.style.removeProperty('box-shadow');
            newHeader.style.removeProperty('backdrop-filter');
            newHeader.style.removeProperty('-webkit-backdrop-filter');
            newHeader.style.removeProperty('text-shadow');
            newHeader.style.removeProperty('font-weight');
            newHeader.style.removeProperty('transform');
        } else {
            // Expanding - smooth slide down (jQuery UI style)
            accordionContent.style.display = 'block';
            accordionContent.style.overflow = 'hidden';
            accordionContent.style.height = '0px';
            accordionContent.classList.add('active');
            newHeader.classList.add('active');
            
            // Force reflow to ensure active class is applied
            accordionContent.offsetHeight;
            
            // Measure height with active class applied (padding included)
            const targetHeight = accordionContent.scrollHeight;
            
            // Animate smoothly to measured height
            accordionContent.style.height = targetHeight + 'px';
            
            // Clean up after animation completes
            setTimeout(function() {
                if (accordionContent.classList.contains('active')) {
                    accordionContent.style.height = 'auto';
                    accordionContent.style.overflow = '';
                }
            }, 350);
            
            // CSS will handle the glassmorphism styles via .active class
            // No need to set inline styles - let CSS take precedence
        }
    });
}

