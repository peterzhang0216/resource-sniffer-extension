chrome.runtime.onInstalled.addListener(() => {
  console.log('Resource Sniffer Extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getResources') {
    sendResponse({
      success: true,
      resources: [
        {
          id: '1',
          url: 'https://picsum.photos/id/237/300/200',
          type: 'image',
          size: '15 KB',
          dimensions: '300x200',
          quality: 'high'
        },
        {
          id: '2',
          url: 'https://picsum.photos/id/1015/300/200',
          type: 'image',
          size: '18 KB',
          dimensions: '300x200',
          quality: 'high'
        },
        {
          id: '3',
          url: 'https://www.w3schools.com/html/mov_bbb.mp4',
          type: 'video',
          size: '1.2 MB',
          dimensions: '320x176',
          quality: 'medium'
        }
      ]
    });
    return true;
  }
});
