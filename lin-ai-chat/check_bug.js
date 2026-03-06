import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

async function run() {
  console.log('Starting dev server...');
  const devServer = spawn('npm', ['run', 'dev'], { shell: true });
  
  let serverUrl = '';
  
  devServer.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    const match = output.match(/http:\/\/localhost:\d+/);
    if (match && !serverUrl) {
      serverUrl = match[0];
      console.log('Found server URL:', serverUrl);
      startBrowser(serverUrl);
    }
  });

  devServer.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  async function startBrowser(url) {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    console.log('Navigating to', url);
    await page.goto(url);
    
    console.log('Waiting 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Closing...');
    await browser.close();
    devServer.kill();
    process.exit(0);
  }
}

run();