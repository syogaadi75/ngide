const express = require('express')
const chromium = require('@sparticuz/chromium-min')
const puppeteer = require('puppeteer-core')
const path = require('path')
const cors = require('cors')
const bodyParser = require('body-parser')
const axios = require('axios')
const cheerio = require('cheerio')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const PORT = process.env.PORT || 4000
const mainUrl = 'https://rebahinxxi.website'

function getOptions(url) {
  return {
    url: url,
    withCredentials: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
  }
}

app.use(cors())

async function getBrowser() {
  return puppeteer.launch({
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
    defaultViewport: chromium.defaultViewport,
    executablePath:
      process.env.NODE_ENV === 'production'
        ? await chromium.executablePath(`https://github.com/Sparticuz/chromium/releases/download/v127.0.0/chromium-v127.0.0-pack.tar`)
        : path.resolve('C:/Program Files/Google/Chrome/Application/chrome.exe'),
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  })
}

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.get('/api/v2/movies', async (req, res) => {
  try {
    // Fetch HTML data using axios
    const base = await axios.request(getOptions(mainUrl));
    
    // Load the HTML using cheerio
    const $ = cheerio.load(base.data);

    // Scrape the 'latest' movies data
    const latest = $('.movies-list-wrap.mlw-latestmovie .tab-content .movies-list-full .ml-item').map((index, element) => {
      const imgSrc = $(element).find('img').attr('src');
      const href = $(element).find('a[data-url]').attr('href');
      const quality = $(element).find('span.mli-quality').text();
      const rating = $(element).find('span.mli-rating').text().trim().replace(/^\D+/g, '');
      const duration = $(element).find('span.mli-durasi').text().trim().replace(/^\D+/g, '');
      const title = $(element).find('span.mli-info h2').text().trim();
      return { imgSrc, href, quality, rating, duration, title };
    }).get(); // `.get()` is used to convert cheerio object to array

    // Scrape the 'top view' movies data
    const topView = $('.movies-list-wrap.mlw-topview .tab-content .movies-list-full .ml-item').map((index, element) => {
      const imgSrc = $(element).find('img').attr('src');
      const href = $(element).find('a[data-url]').attr('href');
      const quality = $(element).find('span.mli-quality').text();
      const rating = $(element).find('span.mli-rating').text().trim().replace(/^\D+/g, '');
      const duration = $(element).find('span.mli-durasi').text().trim().replace(/^\D+/g, '');
      const title = $(element).find('span.mli-info h2').text().trim();
      return { imgSrc, href, quality, rating, duration, title };
    }).get();

    // Construct the data object to send as response
    const data = {
      latest,
      topView
    };

    // Send the scraped data as JSON response
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Something went wrong');
  }
});
app.get('/api/v2/detail-movie', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    // Fetch the page HTML using axios
    const response = await axios.request(getOptions(url));

    // Load the HTML into cheerio
    const $ = cheerio.load(response.data);

    // Extract the title
    const title = $('h3[itemprop="name"]').attr('content');

    // Extract the image source from background-image style
    const imgSrc = $('.thumb.mvic-thumb').css('background-image').slice(4, -1);

    // Extract the trailer URL
    const trailer = $('#iframe-trailer').attr('src');

    // Extract the rating
    const rating = {
      count: $('span[itemprop="ratingCount"]').attr('content'),
      value: $('span[itemprop="ratingValue"]').attr('content')
    };

    // Extract the synopsis
    const sinopsis = $('span[itemprop="reviewBody"] p').first().text().trim();

    // Extract right info (duration, qualities, release date, countries)
    let duration, qualities = [], release_date, countries = [];
    $('.mvic-desc .mvic-info .mvici-right p').each((i, el) => {
      if (i === 0) {
        duration = $(el).text().replace('Duration:', '').trim();
      } else if (i === 1) {
        $(el).find('span.quality a').each((index, q) => {
          qualities.push({
            name: $(q).text().trim(),
            href: $(q).attr('href')
          });
        });
      } else if (i === 2) {
        release_date = $(el).text().replace('Release Date:', '').trim();
      } else if (i === 3) {
        $(el).find('a').each((index, c) => {
          countries.push({
            name: $(c).text().trim(),
            href: $(c).attr('href')
          });
        });
      }
    });

    // Extract left info (genres, actors, directors)
    let genres = [], actors = [], directors = [];
    $('.mvic-desc .mvic-info .mvici-left p').each((i, el) => {
      if (i === 0) {
        $(el).find('a').each((index, g) => {
          genres.push({
            name: $(g).find('span[itemprop="genre"]').text().trim(),
            href: $(g).attr('href')
          });
        });
      } else if (i === 1) {
        $(el).find('span[itemprop="actor"] a').each((index, a) => {
          actors.push({
            name: $(a).find('span[itemprop="name"]').text().trim(),
            href: $(a).attr('href')
          });
        });
      } else if (i === 2) {
        $(el).find('span[itemprop="director"] a').each((index, d) => {
          directors.push({
            name: $(d).find('span[itemprop="name"]').text().trim(),
            href: $(d).attr('href')
          });
        });
      }
    });

    // Extract additional link (e.g. for the movie)
    const href = $('#mv-info a[title]').attr('href');

    // Construct the data object
    const data = {
      title,
      imgSrc,
      trailer,
      href,
      rating,
      sinopsis,
      duration,
      qualities,
      release_date,
      countries,
      genres,
      actors,
      directors
    };

    // Send the data as a JSON response
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Something went wrong');
  }
});
app.get('/api/v2/watch-movie', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    // Fetch the page HTML using axios
    const response = await axios.request(getOptions(url));

    // Load the HTML into cheerio
    const $ = cheerio.load(response.data);

    // Extract the video source

    const videoSrc = $('#iframe-embed').attr('src');
    console.log($('#colimedia').html(), 'df')

    // Extract the title
    const title = $('.mvic-info .mvic-tagline2 h3').text().trim();

    // Extract the servers
    const servers = $('#server-list .server-wrapper').map((index, server) => {
      const iframeSrc = $(server).find('.server').attr('data-iframe');
      const description = $(server).find('.server-title small').text().trim();
      return { description, src: iframeSrc };
    }).get();

    // Extract the rating
    const rating = {
      count: $('label#movie-rating').text().replace('Rating', '').replace('(', '').replace(')', '').trim(),
      value: $('#movie-mark').text().trim()
    };

    // Extract the sinopsis
    const sinopsis = $('.desc-des-pendek[itemprop="description"] p').first().text().trim();

    // Extract the actors
    const actors = $('span[itemprop="actor"] a').map((index, actor) => {
      return {
        name: $(actor).find('span[itemprop="name"]').text().trim(),
        href: $(actor).attr('href')
      };
    }).get();

    // Extract the directors
    const directors = $('span[itemprop="director"] a').map((index, director) => {
      return {
        name: $(director).find('span[itemprop="name"]').text().trim(),
        href: $(director).attr('href')
      };
    }).get();

    // Extract the episodes
    let eps = { isEps: false };
    const epsContainer = $('#list-eps a');
    if (epsContainer.length > 0) {
      eps.isEps = true;
      eps.data = epsContainer.map((index, ep) => {
        const src = $(ep).attr('data-iframe');
        const number = $(ep).text().trim();
        return { src, number };
      }).get();
    }

    // Construct the data object
    const data = {
      title,
      mainServer: videoSrc,
      servers,
      rating,
      sinopsis,
      actors,
      directors,
      eps
    };

    // Send the data as a JSON response
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Something went wrong');
  }
});
app.post('/api/v2/search-movies', async (req, res) => {
  const movie = req.body.movie;
  const theLast = req.body.last;
  const theFirst = req.body.first;
  const page = req.body.page;

  let url = `${mainUrl}/?s=${movie.replaceAll(' ', '+')}`;

  if (theLast) {
    url = theLast;
  }

  if (theFirst) {
    url = theFirst;
  }

  if (page) {
    url = `${mainUrl}/page/${page}/?s=${movie.replaceAll(' ', '+')}`;
  }

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    // Fetch the page HTML using axios
    const response = await axios.request(getOptions(url));

    // Load the HTML into cheerio
    const $ = cheerio.load(response.data);

    // Extract the movies
    const movies = $('#featured .ml-item').map((i, movie) => {
      const imgSrc = $(movie).find('img').attr('src');
      const href = $(movie).find('a[data-url]').attr('href');
      const quality = $(movie).find('span.mli-quality').text().trim();
      const rating = $(movie).find('span.mli-rating').text().trim().replace(/^\D+/g, '');
      const duration = $(movie).find('span.mli-durasi').text().trim().replace(/^\D+/g, '');
      const title = $(movie).find('span.mli-info h2').text().trim();
      
      let episode = {
        isEpisode: false,
        episode: 0,
        status: ''
      };
      
      const isEpisode = $(movie).find('.mli-eps');
      if (isEpisode.length > 0) {
        const epsText = isEpisode.find('span').text();
        const eps = epsText.split(' ')[0];
        const st = epsText.split(' ')[1];
        episode = {
          isEpisode: true,
          episode: eps,
          status: st === 'ON' ? 'On Going' : 'Completed'
        };
      }

      return { imgSrc, href, quality, rating, duration, title, episode };
    }).get();

    // Extract the pagination
    let pagination = {};
    const paginationContainer = $('#pagination ul.pagination li');
    
    if (paginationContainer.length > 0) {
      const currentPage = parseInt($('#pagination li.active a').text().trim());
      let count = 1;
      let isNext = false;
      let isPrev = false;
      let first = { status: false, href: null };
      let last = { status: false, href: null };
      let startPage = 0;
      let startIndex = 0;

      paginationContainer.each((i, el) => {
        const firstContent = $(el).find('a').text();
        if (firstContent.includes('First')) {
          startIndex++;
          first = { status: true, href: $(el).find('a').attr('href') };
        }

        if ($(el).find('a').text().includes('Prev')) {
          startIndex++;
          isPrev = true;
        }

        if (i === startIndex) {
          startPage = currentPage === 1 ? 1 : parseInt($(el).find('a').text());
        }

        if ($(el).find('a.page').length) {
          count++;
        }

        if ($(el).find('a').text().includes('Next')) {
          isNext = true;
        }

        if (firstContent.includes('Last')) {
          last = { status: true, href: $(el).find('a').attr('href') };
        }
      });

      pagination = {
        currentPage,
        startPage,
        count,
        isNext,
        isPrev,
        first,
        last
      };
    }

    // Return movies and pagination
    res.json({ pagination, movies });
  } catch (error) {
    console.error(error);
    res.status(500).send('Something went wrong');
  }
});
app.post('/api/v2/list-movies', async (req, res) => {
  const theLast = req.body.last;
  const theFirst = req.body.first;
  const page = req.body.page;

  let url = `${mainUrl}/movies`;

  if (theLast) {
    url = theLast;
  }

  if (theFirst) {
    url = theFirst;
  }

  if (page) {
    url = `${mainUrl}/movies/page/${page}`;
  }

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    // Fetch the page HTML using axios
    const response = await axios.request(getOptions(url));

    // Load the HTML into cheerio
    const $ = cheerio.load(response.data);

    // Extract the movies
    const movies = $('#featured .ml-item').map((i, movie) => {
      const imgSrc = $(movie).find('img').attr('src');
      const href = $(movie).find('a[data-url]').attr('href');
      const quality = $(movie).find('span.mli-quality').text().trim();
      const rating = $(movie).find('span.mli-rating').text().trim().replace(/^\D+/g, '');
      const duration = $(movie).find('span.mli-durasi').text().trim().replace(/^\D+/g, '');
      const title = $(movie).find('span.mli-info h2').text().trim();
      
      let episode = {
        isEpisode: false,
        episode: 0,
        status: ''
      };
      
      const isEpisode = $(movie).find('.mli-eps');
      if (isEpisode.length > 0) {
        const epsText = isEpisode.find('span').text();
        const eps = epsText.split(' ')[0];
        const st = epsText.split(' ')[1];
        episode = {
          isEpisode: true,
          episode: eps,
          status: st === 'ON' ? 'On Going' : 'Completed'
        };
      }

      return { imgSrc, href, quality, rating, duration, title, episode };
    }).get();

    // Extract the pagination
    let pagination = {};
    const paginationContainer = $('#pagination ul.pagination li');
    
    if (paginationContainer.length > 0) {
      const currentPage = parseInt($('#pagination li.active a').text().trim());
      let count = 1;
      let isNext = false;
      let isPrev = false;
      let first = { status: false, href: null };
      let last = { status: false, href: null };
      let startPage = 0;
      let startIndex = 0;

      paginationContainer.each((i, el) => {
        const firstContent = $(el).find('a').text();
        if (firstContent.includes('First')) {
          startIndex++;
          first = { status: true, href: $(el).find('a').attr('href') };
        }

        if ($(el).find('a').text().includes('Prev')) {
          startIndex++;
          isPrev = true;
        }

        if (i === startIndex) {
          startPage = currentPage === 1 ? 1 : parseInt($(el).find('a').text());
        }

        if ($(el).find('a.page').length) {
          count++;
        }

        if ($(el).find('a').text().includes('Next')) {
          isNext = true;
        }

        if ($(el).find('a').text().includes('Last')) {
          last = { status: true, href: $(el).find('a').attr('href') };
        }
      });

      pagination = {
        currentPage,
        startPage,
        count,
        isNext,
        isPrev,
        first,
        last
      };
    }

    // Return movies and pagination
    res.json({ pagination, movies });
  } catch (error) {
    console.error(error);
    res.status(500).send('Something went wrong');
  }
});


