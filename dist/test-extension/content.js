console.log('Resource Sniffer content script loaded');

function detectResources() {
  const resources = [];
  
  const images = document.querySelectorAll('img');
  images.forEach((img, index) => {
    if (img.src) {
      resources.push({
        id: 'img_' + index,
        url: img.src,
        type: 'image',
        dimensions: `${img.naturalWidth}x${img.naturalHeight}`,
        size: 'Unknown',
        quality: 'Unknown'
      });
    }
  });
  
  const videos = document.querySelectorAll('video');
  videos.forEach((video, index) => {
    const sources = video.querySelectorAll('source');
    sources.forEach((source, sourceIndex) => {
      if (source.src) {
        resources.push({
          id: `video_${index}_${sourceIndex}`,
          url: source.src,
          type: 'video',
          dimensions: `${video.videoWidth}x${video.videoHeight}`,
          size: 'Unknown',
          quality: 'Unknown'
        });
      }
    });
  });
  
  chrome.runtime.sendMessage({
    action: 'addResources',
    resources: resources
  });
  
  return resources;
}

window.addEventListener('load', () => {
  detectResources();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'detectResources') {
    const resources = detectResources();
    sendResponse({ success: true, count: resources.length });
    return true;
  }
});
