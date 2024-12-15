const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const spellchecker = require('spellchecker');
const { URL } = require('url');

const app = express();
const PORT = 5000;

app.use(express.json());
const cors = require('cors');
app.use(cors());

// Route for checking links and meta tags
app.post('/check-links', async (req, res) => {
    const { url } = req.body;

    try {
        // Fetch the HTML of the page
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Extract all links
        const links = [];
        $('a').each((_, el) => {
            const link = $(el).attr('href');
            if (link) links.push(link);
        });

        // Extract meta tags
        const metaTags = [];
        $('meta').each((_, el) => {
            metaTags.push({
                name: $(el).attr('name') || $(el).attr('property'),
                content: $(el).attr('content'),
            });
        });

        // Check link statuses
        const linkStatuses = await Promise.all(
            links.map(async (link) => {
                try {
                    const linkUrl = new URL(link, url).href; // Resolve relative links
                    const isHttps = linkUrl.startsWith('https://');
                    const response = await axios.get(linkUrl, { validateStatus: () => true });
                    return { link: linkUrl, status: response.status, isHttps, redirectLoop: false };
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

// Route for checking spelling errors
app.post('/check-spelling', async (req, res) => {
    const { url } = req.body;

    try {
        // Use Puppeteer to fetch rendered HTML
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Get the fully rendered HTML content
        const html = await page.content();
        const $ = cheerio.load(html);

        // Check spelling errors in <p> tags
        const spellingErrors = [];
        $('p').each((_, el) => {
            const text = $(el).text();
            text.split(' ').forEach(word => {
                const cleanedWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase(); // Normalize words
                if (cleanedWord && spellchecker.isMisspelled(cleanedWord)) {
                    spellingErrors.push(cleanedWord);
                }
            });
        });

        await browser.close();
        res.json({ spellingErrors });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching page content' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
