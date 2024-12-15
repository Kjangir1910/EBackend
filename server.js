const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const spellchecker = require('spellchecker');
const { URL } = require('url');

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
const cors = require('cors');
app.use(cors());

// Endpoint: /check-links
app.post('/check-links', async (req, res) => {
    const { url } = req.body;

    try {
        // Fetch the HTML of the page
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Extract all links and meta tags
        const links = [];
        $('a').each((_, el) => {
            const link = $(el).attr('href');
            if (link) links.push(link);
        });

        const metaTags = [];
        $('meta').each((_, el) => {
            metaTags.push({
                name: $(el).attr('name') || $(el).attr('property'),
                content: $(el).attr('content'),
            });
        });

        // Check each link's status, redirect loop, and HTTPS
        const linkStatuses = await Promise.all(
            links.map(async (link) => {
                try {
                    const linkUrl = new URL(link, url).href; // Resolve relative links
                    const isHttps = linkUrl.startsWith('https://');
                    const redirectHistory = [];
                    let status;
                    let redirectLoop = false;

                    const response = await axios.get(linkUrl, {
                        maxRedirects: 5, // Limit redirects to detect loops
                        validateStatus: () => true, // Allow non-2xx statuses
                        onRedirect: (res) => {
                            if (redirectHistory.includes(res.headers.location)) {
                                redirectLoop = true;
                            } else {
                                redirectHistory.push(res.headers.location);
                            }
                        },
                    });
                    status = response.status;

                    return { link: linkUrl, status, isHttps, redirectLoop };
                } catch (error) {
                    return { link, status: error.response?.status || 'Error', isHttps: false, redirectLoop: false };
                }
            })
        );

        res.json({ linkStatuses, metaTags });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching page content' });
    }
});

// Endpoint: /check-spelling
app.post('/check-spelling', async (req, res) => {
    const { url } = req.body;

    try {
        // Launch Puppeteer to fetch webpage content
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Get text content from the page
        const textContent = await page.evaluate(() => {
            return document.body.innerText;
        });

        await browser.close();

        // Check for spelling errors
        const words = textContent.split(/\s+/); // Split text into words
        const spellingErrors = words.filter((word) => spellchecker.isMisspelled(word));

        res.json({ spellingErrors });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching or analyzing the page content' });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
