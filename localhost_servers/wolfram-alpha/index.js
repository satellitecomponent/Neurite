import express from 'express';
import axios from 'axios';

const app = express();
const WOLFRAM_API_URL = 'https://api.wolframalpha.com/v2/query';

const MAX_ATTEMPTS = 5;

const getWolframAlphaResult = async (query, apiKey, attempt = 1) => {
    if (attempt > MAX_ATTEMPTS) {
        return { pods: [], message: "No result found after maximum attempts" };
    }

    const response = await axios.get(WOLFRAM_API_URL, {
        params: {
            input: query,
            format: "plaintext,image",
            output: "json",
            appid: apiKey,
        },
    });

    let data = response.data;

    let pods = [];
    if (data.queryresult && data.queryresult.success === false) {
        if (data.queryresult.didyoumeans && data.queryresult.didyoumeans.val) {
            const newQuery = data.queryresult.didyoumeans.val;
            console.log("Using DidYouMeans query:", newQuery);
            return await getWolframAlphaResult(newQuery, apiKey, attempt + 1);
        } else if (data.queryresult.assumptions && data.queryresult.assumptions.values) {
            const assumptions = data.queryresult.assumptions.values.map(value => value.desc);
            pods.push({
                title: "Assumptions",
                plaintexts: assumptions,
                images: [] // Add any images here if available
            });
        } else if (data.queryresult.examplepage && data.queryresult.examplepage.url) {
            pods.push({
                title: "Example Page",
                plaintexts: [data.queryresult.examplepage.url],
                images: [] // Add any images here if available
            });
        } else if (data.queryresult.timedout) {
            pods.push({
                title: "Timed Out",
                plaintexts: ["Request timed out"],
                images: [] // Add any images here if available
            });
        } else {
            // This is the 'Interpreting' pod.
            const interpreting = data.queryresult.pods[0].subpods[0].plaintext;
            pods.push({
                title: "Interpreting",
                plaintexts: [interpreting],
                images: [data.queryresult.pods[0].subpods[0].img.src]
            });
        }
    } else {
        // Convert all pods
        pods = data.queryresult.pods.map(pod => {
            return {
                title: pod.title,
                plaintexts: pod.subpods.map(subpod => subpod.plaintext),
                images: pod.subpods.map(subpod => subpod.img.src)
            };
        });
    }

    return { pods };
};

app.post("/", async (req, res) => {
    try {
        const query = req.body.query;
        const apiKey = req.body.apiKey;
        const data = await getWolframAlphaResult(query, apiKey);

        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching data from Wolfram Alpha API:", error.message);
        res.status(500).json({ error: "Error fetching data from Wolfram Alpha API" });
    }
});

export default app;
