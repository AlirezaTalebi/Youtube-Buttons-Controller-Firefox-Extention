
function clickNextButton() {
  let nextButton = document.querySelector('.ytp-next-button');
  if (nextButton) {
    nextButton.click();
  }
}

function clickStopButton() {
  let stopButton = document.querySelector('.ytp-play-button');
  if (stopButton) {
    stop_button_title = stopButton['title'];
    browser.runtime.sendMessage({ action: stop_button_title });
    stopButton.click();
  }
}


function clickMuteButton() {
  let muteButton = document.querySelector('.ytp-mute-button');
  if (muteButton) {
    muteButton.click();
    mute_button_title = muteButton['title'];
    
    browser.runtime.sendMessage({ action: mute_button_title });
  }
}


browser.runtime.onMessage.addListener((message) => {
  if (message.command === 'clickNextButton') {
    clickNextButton();
  } else if (message.command === 'clickStopButton') {
    clickStopButton();
  }else if (message.command === 'clickMuteButton') {
    clickMuteButton();
  }
});
