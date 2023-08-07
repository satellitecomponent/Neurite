
function getTokenCount(messages) {
    let tokenCount = 0;
    messages.forEach(message => {
        // match words, numbers, punctuations and whitespace
        let tokens = message.content.match(/[\w]+|[^\s\w]/g);
        if (tokens !== null) {
            tokenCount += tokens.length;
        }
    });
    return tokenCount;
}

const maxContextSizeSlider = document.getElementById("max-context-size-slider");
const maxContextSizeDisplay = document.getElementById("max-context-size-display");

// Display the default slider value
maxContextSizeDisplay.innerHTML = maxContextSizeSlider.value;

// Update the current slider value (each time you drag the slider handle)
maxContextSizeSlider.oninput = function () {
    maxContextSizeDisplay.innerHTML = this.value;
}

function getLastPromptsAndResponses(count, maxTokens, textareaId = "note-input") {
    const lines = document.getElementById(textareaId).value.split("\n");
    const promptsAndResponses = [];
    let promptCount = 0;
    let tokenCount = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith(`${PROMPT_IDENTIFIER}`)) {
            promptCount++;
        }
        if (promptCount > count) {
            break;
        }
        tokenCount += lines[i].split(/\s+/).length;
        promptsAndResponses.unshift(lines[i]);
    }

    while (tokenCount > maxTokens) {
        const removedLine = promptsAndResponses.shift();
        tokenCount -= removedLine.split(/\s+/).length;
    }

    const lastPromptsAndResponses = promptsAndResponses.join("\n") + "\n";
    // console.log("Last prompts and responses:", lastPromptsAndResponses);
    return lastPromptsAndResponses;
}

let aiResponding = false;
let latestUserMessage = null;
let controller = new AbortController();
let shouldContinue = true;

function removeLastResponse() {
    const noteInput = document.getElementById("note-input");
    const lines = noteInput.value.split("\n");

    // Find the index of the last "Prompt:"
    let lastPromptIndex = lines.length - 1;
    while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith(`${PROMPT_IDENTIFIER}`)) {
        lastPromptIndex--;
    }

    // Remove all lines from the last "Prompt:" to the end
    if (lastPromptIndex >= 0) {
        lines.splice(lastPromptIndex, lines.length - lastPromptIndex);
        noteInput.value = lines.join("\n");

        // Update the CodeMirror instance with the new value
        myCodeMirror.setValue(noteInput.value);
    }
}

function haltResponse() {
    if (aiResponding) {
        // AI is responding, so we want to stop it
        controller.abort();
        aiResponding = false;
        shouldContinue = false;
        document.getElementById("regen-button").textContent = "\u21BA";
        document.getElementById("prompt").value = latestUserMessage; // Add the last user message to the prompt input
    }
}

function regenerateResponse() {
    if (!aiResponding) {
        // AI is not responding, so we want to regenerate
        removeLastResponse(); // Remove the last AI response
        document.getElementById("prompt").value = latestUserMessage; // Restore the last user message into the input prompt
        document.getElementById("regen-button").textContent = "\u21BA";

    }
}

document.getElementById("regen-button").addEventListener("click", function () {
    if (aiResponding) {
        haltResponse();
    } else {
        regenerateResponse();
    }
});

function checkOtherModel(selectElement) {
    var modelInput = document.getElementById('model-input');
    if (selectElement.value === 'other') {
        // If 'Other...' is selected, show the text input field
        modelInput.style.display = 'inline';
    } else {
        // Otherwise, hide the text input field and clear its value
        modelInput.style.display = 'none';
        modelInput.value = '';
    }
}

document.getElementById('max-tokens-slider').addEventListener('input', function (e) {
    document.getElementById('max-tokens-display').innerText = e.target.value;
});

let failCounter = 0;
const MAX_FAILS = 2;

