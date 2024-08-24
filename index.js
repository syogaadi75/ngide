const express = require('express');
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core')
const lpuppeteer = require('puppeteer')

const app = express();
const PORT = process.env.PORT || 4000;
const LOCAL_CHROME_EXECUTABLE = lpuppeteer.executablePath()

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
    const executablePath = await chromium.executablePath || LOCAL_CHROME_EXECUTABLE
    const browser = await puppeteer.launch({
      executablePath,
      args: chromium.args,
      headless: false,
    }) 

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
