let allResources = [];
let selectedResources = new Set();

document.addEventListener('DOMContentLoaded', () => {
  const filterImages = document.getElementById('filter-images');
  const filterVideos = document.getElementById('filter-videos');
  const sortBy = document.getElementById('sort-by');
  const refreshBtn = document.getElementById('refresh-btn');
  const selectAll = document.getElementById('select-all');
  const downloadSelectedBtn = document.getElementById('download-selected-btn');
  const resourcesList = document.getElementById('resources-list');
  const noResources = document.getElementById('no-resources');
  const resourceCount = document.getElementById('resource-count');

  loadResources();

  filterImages.addEventListener('change', updateResourcesList);
  filterVideos.addEventListener('change', updateResourcesList);
  sortBy.addEventListener('change', updateResourcesList);
  refreshBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'scanPage' }, () => {
        loadResources();
      });
    });
  });

  selectAll.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.resource-checkbox input');
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
      const resourceId = checkbox.getAttribute('data-id');
      if (e.target.checked) {
        selectedResources.add(resourceId);
      } else {
        selectedResources.delete(resourceId);
      }
    });
    updateDownloadButton();
  });

  downloadSelectedBtn.addEventListener('click', downloadSelectedResources);
});

function loadResources() {
  chrome.runtime.sendMessage({ action: 'getResources' }, (response) => {
    if (response && response.resources) {
      allResources = response.resources;
      updateResourcesList();
    }
  });
}

function updateResourcesList() {
  const filterImages = document.getElementById('filter-images').checked;
  const filterVideos = document.getElementById('filter-videos').checked;
  const sortBy = document.getElementById('sort-by').value;
  const resourcesList = document.getElementById('resources-list');
  const noResources = document.getElementById('no-resources');
  const resourceCount = document.getElementById('resource-count');
  
  let filteredResources = allResources.filter(resource => {
    if (resource.type === 'image' && filterImages) return true;
    if (resource.type === 'video' && filterVideos) return true;
    return false;
  });
  
  filteredResources.sort((a, b) => {
    switch (sortBy) {
      case 'size-desc':
        return b.size - a.size;
      case 'size-asc':
        return a.size - b.size;
      case 'time-desc':
        return b.timestamp - a.timestamp;
      case 'time-asc':
        return a.timestamp - b.timestamp;
      default:
        return 0;
    }
  });
  
  if (filteredResources.length === 0) {
    resourcesList.innerHTML = '';
    noResources.style.display = 'block';
  } else {
    noResources.style.display = 'none';
    resourcesList.innerHTML = '';
    
    filteredResources.forEach((resource, index) => {
      const resourceItem = document.createElement('div');
      resourceItem.className = 'resource-item';
      
      const isSelected = selectedResources.has(resource.url);
      
      let thumbnailHtml = '';
      if (resource.type === 'image') {
        thumbnailHtml = `<img src="${resource.url}" class="thumbnail" alt="Thumbnail">`;
      } else {
        thumbnailHtml = `<div class="video-thumbnail"></div>`;
      }
      
      resourceItem.innerHTML = `
        <div class="resource-checkbox">
          <input type="checkbox" data-id="${resource.url}" ${isSelected ? 'checked' : ''}>
        </div>
        ${thumbnailHtml}
        <div class="resource-info">
          <div class="resource-name">${resource.filename}</div>
          <div class="resource-details">
            <span class="resource-type">${resource.contentType}</span>
            <span class="resource-size">${resource.sizeFormatted}</span>
          </div>
        </div>
        <div class="resource-download">
          <button class="download-btn" data-url="${resource.url}" data-filename="${resource.filename}">下载</button>
        </div>
      `;
      
      resourcesList.appendChild(resourceItem);
      
      const checkbox = resourceItem.querySelector('.resource-checkbox input');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedResources.add(resource.url);
        } else {
          selectedResources.delete(resource.url);
          document.getElementById('select-all').checked = false;
        }
        updateDownloadButton();
      });
      
      const downloadBtn = resourceItem.querySelector('.download-btn');
      downloadBtn.addEventListener('click', () => {
        downloadResource(resource);
      });
    });
  }
  
  resourceCount.textContent = filteredResources.length;
  
  updateSelectAllCheckbox();
  
  updateDownloadButton();
}

function updateSelectAllCheckbox() {
  const checkboxes = document.querySelectorAll('.resource-checkbox input');
  const selectAll = document.getElementById('select-all');
  
  if (checkboxes.length === 0) {
    selectAll.checked = false;
    selectAll.disabled = true;
  } else {
    selectAll.disabled = false;
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    selectAll.checked = allChecked;
  }
}

function updateDownloadButton() {
  const downloadSelectedBtn = document.getElementById('download-selected-btn');
  downloadSelectedBtn.disabled = selectedResources.size === 0;
}

function downloadResource(resource) {
  chrome.runtime.sendMessage({
    action: 'downloadResource',
    url: resource.url,
    filename: resource.filename
  });
}

function downloadSelectedResources() {
  const resources = allResources.filter(resource => selectedResources.has(resource.url));
  
  resources.forEach(resource => {
    chrome.runtime.sendMessage({
      action: 'downloadResource',
      url: resource.url,
      filename: resource.filename
    });
  });
}