async function callChatGPTApi(messages, stream = false) {
    // Reset shouldContinue
    shouldContinue = true;

    // Update aiResponding and the button
    aiResponding = true;
    document.getElementById("regen-button").textContent = '\u275A\u275A'; // Double Vertical Bar unicode

    // Show loading icon
    document.getElementById("aiLoadingIcon").style.display = 'block';

    // Hide error icon in case it was previously shown
    document.getElementById("aiErrorIcon").style.display = 'none';

    console.log("Messages sent to API:", messages);
    console.log("Token count for messages:", getTokenCount(messages));

    //const localLLMCheckbox = document.getElementById('localLLM');

    //if (localLLMCheckbox.checked) {
    // Use local LLM
    //try {
    //const aiResponse = await callWebLLMGeneric(messages);
    //return aiResponse;
    //} catch (error) {
    //console.error("Error calling local LLM:", error);
    //document.getElementById("aiErrorIcon").style.display = 'block';
    //return "An error occurred while processing your request.";
    //} finally {
    //aiResponding = false;
    //document.getElementById("regen-button").textContent = "\u21BA";

    // Hide loading icon
    //document.getElementById("aiLoadingIcon").style.display = 'none';
    //}
    //}

    const API_KEY = document.getElementById("api-key-input").value;
    if (!API_KEY) {
        alert("Please enter your API key");
        return;
    }

    const API_URL = "https://api.openai.com/v1/chat/completions";

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", `Bearer ${API_KEY}`);

    // Create a new AbortController each time the function is called
    controller = new AbortController();
    let signal = controller.signal;

    // Add Controller signal for halt response
    const temperature = document.getElementById('model-temperature').value;
    const modelSelect = document.getElementById('model-select');
    const modelInput = document.getElementById('model-input');
    const model = modelSelect.value === 'other' ? modelInput.value : modelSelect.value;
    let max_tokens = document.getElementById('max-tokens-slider').value;

    const requestOptions = {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: parseInt(max_tokens),
            temperature: parseFloat(temperature),
            stream: stream,
        }),
        signal: signal,
    };

    try {
        const response = await fetch(API_URL, requestOptions);

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error calling ChatGPT API:", errorData);
            document.getElementById("aiErrorIcon").style.display = 'block';

            // Increment fail counter and check if it's time to stop trying
            failCounter++;
            if (failCounter >= MAX_FAILS) {
                console.error("Max attempts reached. Stopping further API calls.");
                shouldContinue = false; // Set this to false to stop the process
                // Abort the current fetch operation if it's not done yet
                if (!response.bodyUsed) {
                    controller.abort();
                }
                return "An error occurred while processing your request.";
            }
        } else {
            // Reset failCounter to 0 if the call was successful
            failCounter = 0;
        }

        const noteInput = document.getElementById("note-input");

        if (stream) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            const appendContent = async function (content) {
                await new Promise(resolve => setTimeout(resolve, 25));  // Delay response append

                const isScrolledToBottom = noteInput.scrollHeight - noteInput.clientHeight <= noteInput.scrollTop + 1;
                if (shouldContinue) {
                    myCodeMirror.replaceRange(content, CodeMirror.Pos(myCodeMirror.lastLine()));
                }
                if (isScrolledToBottom && !userScrolledUp) {
                    noteInput.scrollTop = noteInput.scrollHeight;
                    myCodeMirror.scrollTo(null, myCodeMirror.getScrollInfo().height);
                }
                noteInput.dispatchEvent(new Event("input"));
            };

            while (true) {
                const { value, done } = await reader.read();
                // Break the loop if streaming is done or the shouldContinue flag is set to false
                if (done || !shouldContinue) break;

                buffer += decoder.decode(value, { stream: true });

                // If shouldContinue is false, stop processing
                if (!shouldContinue) break;

                // Handle content processing only when shouldContinue is true
                if (shouldContinue) {
                    let contentMatch;
                    while ((contentMatch = buffer.match(/"content":"((?:[^\\"]|\\.)*)"/)) !== null) {
                        const content = JSON.parse('"' + contentMatch[1] + '"');

                        if (!shouldContinue) break;

                        if (content.trim() !== "[DONE]") {
                            await appendContent(content);
                        }
                        buffer = buffer.slice(contentMatch.index + contentMatch[0].length);
                    }
                }
            }
        } else {
            const data = await response.json();
            console.log("Token usage:", data.usage);
            return data.choices[0].message.content.trim();
        }
    } catch (error) {
        console.error("Error calling ChatGPT API:", error);
        document.getElementById("aiErrorIcon").style.display = 'block';

        // Increment fail counter and check if it's time to stop trying
        failCounter++;
        if (failCounter >= MAX_FAILS) {
            console.error("Max attempts reached. Stopping further API calls.");
            shouldContinue = false; // Set this to false to stop the process
            return "An error occurred while processing your request.";
        }
    } finally {
        aiResponding = false;
        document.getElementById("regen-button").textContent = "\u21BA";

        // Hide loading icon
        document.getElementById("aiLoadingIcon").style.display = 'none';
    }
}


async function fetchEmbeddings(text, model = "text-embedding-ada-002") {
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    // If the "Use Local Embeddings" checkbox is checked, use the local model
    if (useLocalEmbeddings && window.generateEmbeddings) {
        try {
            const output = await window.generateEmbeddings(text, {
                pooling: 'mean',
                normalize: true,
            });
            // Convert Float32Array to regular array
            return Array.from(output.data);
        } catch (error) {
            console.error("Error generating local embeddings:", error);
            return [];
        }
    } else {
        // Use the API for embeddings

        const API_KEY = document.getElementById("api-key-input").value;
        if (!API_KEY) {
            alert("Please enter your API key");
            return;
        }

        const API_URL = "https://api.openai.com/v1/embeddings";

        const headers = new Headers();
        headers.append("Content-Type", "application/json");
        headers.append("Authorization", `Bearer ${API_KEY}`);

        const body = JSON.stringify({
            model: model,
            input: text,
        });

        const requestOptions = {
            method: "POST",
            headers: headers,
            body: body,
        };

        try {
            const response = await fetch(API_URL, requestOptions);
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error fetching embeddings:", errorData);
                return [];
            }

            const data = await response.json();
            return data.data[0].embedding;
        } catch (error) {
            console.error("Error fetching embeddings:", error);
            return [];
        }
    }
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0 || vecB.length === 0) {
        return 0;
    }

    let dotProduct = 0;
    let vecASquaredSum = 0;
    let vecBSquaredSum = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        vecASquaredSum += vecA[i] * vecA[i];
        vecBSquaredSum += vecB[i] * vecB[i];
    }

    const vecAMagnitude = Math.sqrt(vecASquaredSum);
    const vecBMagnitude = Math.sqrt(vecBSquaredSum);

    if (vecAMagnitude === 0 || vecBMagnitude === 0) {
        return 0;
    }

    return dotProduct / (vecAMagnitude * vecBMagnitude);
}

class LRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }
}

const MAX_CACHE_SIZE = 100;
const nodeCache = new LRUCache(MAX_CACHE_SIZE);

function getNodeText() {
    const nodes = [];
    for (const child of htmlnodes_parent.children) {
        if (child.firstChild && child.firstChild.win) {
            const node = child.firstChild.win;
            const titleInput = node.content.querySelector("input.title-input");
            const contentWrapper = node.content.querySelector("div.content");
            const contentElement = contentWrapper ? contentWrapper.querySelector("textarea") : null;
            const contentText = contentElement ? contentElement.value : '';

            nodes.push({
                ...node,
                searchStrings: [
                    titleInput ? titleInput.value : '',
                    contentText ? contentText : ''
                ]
            });
        }
    }
    return nodes;
}