app.get('/api/movies', async (req, res) => {
  const url = mainUrl

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'script'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    await page.goto(url, { waitUntil: 'networkidle2' })

    const latest = await page.evaluate(() => {
      const items = document.querySelectorAll('.movies-list-wrap.mlw-latestmovie .tab-content .movies-list-full .ml-item')
      return Array.from(items).map((item) => {
        const imgSrc = item.querySelector('img').src
        const aTag = item.querySelector('a[data-url]')
        const href = aTag ? aTag.href : null
        const qualitySpan = item.querySelector('span.mli-quality')
        const quality = qualitySpan ? qualitySpan.innerText : null
        const ratingSpan = item.querySelector('span.mli-rating')
        const rating = ratingSpan ? ratingSpan.textContent.trim().replace(/^\D+/g, '') : null
        const durationSpan = item.querySelector('span.mli-durasi')
        const duration = durationSpan ? durationSpan.textContent.trim().replace(/^\D+/g, '') : null
        const titleH2 = item.querySelector('span.mli-info h2')
        const title = titleH2 ? titleH2.textContent.trim() : null
        return { imgSrc, href, quality, rating, duration, title }
      })
    })
    const topView = await page.evaluate(() => {
      const items = document.querySelectorAll('.movies-list-wrap.mlw-topview .tab-content .movies-list-full .ml-item')
      return Array.from(items).map((item) => {
        const imgSrc = item.querySelector('img').src
        const aTag = item.querySelector('a[data-url]')
        const href = aTag ? aTag.href : null
        const qualitySpan = item.querySelector('span.mli-quality')
        const quality = qualitySpan ? qualitySpan.innerText : null
        const ratingSpan = item.querySelector('span.mli-rating')
        const rating = ratingSpan ? ratingSpan.textContent.trim().replace(/^\D+/g, '') : null
        const durationSpan = item.querySelector('span.mli-durasi')
        const duration = durationSpan ? durationSpan.textContent.trim().replace(/^\D+/g, '') : null
        const titleH2 = item.querySelector('span.mli-info h2')
        const title = titleH2 ? titleH2.textContent.trim() : null
        return { imgSrc, href, quality, rating, duration, title }
      })
    })

    const data = {
      latest,
      topView
    }

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.get('/api/detail-movie', async (req, res) => {
  const url = req.query.url

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {
      const titleContainer = document.querySelector('h3[itemprop="name"]')
      const title = titleContainer ? titleContainer.getAttribute('content') : null
      const thumbElement = document.querySelector('.thumb.mvic-thumb')
      const style = window.getComputedStyle(thumbElement)
      const backgroundImage = style.getPropertyValue('background-image')
      const imgSrc = backgroundImage.slice(5, -2)

      const trailer = document.querySelector('#iframe-trailer').getAttribute('src')

      const rating = {
        count: document.querySelector('span[itemprop="ratingCount"]').getAttribute('content'),
        value: document.querySelector('span[itemprop="ratingValue"]').getAttribute('content')
      }

      const sinopsisContainer = document.querySelectorAll('span[itemprop="reviewBody"] p')
      let sinopsis
      Array.from(sinopsisContainer).map((s, i) => {
        if (i === 0) {
          sinopsis = s.textContent.trim()
        }
        return s.textContent.trim()
      })

      const rightInfo = document.querySelectorAll('.mvic-desc .mvic-info .mvici-right p')
      let duration, qualities, release_date, countries
      rightInfo.forEach((el, i) => {
        if (i === 0) {
          duration = el.textContent.replace('Duration:', '').trim()
        } else if (i === 1) {
          const qualitiesContainer = el.querySelectorAll('span.quality a')
          qualities = Array.from(qualitiesContainer).map((q) => {
            return {
              name: q.textContent.trim(),
              href: q.getAttribute('href')
            }
          })
        } else if (i === 2) {
          release_date = el.textContent.replace('Release Date:', '').trim()
        } else if (i === 3) {
          const countriesContainer = el.querySelectorAll('a')
          countries = Array.from(countriesContainer).map((c) => {
            return {
              name: c.textContent.trim(),
              href: c.getAttribute('href')
            }
          })
        }
      })

      const info = document.querySelectorAll('.mvic-desc .mvic-info .mvici-left p')
      let genres = []
      let actors = []
      let directors = []

      info.forEach((i, index) => {
        if (index === 0) {
          const genresContainer = i.querySelectorAll('a')
          genres = Array.from(genresContainer).map((g) => {
            return {
              name: g.querySelector('span[itemprop="genre"]').textContent.trim(),
              href: g.getAttribute('href')
            }
          })
        } else if (index === 1) {
          const actorsContainer = i.querySelectorAll('span[itemprop="actor"] a')
          actors = Array.from(actorsContainer).map((a) => {
            return {
              name: a.querySelector('span[itemprop="name"]').textContent.trim(),
              href: a.getAttribute('href')
            }
          })
        } else if (index === 2) {
          const directorsContainer = i.querySelectorAll('span[itemprop="director"] a')
          directors = Array.from(directorsContainer).map((d) => {
            return {
              name: d.querySelector('span[itemprop="name"]').textContent.trim(),
              href: d.getAttribute('href')
            }
          })
        }
      })

      const hrefContainer = document.querySelector('#mv-info a[title]')
      const href = hrefContainer ? hrefContainer.getAttribute('href') : null

      return { title, imgSrc, trailer, href, rating, sinopsis, duration, qualities, release_date, countries, genres, actors, directors }
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.get('/api/watch-movie', async (req, res) => {
  const url = req.query.url

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {
      const videoSrcContainer = document.querySelector('#iframe-embed')
      const videoSrc = videoSrcContainer ? videoSrcContainer.getAttribute('src') : null

      const titleContainer = document.querySelector('.mvic-info .mvic-tagline2 h3')
      const title = titleContainer ? titleContainer.textContent.trim() : null

      const serversContainer = document.querySelectorAll('#server-list .server-wrapper')
      const servers = Array.from(serversContainer).map((server) => {
        const iframeContainer = server.querySelector('.server')
        const iframeSrc = iframeContainer ? iframeContainer.getAttribute('data-iframe') : null

        const descriptionContainer = server.querySelector('.server-title small')
        const description = descriptionContainer ? descriptionContainer.textContent.trim() : null
        return { description, src: iframeSrc }
      })

      const rating = {
        count: document.querySelector('label#movie-rating').textContent.replace('Rating', '').replace('(', '').replace(')', '').trim(),
        value: document.querySelector('#movie-mark').textContent.trim()
      }

      const sinopsisContainer = document.querySelectorAll('.desc-des-pendek[itemprop="description"] p')
      let sinopsis
      sinopsisContainer.forEach((el, i) => {
        if (i === 0) {
          sinopsis = el.textContent.trim()
        }
      })

      const actorsContainer = document.querySelectorAll('span[itemprop="actor"] a')
      let actors = Array.from(actorsContainer).map((d) => {
        return {
          name: d.querySelector('span[itemprop="name"]').textContent.trim(),
          href: d.getAttribute('href')
        }
      })

      const directorsContainer = document.querySelectorAll('span[itemprop="director"] a')
      let directors = Array.from(directorsContainer).map((d) => {
        return {
          name: d.querySelector('span[itemprop="name"]').textContent.trim(),
          href: d.getAttribute('href')
        }
      })

      const epsContainer = document.querySelectorAll('#list-eps a')
      let eps = {
        isEps: false
      }
      if(epsContainer.length > 0) {
        eps.isEps = true
        eps.data = Array.from(epsContainer).map((ep) => {
          const src =  ep.getAttribute('data-iframe')
          const number = ep.textContent.trim()
          return { src, number }
        })
      }

      return { title, mainServer: videoSrc, servers, rating, sinopsis, actors, directors, eps }
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.post('/api/search-movies', async (req, res) => {
  const movie = req.body.movie
  const theLast = req.body.last
  const theFirst = req.body.first
  const page = req.body.page

  let url = `${mainUrl}/?s=${movie.replaceAll(' ', '+')}`

  if (theLast) {
    url = theLast
  }

  if (theFirst) {
    url = theFirst
  }

  if (page) {
    url = `${mainUrl}/page/${page}/?s=${movie.replaceAll(' ', '+')}`
  }

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {
      const moviesContainer = document.querySelectorAll('#featured .ml-item')
      if (document.querySelector('#featured h3')?.textContent) {
        return { movies: [], pagination: {} }
      }

      const movies = Array.from(moviesContainer).map((movie) => {
        const imgSrc = movie.querySelector('img').src
        const aTag = movie.querySelector('a[data-url]')
        const href = aTag ? aTag.href : null
        const qualitySpan = movie.querySelector('span.mli-quality')
        const quality = qualitySpan ? qualitySpan.innerText : null
        const ratingSpan = movie.querySelector('span.mli-rating')
        const rating = ratingSpan ? ratingSpan.textContent.trim().replace(/^\D+/g, '') : null
        const durationSpan = movie.querySelector('span.mli-durasi')
        const duration = durationSpan ? durationSpan.textContent.trim().replace(/^\D+/g, '') : null
        const titleH2 = movie.querySelector('span.mli-info h2')
        const title = titleH2 ? titleH2.textContent.trim() : null
        let episode = {
          isEpisode: false,
          episode: 0,
          status: ''
        }
        const isEpisode = movie.querySelector('.mli-eps')
        if (isEpisode) {
          const epsText = isEpisode.querySelector('span').textContent
          const eps = epsText.split(' ')[0]
          const st = epsText.split(' ')[1]
          episode = {
            isEpisode: true,
            episode: eps,
            status: st == 'ON' ? 'On Going' : 'Completed'
          }
        }
        return { imgSrc, href, quality, rating, duration, title, episode }
      })

      if (!document.querySelector('#pagination ul.pagination')) {
        return { movies, pagination: {} }
      }
      const paginationContainer = document.querySelectorAll('#pagination ul.pagination li')
      let currentPage = parseInt(document.querySelector('#pagination li.active a').textContent)
      let count = 1
      let isNext = false
      let isPrev = false
      let first = {
        status: false,
        href: null
      }
      let last = {
        status: false,
        href: null
      }
      let startPage = 0
      let startIndex = 0
      paginationContainer.forEach((el, i) => {
        const firstContent = el.querySelector('a')
        if (firstContent.textContent.includes('First')) {
          startIndex++
          first = {
            status: true,
            href: firstContent.href
          }
        }
        const prev = el.querySelector('a').textContent.includes('Prev')
        if (prev) {
          startIndex++
          isPrev = true
        }

        if (i === startIndex) {
          if (currentPage === 1) {
            startPage = 1
          } else {
            startPage = parseInt(el.querySelector('a').textContent)
          }
        }

        const aTag = el.querySelector('a.page')
        if (aTag) {
          count++
        }
        const next = el.querySelector('a').textContent.includes('Next')
        if (next) {
          isNext = true
        }
        const lastContent = el.querySelector('a')
        if (lastContent.textContent.includes('Last')) {
          last = {
            status: true,
            href: lastContent.href
          }
        }
      })

      const pagination = {
        currentPage,
        startPage,
        count,
        isNext,
        isPrev,
        first,
        last
      }

      return { pagination, movies }
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.post('/api/list-movies', async (req, res) => {
  const theLast = req.body.last
  const theFirst = req.body.first
  const page = req.body.page

  let url = `${mainUrl}/movies`

  if (theLast) {
    url = theLast
  }

  if (theFirst) {
    url = theFirst
  }

  if (page) {
    url = `${mainUrl}/movies/page/${page}`
  }

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {
      const moviesContainer = document.querySelectorAll('#featured .ml-item')
      const movies = Array.from(moviesContainer).map((movie) => {
        const imgSrc = movie.querySelector('img').src
        const aTag = movie.querySelector('a[data-url]')
        const href = aTag ? aTag.href : null
        const qualitySpan = movie.querySelector('span.mli-quality')
        const quality = qualitySpan ? qualitySpan.innerText : null
        const ratingSpan = movie.querySelector('span.mli-rating')
        const rating = ratingSpan ? ratingSpan.textContent.trim().replace(/^\D+/g, '') : null
        const durationSpan = movie.querySelector('span.mli-durasi')
        const duration = durationSpan ? durationSpan.textContent.trim().replace(/^\D+/g, '') : null
        const titleH2 = movie.querySelector('span.mli-info h2')
        const title = titleH2 ? titleH2.textContent.trim() : null
        let episode = {
          isEpisode: false,
          episode: 0,
          status: ''
        }
        const isEpisode = movie.querySelector('.mli-eps')
        if (isEpisode) {
          const epsText = isEpisode.querySelector('span').textContent
          const eps = epsText.split(' ')[0]
          const st = epsText.split(' ')[1]
          episode = {
            isEpisode: true,
            episode: eps,
            status: st == 'ON' ? 'On Going' : 'Completed'
          }
        }
        return { imgSrc, href, quality, rating, duration, title, episode }
      })

      const paginationContainer = document.querySelectorAll('#pagination ul.pagination li')
      let currentPage = parseInt(document.querySelector('#pagination li.active a').textContent)
      let count = 1
      let isNext = false
      let isPrev = false
      let first = {
        status: false,
        href: null
      }
      let last = {
        status: false,
        href: null
      }
      let startPage = 0
      let startIndex = 0
      paginationContainer.forEach((el, i) => {
        const firstContent = el.querySelector('a')
        if (firstContent.textContent.includes('First')) {
          startIndex++
          first = {
            status: true,
            href: firstContent.href
          }
        }
        const prev = el.querySelector('a').textContent.includes('Prev')
        if (prev) {
          startIndex++
          isPrev = true
        }

        if (i === startIndex) {
          if (currentPage === 1) {
            startPage = 1
          } else {
            startPage = parseInt(el.querySelector('a').textContent)
          }
        }

        const aTag = el.querySelector('a.page')
        if (aTag) {
          count++
        }
        const next = el.querySelector('a').textContent.includes('Next')
        if (next) {
          isNext = true
        }
        const lastContent = el.querySelector('a')
        if (lastContent.textContent.includes('Last')) {
          last = {
            status: true,
            href: lastContent.href
          }
        }
      })

      const pagination = {
        currentPage,
        startPage,
        count,
        isNext,
        isPrev,
        first,
        last
      }

      return { pagination, movies }
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
