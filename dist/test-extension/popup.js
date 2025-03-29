document.addEventListener('DOMContentLoaded', function() {
  console.log('Resource Sniffer popup loaded');
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTabId = tabs[0].id;
    
    loadResources(currentTabId);
    
    document.getElementById('refresh-btn').addEventListener('click', function() {
      loadResources(currentTabId, true);
    });
  });
  
  function loadResources(tabId, forceRefresh = false) {
    const resourcesContainer = document.getElementById('resources-container');
    resourcesContainer.innerHTML = '<div class="loading">Loading resources...</div>';
    
    chrome.runtime.sendMessage({action: 'getResources', tabId: tabId, forceRefresh: forceRefresh}, function(response) {
      if (chrome.runtime.lastError) {
        resourcesContainer.innerHTML = '<div class="error">Error loading resources</div>';
        console.error(chrome.runtime.lastError);
        return;
      }
      
      if (response && response.success) {
        const resources = response.resources || [];
        
        if (resources.length > 0) {
          displayResources(resources);
        } else {
          resourcesContainer.innerHTML = '<div class="no-resources">No resources detected on this page</div>';
        }
      } else {
        resourcesContainer.innerHTML = '<div class="error">Error loading resources</div>';
      }
    });
  }
  
  function displayResources(resources) {
    const resourcesContainer = document.getElementById('resources-container');
    resourcesContainer.innerHTML = '';
    
    resources.forEach(resource => {
      const resourceElement = document.createElement('div');
      resourceElement.className = 'resource-item';
      resourceElement.innerHTML = `
        <div class="resource-header">
          <div class="resource-name">${getFilenameFromUrl(resource.url)}</div>
          <div class="resource-type">${resource.type}</div>
        </div>
        <div class="resource-details">
          <div>Size: ${resource.size || 'Unknown'}</div>
          <div>Dimensions: ${resource.dimensions || 'Unknown'}</div>
          <div>Quality: ${resource.quality || 'Unknown'}</div>
        </div>
        <div class="resource-actions">
          <button class="preview-btn" data-url="${resource.url}">Preview</button>
          <button class="download-btn" data-url="${resource.url}">Download</button>
        </div>
      `;
      
      resourcesContainer.appendChild(resourceElement);
    });
    
    const previewButtons = document.querySelectorAll('.preview-btn');
    previewButtons.forEach(button => {
      button.addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        chrome.tabs.create({url: url});
      });
    });
    
    const downloadButtons = document.querySelectorAll('.download-btn');
    downloadButtons.forEach(button => {
      button.addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        chrome.downloads.download({url: url});
      });
    });
  }
  
  function getFilenameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || 'Unknown';
    } catch (e) {
      return 'Unknown';
    }
  }
});
