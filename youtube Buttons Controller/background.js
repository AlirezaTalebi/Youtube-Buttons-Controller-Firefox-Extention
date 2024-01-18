// Background script
browser.browserAction.onClicked.addListener(async () => {
  let tabs = await browser.tabs.query({ url: "*://*.youtube.com/*" });
  let activeTab = tabs[1];

  browser.tabs.executeScript(activeTab.id, {
    file: "content.js"
  });
});


