const { _empty: empty } = require('playwright');
const path = require('path');

async function runTest() {
  console.log('Starting test...');
  const emptyApp = await empty.launch({
    args: ['--no-sandbox', '--disable-gpu'],
    executablePath: require('electron')
  });

  try {
    // Wait for first window
    const window = await emptyApp.firstWindow();
    console.log('✅ Window opened');

    // Wait a bit for app to fully initialize
    await new Promise(r => setTimeout(r, 3000));
    console.log('✅ App initialized');

    // Try to take a screenshot of the window
    const screenshot = await window.screenshot({ path: '/tmp/app-window.png' });
    console.log('✅ Screenshot taken: /tmp/app-window.png');

    // Check window title
    const title = await window.title();
    console.log(`Window title: ${title}`);

    // Test IPC communication - check if chat window exists
    const context = await window.context();

    // Get all window information via evaluate
    const windowInfo = await window.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        readyState: document.readyState,
        bodyContent: document.body.innerText?.substring(0, 200)
      };
    });

    console.log('Window Info:', windowInfo);

    // Try to find and interact with chat input
    const chatInput = await window.$('input[type="text"]') || await window.$('textarea');
    if (chatInput) {
      console.log('✅ Found text input');
      await chatInput.fill('What is a binary search tree?');
      console.log('✅ Typed message into chat');

      // Submit the message
      const submitBtn = await window.$('button[type="submit"]') || await window.$('button:has-text("Send")');
      if (submitBtn) {
        await submitBtn.click();
        console.log('✅ Clicked submit button');

        // Wait for response
        await new Promise(r => setTimeout(r, 2000));

        const responseScreenshot = await window.screenshot({ path: '/tmp/app-response.png' });
        console.log('✅ Response screenshot: /tmp/app-response.png');
      } else {
        console.log('⚠️  Could not find submit button');
      }
    } else {
      console.log('⚠️  Could not find text input');
      const allElements = await window.evaluate(() => {
        return Array.from(document.querySelectorAll('*'))
          .filter(el => el.tagName.match(/INPUT|TEXTAREA|BUTTON/))
          .map(el => `${el.tagName}: ${el.className} ${el.id}`)
          .slice(0, 10);
      });
      console.log('Available form elements:', allElements);
    }

    console.log('\n✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await emptyApp.close();
  }
}

runTest();
