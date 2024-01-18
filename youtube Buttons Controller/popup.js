document.getElementById('nextButton').addEventListener('click', () => {
  browser.tabs.query({ url: "*://*.youtube.com/*" })
    .then(() => {
      browser.tabs.sendMessage(parseInt(localStorage.getItem("myCat")), { command: 'clickNextButton' });
    })
    .catch((error) => {
      console.error('Error querying active tab:', error);
    });
});

document.getElementById('stopButton').addEventListener('click',  () => {
  browser.tabs.query({ url: "*://*.youtube.com/*" })
    .then(() => {
      browser.tabs.sendMessage(parseInt(localStorage.getItem("myCat")), { command: 'clickStopButton' });
    })
    .catch((error) => {
      console.error('Error querying active tab:', error);
    });
});

document.getElementById('backButton').addEventListener('click', () => {
  browser.tabs.query({ url: "*://*.youtube.com/*" })
    .then(() => {
      browser.tabs.executeScript(parseInt(localStorage.getItem("myCat")), { code: 'history.back();' });
    })
    .catch((error) => {
      console.error('Error querying active tab:', error);
    });
});

document.getElementById('muteButton').addEventListener('click', () => {
  browser.tabs.query({ url: "*://*.youtube.com/*" })
    .then(() => {
      browser.tabs.sendMessage(parseInt(localStorage.getItem("myCat")), { command: 'clickMuteButton' });
    })
    .catch((error) => {
      console.error('Error querying active tab:', error);
    });
});


document.getElementById('getTabButton').addEventListener('click', async () => {
  corent_tab_id = await browser.tabs.query({ active: true });
  localStorage.setItem("myCat", corent_tab_id[0].id);
});



// In popup.js
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'Unmute (m)') {
    document.getElementById('muteButton').innerText = 'Unmute';
  }else if(message.action === 'Mute (m)'){
    document.getElementById('muteButton').innerText = 'mute';
  }
});

browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'Play (k)') {
    document.getElementById('stopButton').innerText = 'Stop';
    // Add your logic here to handle the mute button click in the popup
  }else if(message.action === 'Pause (k)'){
    document.getElementById('stopButton').innerText = 'Play';
  }
});