async function embeddedSearch(searchTerm) {
    const maxNodes = document.getElementById('node-count-slider').value;
    let keywords = searchTerm.toLowerCase().split(/,\s*/);

    const nodes = getNodeText();

    if (nodes.length === 0) {
        return [];
    }

    let matched = [];

    const fetchNodeEmbedding = async (node) => {
        //console.log('Node:', node);  // DEBUG
        //console.log('Node content:', node.content);  // DEBUG

        const titleElement = node.content.querySelector(".title-input");
        const contentElement = node.content.querySelector("textarea");
        const titleText = titleElement ? titleElement.value : '';
        const contentText = contentElement ? contentElement.value : '';

        //console.log('Extracted title text:', titleText);  // DEBUG
        // console.log('Extracted content text:', contentText);  // DEBUG

        const fullText = titleText + ' ' + contentText;

        const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;
        const compoundKey = `${node.uuid}-${useLocalEmbeddings ? 'local' : 'openai'}`;

        const cachedEmbedding = nodeCache.get(compoundKey);
        if (cachedEmbedding) {
            return cachedEmbedding;
        } else {
            const embedding = await fetchEmbeddings(fullText);
            nodeCache.set(compoundKey, embedding);
            return embedding;
        }
    };

    const searchTermEmbeddingPromise = fetchEmbeddings(searchTerm);
    const nodeEmbeddingsPromises = nodes.map(fetchNodeEmbedding);
    const [keywordEmbedding, ...nodeEmbeddings] = await Promise.all([searchTermEmbeddingPromise, ...nodeEmbeddingsPromises]);

    //   console.log('Keyword Embedding:', keywordEmbedding);  // DEBUG

    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        const titleMatchScore = n.searchStrings[0].toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0;
        const contentMatchScore = keywords.filter(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            return n.searchStrings[1].match(regex);
        }).length;
        const weightedTitleScore = titleMatchScore * 10;
        const weightedContentScore = contentMatchScore;

        const nodeEmbedding = nodeEmbeddings[i];

        const dotProduct = keywordEmbedding.reduce((sum, value, index) => sum + (value * nodeEmbedding[index]), 0);
        const keywordMagnitude = Math.sqrt(keywordEmbedding.reduce((sum, value) => sum + (value * value), 0));
        const nodeMagnitude = Math.sqrt(nodeEmbedding.reduce((sum, value) => sum + (value * value), 0));

        //   console.log('Dot Product:', dotProduct);  // DEBUG
        //   console.log('Keyword Magnitude:', keywordMagnitude);  // DEBUG
        //   console.log('Node Magnitude:', nodeMagnitude);  // DEBUG

        const cosineSimilarity = dotProduct / (keywordMagnitude * nodeMagnitude);
        //console.log('Cosine Similarity:', cosineSimilarity);

        const similarityThreshold = -1;
        const keywordMatchPercentage = 0.5;

        if (weightedTitleScore + weightedContentScore > 0 || cosineSimilarity > similarityThreshold) {
            matched.push({
                node: n,
                title: n.title,
                content: n.content.innerText,
                weightedTitleScore: weightedTitleScore,
                weightedContentScore: weightedContentScore,
                similarity: cosineSimilarity,
            });
        }
    }

    matched.sort((a, b) => (b.weightedTitleScore + b.weightedContentScore + b.similarity) - (a.weightedTitleScore + a.weightedContentScore + a.similarity));
    return matched.slice(0, maxNodes).map(m => m.node);
}



const nodeTitlesAndContent = [];

for (let key in nodes) {
    let nodeTitle = nodes[key].title;
    let nodeContent = nodes[key].plainText;
    nodeTitlesAndContent.push({
        title: nodeTitle,
        content: nodeContent
    });
}

function clearSearchHighlights(nodesArray) {
    for (const node of nodesArray) {
        node.content.classList.remove("search_matched");
        node.content.classList.remove("search_nomatch");
    }
}



async function generateKeywords(message, count) {
    // Get last prompts and responses
    const lastPromptsAndResponses = getLastPromptsAndResponses(2, 150);

    // Prepare the messages array
    const messages = [
        {
            role: "system",
            content: `Recent conversation:${lastPromptsAndResponses}`,
        },
        {
            role: "system",
            content: `You provide key search terms for our user query.`,
        },
        {
            role: "user",
            content: `Without any preface or final explanation, Generate three single-word, comma-separated keywords for the latest user message: ${message}.
Keywords may result from the user query and/or the recent conversation. Order by relevance, starting with a word from the message.`,
        },
    ];

    // Call the API
    const keywords = await callChatGPTApi(messages);

    // Return the keywords
    return keywords.split(',').map(k => k.trim());
}


