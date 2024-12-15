const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const spellchecker = require('spellchecker');

const app = express();
const PORT = 5000;

app.use(express.json());
const cors = require('cors');
app.use(cors());

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

        // Check for spelling errors in text content
        const spellingErrors = [];
        $('p').each((_, el) => {
            const text = $(el).text();
            text.split(/\s+/).forEach((word) => {
                if (spellchecker.isMisspelled(word)) {
                    spellingErrors.push(word);
                }
            });
        });

        // Return results
        res.json({ linkStatuses, metaTags, spellingErrors });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching page content' });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
