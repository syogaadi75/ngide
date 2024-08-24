const express = require('express'); 
const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 4000;


async function getBrowser() {
    return puppeteer.launch({
        args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(
            `https://github.com/Sparticuz/chromium/releases/download/v127.0.0/chromium-v127.0.0-pack.tar`
        ),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
    });
}

app.get('/', (req, res) => {
  res.send('Hello World');
});


app.get('/movies-images', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    // Luncurkan browser dengan chrome-aws-lambda
    const browser = await getBrowser(); 
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const imageSrcs = await page.evaluate(() => {
      const elements = document.querySelectorAll('.movies-list-wrap .tab-content .movies-list-full .ml-item img');
      return Array.from(elements).map(img => img.src);
    });

    await browser.close();
    res.json(imageSrcs);
  } catch (error) {
    console.error(error);
    res.status(500).send('Something went wrong');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
