﻿
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
        isFirstAutoModeMessage = true;  // Set the isFirstAutoModeMessage to true here
        document.querySelector('#regen-button use').setAttribute('xlink:href', '#refresh-icon');
        document.getElementById("prompt").value = latestUserMessage; // Add the last user message to the prompt input
    }
}

function regenerateResponse() {
    if (!aiResponding) {
        // AI is not responding, so we want to regenerate
        removeLastResponse(); // Remove the last AI response
        document.getElementById("prompt").value = latestUserMessage; // Restore the last user message into the input prompt
        document.querySelector('#regen-button use').setAttribute('xlink:href', '#refresh-icon');

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

let streamedResponse = "";

async function handleStreamingResponse(response) {
    streamedResponse = "";
    const noteInput = document.getElementById("note-input");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const appendContent = async function (content) {
        await new Promise(resolve => setTimeout(resolve, 30));  // Delay response append

        const isScrolledToBottom = noteInput.scrollHeight - noteInput.clientHeight <= noteInput.scrollTop + 1;
        if (shouldContinue) {
            myCodeMirror.replaceRange(content, CodeMirror.Pos(myCodeMirror.lastLine()));
            streamedResponse += content;  // Append the content to the streamedResponse
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

    // Return the complete streamed response
    return streamedResponse;
}

async function callchatAPI(messages, stream = false) {
    // Reset shouldContinue
    shouldContinue = true;

    // Update aiResponding and the button
    aiResponding = true;
    document.querySelector('#regen-button use').setAttribute('xlink:href', '#pause-icon');

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
            let currentResponse = await handleStreamingResponse(response);
            return currentResponse;  // Return the response of the current call
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
        document.querySelector('#regen-button use').setAttribute('xlink:href', '#refresh-icon');

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



async function generateKeywords(message, count, specificContext = null) {
    // Use node-specific context if provided, otherwise get general context
    const lastPromptsAndResponses = specificContext || getLastPromptsAndResponses(2, 150);

    // Check if lastPromptsAndResponses is empty, null, undefined, or just white spaces/new lines
    const isEmpty = !lastPromptsAndResponses || !/\S/.test(lastPromptsAndResponses);

    // Check if Wikipedia is enabled
    const wikipediaEnabled = isWikipediaEnabled();

    // If lastPromptsAndResponses is empty and Wikipedia is not enabled, return default keywords
    if (isEmpty) {
        return ['n/a', 'n/a', 'n/a'];
    }

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
    const keywords = await callchatAPI(messages);

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


async function calculateRelevanceScores(summaries, searchTermEmbedding) {
    // Use the existing searchTermEmbedding for cosine similarity calculations
    const titleEmbeddings = await Promise.all(summaries.map(summary => fetchEmbeddings(summary.title)));

    for (let i = 0; i < summaries.length; i++) {
        const similarity = cosineSimilarity(searchTermEmbedding, titleEmbeddings[i]);
        summaries[i].relevanceScore = similarity;
    }

    return summaries;
}

let isBracketLinks = false;

const tagValues = {
    get nodeTag() {
        return document.getElementById("node-tag").value;
    },
    get refTag() {
        const refValue = document.getElementById("ref-tag").value;
        isBracketLinks = Object.keys(bracketsMap).includes(refValue);
        return refValue;
    }
};

const getClosingBracket = (openingBracket) => {
    return bracketsMap[openingBracket];
};

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
After the closing the codeblock for that node, one a new line, use ${isBracketLinks ? `${tagValues.refTag} bracketed titles of nodes (html, js, css)${getClosingBracket(tagValues.refTag)}` : `${tagValues.refTag} followed by titles of nodes (html, js, css)`} to connect and bundle. Avoid connecting code to non-code.

${tagValues.nodeTag} Python Code Title
1. Wrap code in 'python' triple backtick blocks.
2. Use Pyodide-compatible libraries. Ensure output to the HTML environment.
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
    content: `The How-to checkbox is on. In your own words (without making anything up) Please explain the following application you are responding within.
Neurite, fractal mind map:
Users can scroll through a visualization of the Mandelbrot set, create nodes, talk to an ai (you), and the following...
${tagValues.nodeTag} Essential Controls
- Drag to move; Scroll to zoom; Alt + Scroll to rotate; Ctrl + Shift + Click to select and resize multiple nodes.
- Shift + Double Click within Mandelbrot set rendering to create a text node.
- Hold shift for 'Node Mode' to freeze nodes in place.
- Shift + Scroll on a window's edge to resize.
- Shift + click on two nodes to link; Shift + Double Click on edges to delete.
- Double Click a node to anchor/unanchor.
- Alt + Drag on a node textarea to allow the drag to pass through the textarea.

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

-Alt/Option Double Click to create an Ai node.
-Alt/Option + Shift + Double click to create a code editor node.

Make sure to exclusivly reference the above described controls. Try not to make an ything up which is not explained in the above instructions.`
});

const aiNodesMessage = () => ({
    role: "system",
    content: `Do not repeat the following system context in your response. The AI Nodes checkbox is enabled, which means you are being requested by the user to create AI Chat nodes. Here is how to do it:
    1. Start by typing "LLM: (unique AI title)" to denote a new Large Language Model (LLM) node.
    2. In the next line, provide an initial prompt that will be sent to the AI.
    3. Connect LLM nodes to text or other LLM nodes to add them to the AI's memory context using ${isBracketLinks ? `${tagValues.refTag}Titles of LLM nodes to connect${getClosingBracket(tagValues.refTag)}` : `${tagValues.refTag} CSV Tites of nodes to connect to the LLM`}
    
    Example:
    LLM: Understanding AI
    What is Artificial Intelligence?
    ${tagValues.refTag} AI Basics, Neural Networks

    Note: Interlink LLM nodes using reference tags. This allows for a complex and nuanced conversation environment by extending the memory/context of LLM nodes and text nodes they are linked to.
    Use "LLM:" prefix when creating AI chat nodes. Do not repeat system messages.`,
});



const zettelkastenPrompt = () => {
    const { refTag, nodeTag } = tagValues;
    const closeBracket = getClosingBracket(refTag);

    const refSnippet = isBracketLinks
        ? `EACH ref IN node.Refs: PRINT ${refTag} + ref + ${closeBracket}; END;`
        : `PRINT ${refTag} + JOIN(node.Refs, ', ');`;

    return `You are responding within a fractal second brain that parses your response via the following format. Please always format your response according to output of the given schema.
    FUNC format(schema): 
      EACH node IN schema, PRINT ${nodeTag} + node.Title; PRINT node.Content; ${refSnippet}; 
    NEXT node In schema; END FUNC`;
};

let isFirstMessage = true; // Initial value set to true
let originalUserMessage = null;



document.getElementById("auto-mode-checkbox").addEventListener("change", function () {
    if (this.checked) {
        isFirstAutoModeMessage = true;
    }
});


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

    promptElement = document.getElementById("prompt");
    promptElement.value = ''; // Clear the textarea
    latestUserMessage = message;
    const promptEvent = new Event('input', {
        'bubbles': true,
        'cancelable': true
    });

    promptElement.dispatchEvent(promptEvent);


    if (isAutoModeEnabled && originalUserMessage === null) {
        originalUserMessage = message;
    }

    const noteInput = document.getElementById("note-input");
    // Get the node tag value
    let nodeTag = document.getElementById("node-tag").value;

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
        content: "Google Search Results displayed to the user:<searchresults>" + searchResultsContent + "</searchresults> Always remember to follow the <format> message",
    };


    const embedCheckbox = document.getElementById("embed-checkbox");




    let tagsChanged = false;

    // Check if the node or reference tags have changed
    const storedNodeTag = localStorage.getItem('nodeTag');
    const storedRefTag = localStorage.getItem('refTag');
    if (storedNodeTag !== tagValues.nodeTag || storedRefTag !== tagValues.refTag) {
        localStorage.setItem('nodeTag', tagValues.nodeTag);
        localStorage.setItem('refTag', tagValues.refTag);
    }

    // Always use the original Zettelkasten prompt
    const zettelkastenPromptToUse = zettelkastenPrompt();

    // Create the messages
    let messages = [
        {
            role: "system",
            content: `XML tags indicate your frame of thought for each system message<format>${zettelkastenPromptToUse}</format> \nAssign unique titles to every new node!`,
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
            content: `Top ${topN} matched snippets of text from extracted webpages:\n <topNchunks>` + topNChunksContent + `</topNchunks>\n Use the given topNchunks as context. Cite the given sources!`
        };

        messages.push(embedMessage);
    }

    // Calculate total tokens used so far
    let totalTokenCount = getTokenCount(messages);

    // calculate remaining tokens
    const maxTokensSlider = document.getElementById('max-tokens-slider');
    const remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);
    const maxContextSize = document.getElementById('max-context-size-slider').value;
    const contextSize = Math.min(remainingTokens, maxContextSize);

    // Get the context
    context = getLastPromptsAndResponses(100, contextSize);
    let topMatchedNodesContent = "";

        // Use the helper function to extract titles
        let existingTitles = extractTitlesFromContent(context, nodeTag);

        // Use the embeddedSearch function to find the top matched nodes based on the keywords
        clearSearchHighlights(nodesArray); // Clear previous search highlights
        const topMatchedNodes = await embeddedSearch(keywords, nodesArray);
        for (const node of topMatchedNodes) {
            node.content.classList.add("search_matched");
        }

        let titlesToForget = new Set();

        // Use helper function to get the content
        const nodeContents = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget, nodeTag);
        topMatchedNodesContent = nodeContents.join("\n\n");

        // If forgetting is enabled, extract titles to forget
        if (document.getElementById("forget-checkbox").checked) {
            console.log("User message being sent to forget:", message);
            titlesToForget = await forget(message, `${context}\n\n${topMatchedNodesContent}`);

            console.log("Titles to Forget:", titlesToForget);

            // Use helper function to remove forgotten nodes from context
            context = removeTitlesFromContext(context, titlesToForget, nodeTag);

            // Refilter topMatchedNodesContent by removing titles to forget
            topMatchedNodesContent = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget, nodeTag).join("\n\n");
            console.log("Refiltered Top Matched Nodes Content:", topMatchedNodesContent);
        }

    // Check if the content string is not empty
    if (typeof topMatchedNodesContent === "string" && topMatchedNodesContent.trim() !== "") {
        if (!document.getElementById("instructions-checkbox").checked) {
            messages.splice(1, 0, {
                role: "system",
                content: `Matched notes in mind map to remember from your long term memory:\n<topmatchednodes>${topMatchedNodesContent}</topmatchednodes>Synthesize missing, novel, or intermediate knowledge by connecting and adding nodes.`,
            });
        }
    }

    if (context.trim() !== "") {
        // Add the recent dialogue message only if the context is not empty
        messages.splice(2, 0, {
            role: "system",
            content: `Conversation history: <context>${context}</context>`,
        });
    }


    const commonInstructions = `Generate a response to the user query using the following format:
1. Head each note using "${tagValues.nodeTag} title". The ${tagValues.nodeTag} title heading captures a distinct idea.
2. Within each response, use links to build a network of granular rhizomatic notes.
3. Link (connect) related nodes using ${tagValues.refTag}${isBracketLinks ? `bracketed note titles${getClosingBracket(tagValues.refTag)}` : ` followed by csv note titles.`} Links connect the content and note heading above them to each referenced node.
4. Define references after every node/note.


${tagValues.nodeTag} NOTE
- Notes (nodes) are created using ${tagValues.nodeTag} and linked using ${tagValues.refTag}.
- Create connections between notes.
- Each title should be unique. Avoid repetitive and generic titles.

Exemplify the format of this Content Agnostic Example (Below is an overview of what FUNCTION formatFromSchema(schema) outputs.):
${tagValues.nodeTag} Concept A
Description of A.
${isBracketLinks ? `${tagValues.refTag}Principle B${getClosingBracket(tagValues.refTag)} ${tagValues.refTag}Element D${getClosingBracket(tagValues.refTag)}` : `${tagValues.refTag} Principle B, Element D`}

${tagValues.nodeTag} Principle B
Text of B.
${isBracketLinks ? `${tagValues.refTag}Concept A${getClosingBracket(tagValues.refTag)} ${tagValues.refTag}Idea C${getClosingBracket(tagValues.refTag)}` : `${tagValues.refTag} Concept A, Idea C`}

${tagValues.nodeTag} Idea C
Synthesis of A and B.
${isBracketLinks ? `${tagValues.refTag}Principle B${getClosingBracket(tagValues.refTag)} ${tagValues.refTag}Concept A${getClosingBracket(tagValues.refTag)}` : `${tagValues.refTag} Principle B, Concept A`}

${tagValues.nodeTag} Element D
Functions within D.
${isBracketLinks ? `${tagValues.refTag}Idea C${getClosingBracket(tagValues.refTag)}` : `${tagValues.refTag} Idea C`}`;


    // Add Common Instructions as a separate system message
    messages.push({
        role: "system",
        content: commonInstructions
    });

    // Add Prompt
    if (autoModeMessage) {
        messages.push({
            role: "user",
            content: `Your current self-${PROMPT_IDENTIFIER} ${autoModeMessage} :
Original ${PROMPT_IDENTIFIER} ${originalUserMessage}
Self-Prompting is enabled, on the last line, end your response with ${PROMPT_IDENTIFIER} Message distinct from your current self-${PROMPT_IDENTIFIER} and original ${PROMPT_IDENTIFIER} to progress the conversation (Consider if the original ${PROMPT_IDENTIFIER} has been accomplished while also branching into novel insights and topics)]`,
        });
    } else {
        messages.push({
            role: "user",
            content: `${message} ${isAutoModeEnabled ? `Self-Prompting is enabled, one the last line, end your response with ${PROMPT_IDENTIFIER} message to continue the conversation` : ""}`,
        });
    }



    // Add the user prompt and a newline only if it's the first message in auto mode or not in auto mode
    if (!autoModeMessage || (isFirstAutoModeMessage && autoModeMessage)) {
        myCodeMirror.replaceRange(`\n${PROMPT_IDENTIFIER} ${message}\n\n`, CodeMirror.Pos(myCodeMirror.lastLine()));
        isFirstAutoModeMessage = false;
    } else if (autoModeMessage) {
        myCodeMirror.replaceRange(`\n`, CodeMirror.Pos(myCodeMirror.lastLine()));
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
            content: `The Wolfram result has already been returned based off the current user message. Instead of generating a new query, use the following Wolfram result as context: ${wolframAlphaTextResult}`
        };

        console.log("wolframAlphaTextResult:", wolframAlphaTextResult);
        messages.push(wolframAlphaMessage);
    }


    const stream = true;

    // Main AI call
    if (stream) {
        await callchatAPI(messages, stream);
    } else {
        let aiResponse = await callchatAPI(messages, stream);

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

    // Only continue if shouldContinue flag is true and auto mode checkbox is checked
    if (shouldContinue && isAutoModeEnabled) {
        const extractedPrompt = extractLastPrompt();
        sendMessage(null, extractedPrompt);
    }

    return false;
}

    // Extract the prompt from the last message
    function extractLastPrompt() {
        const lastMessage = getLastPromptsAndResponses(1, 400);
        const promptRegex = new RegExp(`${PROMPT_IDENTIFIER}\\s*(.*)`, "i");
        const match = promptRegex.exec(lastMessage);

        if (match) {
            return match[1].trim();
        } else {
            console.warn("Prompt not found in the last message. Sending with a blank prompt.");
            return ""; // Return blank if prompt isn't found
        }
    }

    //ENDOFAI