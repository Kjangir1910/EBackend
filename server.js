const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const spellchecker = require('spellchecker');
const { URL } = require('url');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Endpoint 1: Check Links
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

        // Check each link's status, redirect loop, and HTTP/HTTPS
        const linkStatuses = await Promise.all(
            links.map(async (link) => {
                try {
                    const linkUrl = new URL(link, url).href; // Resolve relative links
                    const isHttps = linkUrl.startsWith('https://');
                    const redirectHistory = [];
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

                    return { link: linkUrl, status: response.status, isHttps, redirectLoop };
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

// Endpoint 2: Check Spelling
app.post('/check-spelling', async (req, res) => {
    const { url } = req.body;

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Extract text from paragraphs and check for spelling errors
        const spellingErrors = [];
        $('p').each((_, el) => {
            const text = $(el).text();
            text.split(/\s+/).forEach((word) => {
                if (spellchecker.isMisspelled(word)) {
                    spellingErrors.push(word);
                }
            });
        });

        res.json({ spellingErrors });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching page content' });
    }
});

// Catch-All for 404 Errors
app.use((req, res) => {
    res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.url}` });
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