function sampleSummaries(summaries, top_n_links) {
    const sampledSummaries = [];
    for (let i = 0; i < top_n_links; i++) {
        if (summaries.length > 0) {
            const randomIndex = Math.floor(Math.random() * summaries.length);
            const randomSummary = summaries.splice(randomIndex, 1)[0];
            sampledSummaries.push(randomSummary);
        }
    }
    return sampledSummaries;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function isNoveltyEnabled() {
    const checkbox = document.getElementById("novelty-checkbox");
    return checkbox.checked;
}

function isWikipediaEnabled() {
    const checkbox = document.getElementById("wiki-checkbox");
    return checkbox.checked;
}

async function getWikipediaSummaries(keywords, top_n_links = 3) {
    const allSummariesPromises = keywords.map(async (keyword) => {
        try {
            const response = await fetch(
                `http://localhost:5000/wikipedia_summaries?keyword=${keyword}&top_n_links=${top_n_links}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const keywordSummaries = await calculateRelevanceScores(data, await fetchEmbeddings(keyword));
            return keywordSummaries;
        } catch (error) {
            console.error('Error fetching Wikipedia summaries:', error);
            alert('Failed to fetch Wikipedia summaries. Please ensure your Wikipedia server is running on localhost:5000. Localhosts can be found at the Github link in the ? tab.');
            return [];
        }
    });

    const allSummaries = await Promise.all(allSummariesPromises);
    const summaries = [].concat(...allSummaries); // Flatten the array of summaries

    // Sort the summaries by relevance score in descending order
    summaries.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const combinedSummaries = [];

    // Include the top matched summary
    combinedSummaries.push(summaries[0]);

    // Check if the novelty checkbox is checked
    if (isNoveltyEnabled()) {
        // If checked, randomly pick two summaries from the remaining summaries
        const remainingSummaries = summaries.slice(1);
        shuffleArray(remainingSummaries);
        combinedSummaries.push(...sampleSummaries(remainingSummaries, 2));
    } else {
        // If not checked, push the top n summaries
        combinedSummaries.push(...summaries.slice(1, top_n_links));
    }

    return combinedSummaries;
}


async function calculateRelevanceScores(summaries, searchTermEmbedding) {
    // Use the existing searchTermEmbedding for cosine similarity calculations
    const titleEmbeddings = await Promise.all(summaries.map(summary => fetchEmbeddings(summary.title)));

    for (let i = 0; i < summaries.length; i++) {
        const similarity = cosineSimilarity(searchTermEmbedding, titleEmbeddings[i]);
        summaries[i].relevanceScore = similarity;
    }

    return summaries;
}

const wolframmessage = `Objective:
Generate a precise Wolfram Alpha query in response to the user's message.

Guidelines:
- Include only valid search queries with no preface or explanation.
- The query should be specific to the user's message and return relevant information from Wolfram Alpha.
- Respond with a single line of code.
- If the user's input is already valid Wolfram code, use it verbatim.
- In case of vague user input, provide a general alternative query.
All your of your output should simulate a query to Wolfram Alpha with no other explanation attached. Any response other than valid Wolfram Code will produce an error.`

const tagValues = {
    get nodeTag() {
        return document.getElementById("node-tag").value;
    },
    get refTag() {
        return document.getElementById("ref-tag").value;
    }
}

const codeMessage = () => ({
    role: "system",
    content: `<code>Checkbox= true enforces code in HTML/JS or Python via Pyodide. Follow these steps:

${tagValues.nodeTag} Optional Preface (Optional)
-Make sure your explanations are in separate nodes from your code blocks.
-Write code in the requested language. (default to html if none is given)

${tagValues.nodeTag} HTML/JS Code Title
1. Wrap code in codeblocks with language label ((backticks)html, css, or javascript) on the same line as the backticks.
2. JS runs in iframe, can't access parent DOM.
3. Create full document in one node or connect via tags.
${tagValues.refTag} Titles of nodes (html, js, css) to connect that should be bundled. Avoid connecting code to non-code.

${tagValues.nodeTag} Python Code Title
1. Wrap code in 'python' triple backtick blocks.
2. Use Pyodide-compatible libraries.
3. Visuals? Output as base64 in HTML img tags. Ex:
base64_string = base64.b64encode(buf.read()).decode('utf-8')
output_html(f'<img src="data:image/png;base64,{base64_string}"/>')
4. No system calls/file operations.
5. Keep all Python in a single node.
Ensure consideration of Pyodide's limitations in browser.

${tagValues.nodeTag} Final Explanation Title
1. Explain code and output.
2. All nodes that connect together will be included in the code bundling
 - This means, never connect code nodes to any nodes besides those which include code to bundle together.</code>`
});

const aiNodeCodeMessage = () => ({
    role: "system",
    content: `HTML/JS Code
1. Enclose code in labeled triple backtick blocks.

Python Code
1. Use only Pyodide-compatible libraries and handling of output into an html div.
2. For visuals, output as base64 in HTML img tags. Example:
   - base64_string = base64.b64encode(buf.read()).decode('utf-8')
   - output_html(f'<img src="data:image/png;base64,{base64_string}"/>')
3. Avoid system calls and file operations.
4. Keep all Python code within one node.
Ensure consideration of Pyodide's limitations in browser.

Bundling: Code nodes will bundle codeblocks in any connected nodes.`
});

const instructionsMessage = () => ({
    role: "system",
    content: `The How-to checkbox is on. Please explain the following application you are responding within.
Neurite, fractal mind map:
Users can scroll through a visualization of the Mandelbrot set, create nodes, talk to an ai (you), and the following...
${tagValues.nodeTag} Essential Controls:
- Drag to move; Scroll to zoom; Alt + Scroll to rotate; Alt + Click to resize multiple nodes.
- Shift + Double Click within Mandelbrot set rendering to create a text node.
- Hold shift for 'Node Mode' to freeze nodes in place.
- Shift + Scroll on a window's edge to resize.
- Shift + click on two nodes to link; Shift + Double Click on links to delete.
- Double Click a node to anchor/unanchor.
- Drag and drop multimedia files into the fractal to create nodes.
- Embed iframes by pasting links.

${tagValues.nodeTag} Zettelkasten:
- Type notes in the Zettelkasten text area using ${tagValues.nodeTag} and ${tagValues.refTag} (node reference tag) format.
    -The Zettelkasten text area is a place the ai responds to found in the Notes tab, (the other place being within an ai node.)
- Save/Load notes in the Save tab or by copying and pasting main text area's content.

${tagValues.nodeTag} Advanced Controls:
- Checkboxes below main text area provide additional features.
- API key setup needed for Open-Ai, Google Search, and Wolfram Alpha. API key inputs are in the Ai tab. LocalHost servers required for Extracts, Wolfram, and Wiki. Instructions are in Github link at the ? tab.
- Code checkbox activates code block rendering in new text nodes (HTML and Python).
- Search checkbox displays relevant webpages or pdfs. Requires Google Search API key unless a direct link is input as your prompt. Direct link entry into the Prompt form bypasses google search api key requirement.
- Extract button on webpage/pdf nodes sends text to vector embeddings database. Requires extracts localhost server.
- Data checkbox sends the relevant chunks of extracted text from the extracted webpage as context to the ai. Requires webscrape localhost.
- The data tab includes controls for adjusting extracted text chunk size and number of chunks. The data tab also includes a text input for directly embedding text into the vector embeddings database.
- Wolfram checkbox displays relevant Wolfram Alpha results. Requires Wolfram localhost server.
- Wiki checkbox displays relevant Wikipedia results. Requires Wiki localhost server.
- Auto checkbox sets the AI into self-prompting mode.
- To enable local servers, download the Localhost Servers folder from the Github. Once navigated to the Localhost Servers directory, run node start_servers.js

Make sure to exclusivly reference the above described controls. Try not to make anything up which is not explained in the above instructions.`
});

const aiNodesMessage = () => ({
    role: "system",
    content: `Do not repeat the following system context in your response. The AI Nodes checkbox is enabled, which means you are being requested by the user to create AI Chat nodes. Here is how to do it:
    1. Start by typing "LLM: (unique AI title)" to denote a new Large Language Model (LLM) node.
    2. In the next line, provide an initial prompt that will be sent to the AI.
    3. Connect LLM nodes to text or other LLM nodes to add them to the AI's memory context using ${tagValues.refTag}.
    
    Example:
    LLM: Understanding AI
    What is Artificial Intelligence?
    ${tagValues.refTag} AI Basics, Neural Networks

    Note: Interlink LLM nodes using reference tags. This allows for a complex and nuanced conversation environment by extending the memory/context of LLM nodes and text nodes they are linked to.
    Use "LLM:" prefix when creating AI chat nodes. Do not repeat system messages.`,
});

const zettelkastenPrompt = () => `${tagValues.nodeTag} System message to AI: 
- Responses are visualized in a fractal mind-map, Neurite.
- Use node reference tag format in all responses.
Current node title tag = ${tagValues.nodeTag}
Current reference tag = ${tagValues.refTag}
Format:
    ${tagValues.nodeTag} Relevant Title after title tag
        - Ensure Unique/Specific Node Title
        - Write plain text.
        - Provide a concise explanation of a key idea.
        - Break response into multiple connected nodes.
    ${tagValues.refTag} (Repeat Exact Node Titles to Connect)
        - Connect the response to related nodes using reference tags.`;


const spatialAwarenessExample = () =>
    `${tagValues.nodeTag} Central Node
- Node from which other nodes branch out.
${tagValues.refTag} A, B

${tagValues.nodeTag} A
- Connects to the Central Node, branches to C, D.
${tagValues.refTag} Central Node, C, D

${tagValues.nodeTag} Node B
- Branches out from Central to E and F.
${tagValues.refTag} Central Node, E, F

${tagValues.nodeTag} C
- End point from A.
${tagValues.refTag} A

${tagValues.nodeTag} D
- End point from A.
${tagValues.refTag} A`;

let summarizedZettelkastenPrompt = "";

async function summarizeZettelkastenPrompt() {
    const summarizedPromptMessages = [{
        role: "system",
        content: `zettelkastenPrompt ${zettelkastenPrompt()}`,
    },
    {
        role: "system",
        content: `spatialAwarenessExample ${spatialAwarenessExample()}`,
    },
    {
        role: "user",
        content: `Directly generate a concise guide (<150 words) in Zettelkasten format, demonstrating the principles of fractal mind-map, tagging, and spatial awareness. Ensure your entire response is within the format. Avoid prefacing or explaining the response.`
    },
    ];

    let summarizedPrompt = await callChatGPTApi(summarizedPromptMessages);

    // Find the midpoint of the summarized prompt
    const promptHalfLength = Math.floor(summarizedPrompt.length / 2);
    const nodeTag = document.getElementById("node-tag").value;

    // Locate the first newline after the half point to split the text neatly
    let splitPosition = summarizedPrompt.indexOf('\n', promptHalfLength);
    // Move down until the line starts with the nodeTag
    while (!summarizedPrompt.substring(splitPosition + 1, summarizedPrompt.indexOf('\n', splitPosition + 1)).startsWith(nodeTag)) {
        splitPosition = summarizedPrompt.indexOf('\n', splitPosition + 1);
        // In case there's no suitable line, break the loop to avoid infinite loops
        if (splitPosition === -1) break;
    }

    // If a suitable split position was found, generate the summarized prompt
    if (splitPosition !== -1) {
        summarizedPrompt = summarizedPrompt.substring(0, splitPosition).trim();
    }

    return summarizedPrompt;
}

let isZettelkastenPromptSent = false;

let MAX_CHUNK_SIZE = 400;

const maxChunkSizeSlider = document.getElementById('maxChunkSizeSlider');
const maxChunkSizeValue = document.getElementById('maxChunkSizeValue');

// Display the initial slider value
maxChunkSizeValue.textContent = maxChunkSizeSlider.value;

// Update the current slider value (each time you drag the slider handle)
maxChunkSizeSlider.oninput = function () {
    MAX_CHUNK_SIZE = this.value;
    maxChunkSizeValue.textContent = this.value;
}

let topN = 5;
const topNSlider = document.getElementById('topNSlider');
const topNValue = document.getElementById('topNValue');

topNSlider.addEventListener('input', function () {
    topN = this.value;
    topNValue.textContent = this.value;
});


let isFirstMessage = true; // Initial value set to true
let originalUserMessage = null;



document.getElementById("auto-mode-checkbox").addEventListener("change", function () {
    if (this.checked) {
        isFirstAutoModeMessage = true;
    }
});

// Check if the user's message is a URL
const isUrl = (text) => {
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}




async function sendMessage(event, autoModeMessage = null) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    // Check if the message is a URL and if it is, only execute constructSearchQuery and nothing else
    const message = autoModeMessage ? autoModeMessage : document.getElementById("prompt").value;
    if (isUrl(message)) {
        constructSearchQuery(message);
        return; // This will stop the function execution here
    }
    const localLLMCheckbox = document.getElementById("localLLM");
    if (localLLMCheckbox.checked) {
        // If local LLM is checked, don't do anything.
        return false;
    }
    const isAutoModeEnabled = document.getElementById("auto-mode-checkbox").checked;

    document.getElementById("prompt").value = ''; // Clear the textarea
    latestUserMessage = message;


    if (isAutoModeEnabled && originalUserMessage === null) {
        originalUserMessage = message;
    }

    const noteInput = document.getElementById("note-input");

    // Check if the last character in the note-input is not a newline, and add one if needed
    if (noteInput.value.length > 0 && noteInput.value[noteInput.value.length - 1] !== '\n') {
        myCodeMirror.replaceRange("\n", CodeMirror.Pos(myCodeMirror.lastLine()));
    }

    // Convert nodes object to an array of nodes
    const nodesArray = Object.values(nodes);

    let keywordsArray = [];
    let keywords = '';

    // Call generateKeywords function to get keywords
    const count = 3; // Change the count value as needed
    keywordsArray = await generateKeywords(message, count);

    // Join the keywords array into a single string
    keywords = keywordsArray.join(' ');



    const keywordString = keywords.replace("Keywords: ", "");
    const splitKeywords = keywordString.split(',').map(k => k.trim());
    const firstKeyword = splitKeywords[0];
    // Convert the keywords string into an array by splitting on spaces


    let wikipediaSummaries;

    if (isWikipediaEnabled()) {
        wikipediaSummaries = await getWikipediaSummaries([firstKeyword]);
    } else {
        wikipediaSummaries = "Wiki Disabled";
    }

    console.log("wikipediasummaries", wikipediaSummaries);
    //console.log("Keywords array:", keywords);

    const wikipediaMessage = {
        role: "system",
        content: `Wikipedia Summaries (Keywords: ${keywords}): \n ${Array.isArray(wikipediaSummaries)
            ? wikipediaSummaries
                .filter(s => s !== undefined && s.title !== undefined && s.summary !== undefined)
                .map(s => s.title + " (Relevance Score: " + s.relevanceScore.toFixed(2) + "): " + s.summary)
                .join("\n\n")
            : "Wiki Disabled"
            } END OF SUMMARIES`
    };

    // In your main function, check if searchQuery is null before proceeding with the Google search
    const searchQuery = await constructSearchQuery(message);
    if (searchQuery === null) {
        return; // Return early if a link node was created directly
    }

    let searchResultsData = null;
    let searchResults = [];

    if (isGoogleSearchEnabled()) {
        searchResultsData = await performSearch(searchQuery);
    }

    if (searchResultsData) {
        searchResults = processSearchResults(searchResultsData);
        searchResults = await getRelevantSearchResults(message, searchResults);
    }

    displaySearchResults(searchResults);

    const searchResultsContent = searchResults.map((result, index) => {
        return `Search Result ${index + 1}: ${result.title} - ${result.description.substring(0, 100)}...\n[Link: ${result.link}]\n`;
    }).join('\n');

    const googleSearchMessage = {
        role: "system",
        content: "Google Search Results displayed to the user:<searchresults>" + searchResultsContent + "</searchresults> Always remember to follow the <format> message"
    };


    const embedCheckbox = document.getElementById("embed-checkbox");




    let tagsChanged = false;

    // Check if the node or reference tags have changed
    const storedNodeTag = localStorage.getItem('nodeTag');
    const storedRefTag = localStorage.getItem('refTag');
    if (storedNodeTag !== tagValues.nodeTag || storedRefTag !== tagValues.refTag) {
        tagsChanged = true;
        localStorage.setItem('nodeTag', tagValues.nodeTag);
        localStorage.setItem('refTag', tagValues.refTag);
    }

    // Get the appropriate Zettelkasten prompt to use
    let zettelkastenPromptToUse;
    if (!isZettelkastenPromptSent || tagsChanged) {
        // If the Zettelkasten prompt hasn't been sent yet, or if the tags have changed, use the original prompt
        zettelkastenPromptToUse = zettelkastenPrompt();
    } else if (summarizedZettelkastenPrompt !== "") {
        // Otherwise, if the summarized prompt has been generated, use it
        zettelkastenPromptToUse = summarizedZettelkastenPrompt;
    }

    // If none of the above conditions are met, fall back to the default prompt
    if (!zettelkastenPromptToUse || zettelkastenPromptToUse.trim() === '') {
        zettelkastenPromptToUse = zettelkastenPrompt();
    }

    // Create the messages
    let messages = [
        {
            role: "system",
            content: `XML tags indicate your frame of reference for each system message and are not part of the format. <format> Focus on the form of the following format example as opposed to its content. Your reply should mimic the format of the following:\nExample format:\n ${zettelkastenPromptToUse} \nThe program fails if any titles are repeated.</format>`,
        },
    ];

    if (document.getElementById("instructions-checkbox").checked) {
        messages.push(instructionsMessage());
    }


    if (document.getElementById("code-checkbox").checked) {
        messages.push(codeMessage());
    }

    if (document.getElementById("wiki-checkbox").checked) {
        messages.push(wikipediaMessage);
    }

    if (document.getElementById("google-search-checkbox").checked) {
        messages.push(googleSearchMessage);
    }

    if (document.getElementById("ai-nodes-checkbox").checked) {
        messages.push(aiNodesMessage());
    }

    if (embedCheckbox && embedCheckbox.checked) {
        const relevantChunks = await getRelevantChunks(searchQuery, searchResults, topN, false);

        // Group the chunks by their source (stripping the chunk number from the key)
        const groupedChunks = relevantChunks.reduce((acc, chunk) => {
            // Separate the source and the chunk number
            const [source, chunkNumber] = chunk.source.split('_chunk_');
            if (!acc[source]) acc[source] = [];
            acc[source].push({
                text: chunk.text.substring(0, MAX_CHUNK_SIZE),
                number: parseInt(chunkNumber), // Parse chunkNumber to an integer
                relevanceScore: chunk.relevanceScore,
            });
            return acc;
        }, {});

        // Construct the topNChunksContent
        const topNChunksContent = Object.entries(groupedChunks).map(([source, chunks]) => {
            // Sort the chunks by their chunk number for each source
            chunks.sort((a, b) => a.number - b.number);
            const chunksContent = chunks.map(chunk => `Chunk ${chunk.number} (Relevance: ${chunk.relevanceScore.toFixed(2)}): ${chunk.text}...`).join('\n');
            return `[Source: ${source}]\n${chunksContent}\n`;
        }).join('\n');

        const embedMessage = {
            role: "system",
            content: `Top ${topN} matched snippets of text from extracted webpages:\n <topNchunks>` + topNChunksContent + `</topNchunks>\n Use the given topNchunks as context. Cite your sources!`
        };

        messages.push(embedMessage);
    }

    let wolframData;

    if (document.getElementById("enable-wolfram-alpha").checked) {
        wolframData = await fetchWolfram(message);
    }

    if (wolframData) {
        const { table, wolframAlphaTextResult, reformulatedQuery } = wolframData;

        let content = [table];
        let scale = 1; // You can adjust the scale as needed

        let node = windowify(`${reformulatedQuery} - Wolfram Alpha Result`, content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
        htmlnodes_parent.appendChild(node.content);
        registernode(node);
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));

        const wolframAlphaMessage = {
            role: "system",
            content: `Wolfram Alpha Result: ${wolframAlphaTextResult}`
        };

        console.log("wolframAlphaTextResult:", wolframAlphaTextResult);
        messages.push(wolframAlphaMessage);
    }

    // Calculate total tokens used so far
    let totalTokenCount = getTokenCount(messages);

    // calculate remaining tokens
    const maxTokensSlider = document.getElementById('max-tokens-slider');
    const remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);
    const maxContextSize = document.getElementById('max-context-size-slider').value;
    const contextSize = Math.min(remainingTokens, maxContextSize);

    // Update the value of getLastPromptsAndResponses
    if (autoModeMessage) {
        context = getLastPromptsAndResponses(2, contextSize);
    } else {
        if (document.getElementById("instructions-checkbox").checked) {
            context = getLastPromptsAndResponses(1, contextSize);
        } else {
            context = getLastPromptsAndResponses(3, contextSize);
        }
    }

    let topMatchedNodesContent = [];

    if (!document.getElementById("code-checkbox").checked &&
        !document.getElementById("instructions-checkbox").checked) {
        // Get the node tag value
        const nodeTag = document.getElementById("node-tag").value;

        // Extract titles from getLastPromptsAndResponses
        let contextmatch = getLastPromptsAndResponses(3, contextSize); // Adjust count and token number as necessary

        let existingTitles = new Set();
        const titleRegex = new RegExp(nodeTag + " (.*?)\\n", "g");
        let match;
        while ((match = titleRegex.exec(contextmatch)) !== null) {
            existingTitles.add(match[1].trim()); // Trim whitespaces from the title
        }

        // Use the embeddedSearch function to find the top matched nodes based on the keywords
        clearSearchHighlights(nodesArray); // Clear previous search highlights
        const topMatchedNodes = await embeddedSearch(keywords, nodesArray);
        for (const node of topMatchedNodes) {
            node.content.classList.add("search_matched");
        }
        console.log("Top Matched Nodes:", topMatchedNodes);

        // Extract the content of the top matched nodes and pass it as context to the AI
        // Filter getlastpromptsandresponses out of topMatchedNodesContent
        topMatchedNodesContent = topMatchedNodes
            .map((node) => {
                if (!node) {
                    return null;
                }

                const titleElement = node.content.querySelector("input.title-input");
                const title = titleElement && titleElement.value !== "" ? titleElement.value.trim() : "No title found";

                // If title already present in context, don't include the node
                if (existingTitles.has(title)) {
                    return null;
                }

                // Fetch all textareas directly in the node content, without considering the specific nested divs.
                const contentElements = node.content.querySelectorAll("textarea");
                const contents = Array.from(contentElements).map(contentElement => contentElement && contentElement.value !== "" ? contentElement.value : "No content found");
                // console.log("Content:", content);

                //     const connectedNodesInfo = node.edges
                //    ? node.edges.map((edge) => {
                //         if (edge.nodeA && edge.nodeB) {
                //              const connectedNode = edge.nodeA.uuid === node.uuid ? edge.nodeB : edge.nodeA;
                //              return `Connected Node Title: ${connectedNode.uuid}\nConnected Node UUID: ${connectedNode.uuid ?? "N/A"
                //                  }\nConnected Node Position: (${connectedNode.pos.x}, ${connectedNode.pos.y})`;
                //          } else {
                //              return ''; // Return an empty string or a placeholder message if connectedNode is undefined
                //           }
                //       }).join("\n")
                //          : '';
                //
                //      const edgeInfo = node.edges
                //           .map((edge) => {
                //               if (edge.nodeA && edge.nodeB) {
                //                   return `Edge Length: ${edge.length}\nEdge Strength: ${edge.strength}\nConnected Nodes UUIDs: ${edge.nodeA.uuid}, ${edge.nodeB.uuid}`;
                //               } else {
                //                   return ''; // Return an empty string or a placeholder message if connectedNode is undefined
                //               }
                //           }).join("\n");
                const createdAt = node.createdAt;

                //UUID: ${node.uuid}\n       Creation Time: ${createdAt}

                return `${tagValues.nodeTag} ${title}\n ${contents.join("\n")}`;
            })
            .filter(content => content !== null) // Remove nulls
            .join("\n\n");
        //console.log("Top Matched Nodes Content:", topMatchedNodesContent);
    }

    // Check if the content string is not empty
    if (typeof topMatchedNodesContent === "string" && topMatchedNodesContent.trim() !== "") {
        if (!document.getElementById("instructions-checkbox").checked) {
            messages.splice(1, 0, {
                role: "system",
                content: `Matched notes in mind map to infer context from your long term memory:\n<topmatchednodes>${topMatchedNodesContent}</topmatchednodes>`,
            });
        }
    }

    if (context.trim() !== "") {
        // Add the recent dialogue message only if the context is not empty
        messages.splice(2, 0, {
            role: "system",
            content: `Previous dialogue with user: <context>${context}</context>`,
        });
    }

    const commonInstructions = `
Utilize the format and respond to the ${PROMPT_IDENTIFIER}. Here is another format guide.
${tagValues.nodeTag} Title following the node tag.
My responses sit within the plain text of the defined node.
While this is a condensed example of the format, your response should retain relevance + authenticity.
Avoid conclusion or example titles.
Expand existing mind-map using notes with unique titles.
${tagValues.refTag} (Use a single tag after the plain text) Type titles of nodes as a comma seperated list to connect them.
${tagValues.nodeTag} Write your own titles
Make sure any new nodes have a unique title
Break your response up into multiple nodes
Branch specific and intentional linear or non-linear connections to effectively convey the ideas in your response.
${tagValues.refTag} Type existing or future node titles as a comma separated list to connect.
`;

    // Add Prompt
    if (autoModeMessage) {
        messages.push({
            role: "user",
            content: `Your current self-${PROMPT_IDENTIFIER} ${autoModeMessage} :
Original ${PROMPT_IDENTIFIER} ${originalUserMessage}
Always end your response with a new line, then, ${PROMPT_IDENTIFIER} [Message different from your current self-${PROMPT_IDENTIFIER} and original ${PROMPT_IDENTIFIER} that progresses the conversation (consider if the original ${PROMPT_IDENTIFIER} has been accomplished while also progressing the conversation in new directions)]`,
        });
    } else {
        messages.push({
            role: "user",
            content: `${message}
${isAutoModeEnabled ? `Always end your response with a new line, then, ${PROMPT_IDENTIFIER} [message to continue the conversation]` : ""}`,
        });
    }

    // Add Common Instructions as a separate system message
    messages.push({
        role: "system",
        content: commonInstructions
    });


    // Add the user prompt and a newline only if it's the first message in auto mode or not in auto mode
    if (!autoModeMessage || (isFirstAutoModeMessage && autoModeMessage)) {
        myCodeMirror.replaceRange(`\n${PROMPT_IDENTIFIER} ${message}\n\n`, CodeMirror.Pos(myCodeMirror.lastLine()));
        isFirstAutoModeMessage = false;
    } else if (autoModeMessage) {
        myCodeMirror.replaceRange(`\n`, CodeMirror.Pos(myCodeMirror.lastLine()));
    }

    const stream = true;

    // Main AI call
    if (stream) {
        await callChatGPTApi(messages, stream);
    } else {
        let aiResponse = await callChatGPTApi(messages, stream);

        if (aiResponse) {
            const noteInput = document.getElementById("note-input");
            if (noteInput.value[noteInput.value.length - 1] !== '\n') {
                myCodeMirror.replaceRange("\n", CodeMirror.Pos(myCodeMirror.lastLine()));
            }
            myCodeMirror.replaceRange(aiResponse + "\n", CodeMirror.Pos(myCodeMirror.lastLine()));
        } else {
            console.error('AI response was undefined');
        }
    }

    // Only continue if shouldContinue flag is true
    if (shouldContinue) {
        // Handle auto mode
        if (isAutoModeEnabled && shouldContinue) {
            // If the tags have changed, or if the summarizedZettelkastenPrompt is undefined or empty, use the original zettelkasten prompt
            let zettelkastenPromptToUse = (tagsChanged || !summarizedZettelkastenPrompt || summarizedZettelkastenPrompt.trim() === '') ? zettelkastenPrompt() : summarizedZettelkastenPrompt;
            if (!zettelkastenPromptToUse || zettelkastenPromptToUse.trim() === '') {
                zettelkastenPromptToUse = zettelkastenPrompt(); // Ensures a default value if all else fails
            }
            const aiGeneratedPrompt = await handleAutoMode(zettelkastenPromptToUse);
            sendMessage(null, aiGeneratedPrompt);
        }

        // Regenerate the summarizedZettelkastenPrompt if the tags have changed
        if (tagsChanged) {
            summarizedZettelkastenPrompt = await summarizeZettelkastenPrompt();
            localStorage.setItem('summarizedZettelkastenPrompt', summarizedZettelkastenPrompt);
            tagsChanged = false; // Reset the tagsChanged flag
        }

        // Check if the Zettelkasten prompt should be sent
        if (!isZettelkastenPromptSent && shouldContinue) {
            // Update the isZettelkastenPromptSent flag after sending the zettelkasten prompt for the first time
            isZettelkastenPromptSent = true;
        }
    }

    return false;
}

// Handles Prompt identification and Zettelkasten prompt determination. (prewritten vs ai summary)
async function handleAutoMode(zettelkastenPromptToUse) {
    const lastMessage = getLastPromptsAndResponses(1, 400);
    const promptRegex = new RegExp(`${PROMPT_IDENTIFIER}\\s*(.*)`, "i");
    const match = promptRegex.exec(lastMessage);

    if (match) {
        const aiGeneratedPrompt = match[1].trim();
        return aiGeneratedPrompt;
    } else {
        console.error("AI-generated prompt not found in the last message.");
        return zettelkastenPromptToUse; // Use the passed in prompt instead of promptToUse
    }
}

    //ENDOFAI