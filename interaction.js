const axios = require("axios");
const fs = require("fs");

const headers = {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9,hi;q=0.8,de;q=0.7",
    "content-type": "application/json",
    origin: "https://www.realcommercial.com.au",
    referer: "https://www.realcommercial.com.au/",
    "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
};

const endpoint =
    "https://api.realcommercial.com.au/listing-ui/nearby-searches";

async function fetchPage(page) {
    const { data } = await axios.post(
        endpoint,
        {
            channel: "buy",
            filters: {
                "within-radius": "includesurrounding",
                "surrounding-suburbs": true,
            },
            page,
            "page-size": 100,
        },
        { headers }
    );

    return data;
}

async function main() {
    try {
        console.log("Fetching first page...");

        let response = await fetchPage(1);

        const totalResults = response.availableResults || 0;
        const totalPages = Math.ceil(totalResults / 100);

        console.log(`Total Results: ${totalResults}`);
        console.log(`Total Pages: ${totalPages}`);

        const urls = [];

        // First page
        for (const item of response.listings || []) {
            if (item.pdpUrl) {
                urls.push(
                    new URL(item.pdpUrl, "https://www.realcommercial.com.au")
                        .href
                );
            }
        }

        // Remaining pages
        for (let page = 2; page <= totalPages; page++) {
            console.log(`Fetching page ${page}/${totalPages}`);

            response = await fetchPage(page);

            for (const item of response.listings || []) {
                if (item.pdpUrl) {
                    urls.push(
                        new URL(
                            item.pdpUrl,
                            "https://www.realcommercial.com.au"
                        ).href
                    );
                }
            }
        }

        console.log(`Collected ${urls.length} URLs`);

        fs.writeFileSync(
            "realcommercial_urls.json",
            JSON.stringify(urls, null, 2)
        );

        console.log("Saved to realcommercial_urls.json");
    } catch (err) {
        console.error(
            "Error:",
            err.response?.status,
            err.response?.data || err.message
        );
    }
}

main();