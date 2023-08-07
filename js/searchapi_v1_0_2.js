//searchapi.js

async function fetchWolfram(message) {
    let wolframAlphaResult = "not-enabled";
    let wolframAlphaTextResult = "";
    let reformulatedQuery = "";

    reformulatedQuery = await callChatGPTApi([
        {
            role: "system",
            content: `<wolfram>${wolframmessage}</wolfram>`
        },
        {
            role: "user",
            content: `${message} Wolfram Query`,
        }
    ]);

    console.log("Reformulated query:", reformulatedQuery);

    // Call Wolfram Alpha API with the reformulated query
    const apiKey = document.getElementById("wolframApiKey").value;

    const response = await fetch("http://localhost:3000", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: reformulatedQuery,
            apiKey: apiKey
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Error with Wolfram Alpha API call:", errorData.error);
        console.error("Full error object:", errorData);
        alert("An error occurred when making a request the Wolfram Alpha. Ensure the Wolfram server is running on your localhost with a valid Wolfram API key. The API input is in the Ai tab. Localhosts can be found at the Github link in the ? tab.");
        return;
    }

    const data = await response.json();
    console.log("Wolfram Alpha data:", data); // Debugging data object

    if (!data.pods) {
        return;
    }

    const table = document.createElement("table");
    table.style = "width: 100%; border-collapse: collapse;";

    for (const pod of data.pods) {
        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = pod.title;
        titleCell.style = "padding: 10px; background-color: #222226;";

        const imageCell = document.createElement("td");
        imageCell.style = "padding: 10px; text-align: center; background-color: white";

        for (let i = 0; i < pod.images.length; i++) {
            const imageUrl = pod.images[i];
            const plaintext = pod.plaintexts[i];

            // Adding plaintext to wolframAlphaTextResult
            wolframAlphaTextResult += `${pod.title}: ${plaintext}\n`;

            const img = document.createElement("img");
            img.alt = `${reformulatedQuery} - ${pod.title}`;
            img.style = "display: block; margin: auto; border: none;";
            img.src = imageUrl;

            imageCell.appendChild(img);
        }

        row.appendChild(titleCell);
        row.appendChild(imageCell);
        table.appendChild(row);
    }


    return { table, wolframAlphaTextResult, reformulatedQuery };
}

// console.log("Sending context to AI:", messages);
async function performSearch(searchQuery) {
    // Get the API Key and Search Engine ID from local storage
    const apiKey = localStorage.getItem('googleApiKey');
    const searchEngineId = localStorage.getItem('googleSearchEngineId');

    console.log(`Search query: ${searchQuery}`);  // Log the search query

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURI(searchQuery)}`;
    //console.log(`Request URL: ${url}`);  // Log the request URL

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Received data:', data);  // Log the received data

        return data;
    } catch (error) {
        console.error('Error fetching search results:', error);
        alert('Failed to fetch search results. Please ensure you have entered your Google Programmable Search API key and search engine ID in the Ai tab.');
        return null;
    }
}

async function constructSearchQuery(userMessage) {
    // If the user's message is a URL, use it as the search query and create a link node
    if (isUrl(userMessage)) {
        document.getElementById("prompt").value = ''; // Clear the textarea
        let node = createLinkNode(userMessage, userMessage, userMessage); // Set the title to user's message (URL)

        htmlnodes_parent.appendChild(node.content);
        registernode(node);
        // Attach the node to the user's mouse
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));

        return null; // Return null to indicate that no further processing is necessary
    }
    const embedCheckbox = document.getElementById("embed-checkbox");
    if (!isGoogleSearchEnabled() && (!embedCheckbox || !embedCheckbox.checked)) {
        return "not-enabled"; // Return an empty string or any default value when search is disabled
    }



    recentcontext = getLastPromptsAndResponses(2, 150);

    const queryContext = [{
        role: "system",
        content: `The following recent conversation may provide further context for generating your search query. \n ${recentcontext},`
    },
    {
        role: "system",
        content: "Generate a search query most relevant to the current user message. Your response is used for both a Google Programable Search and an embedded vector search to find relevant webpages/pdf chunks. User can't see your output. Provide a single, brief search query that's most likely to yield relevant results. No need to explain or preface your output."
    },
    {
        role: "user",
        content: userMessage,
    },
    ];

    const searchQuery = await callChatGPTApi(queryContext);
    return searchQuery;
}





async function getRelevantSearchResults(userMessage, searchResults, topN = 5) {
    const userMessageEmbedding = await fetchEmbeddings(userMessage);

    // Get the embeddings for the search results and store them in an array
    const searchResultEmbeddings = await Promise.all(
        searchResults.map(async result => {
            const titleAndDescription = result.title + " " + result.description;
            const embedding = await fetchEmbeddings(titleAndDescription);
            return {
                result,
                embedding
            };
        })
    );

    // Calculate the cosine similarity between the user message embedding and each search result embedding
    searchResultEmbeddings.forEach(resultEmbedding => {
        resultEmbedding.similarity = cosineSimilarity(userMessageEmbedding, resultEmbedding.embedding);
    });

    // Sort the search results by their similarity scores
    searchResultEmbeddings.sort((a, b) => b.similarity - a.similarity);

    // Return the top N search results
    return searchResultEmbeddings.slice(0, topN).map(resultEmbedding => resultEmbedding.result);
}





function isGoogleSearchEnabled() {
    const googleSearchCheckbox = document.getElementById("google-search-checkbox");
    return googleSearchCheckbox && googleSearchCheckbox.checked;
}


function processSearchResults(results) {
    if (!results || !results.items || !Array.isArray(results.items)) {
        return []; // Return an empty array if no valid results are found
    }

    const formattedResults = results.items.map(item => {
        return {
            title: item.title,
            link: item.link,
            description: item.snippet
        };
    });

    if (!Array.isArray(formattedResults)) {
        return "No results found";
    }

    return formattedResults;
}

const CORS_PROXY = "http://localhost:4000/proxy";

async function fetchAndDisplayAllKeys() {
    try {
        const response = await fetch('http://localhost:4000/get-keys');
        if (!response.ok) {
            console.error(`Failed to fetch keys:`, response.statusText);
            return;
        }


        const keys = await response.json();
        const keyList = document.getElementById("key-list");
        // Clear existing keys
        keyList.innerHTML = "";

        for (let key of keys) {
            // Create a new paragraph for the key
            var listItem = document.createElement("p");

            // Set the text of the paragraph to the key
            listItem.textContent = key;

            // Add the paragraph to the list
            keyList.appendChild(listItem);

            // Add a click event listener to the paragraph
            // Make use of closures to capture each listItem instance separately
            (function (listItem) {
                listItem.addEventListener("click", (event) => {
                    event.stopPropagation();
                    listItem.classList.toggle("selected");
                });
            })(listItem);
        }
    } catch (error) {
        console.error(`(Server disconnect) Failed to fetch keys:`, error);
    }
}

window.onload = function () {
    fetchAndDisplayAllKeys();
}

document.getElementById('chunkAndStoreButton').addEventListener('click', chunkAndStoreInputExtract);

async function deleteSelectedKeys() {
    // Get all selected keys
    const selectedKeys = Array.from(document.getElementsByClassName("selected")).map(el => el.textContent);

    // Send a request to the server to delete the chunks for each key
    for (let key of selectedKeys) {
        const response = await fetch(`http://localhost:4000/delete-chunks?key=${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.error(`Failed to delete chunks for key ${key}:`, response.statusText);
        }
    }

    // Refresh the key list
    fetchAndDisplayAllKeys();
}

async function chunkAndStoreInputExtract() {
    const chunkAndStoreButton = document.getElementById('chunkAndStoreButton');
    let dotCount = 0;

    // Start the dot animation
    const dotInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4; // Cycle dotCount between 0 and 3
        chunkAndStoreButton.textContent = "Chunking Input" + ".".repeat(dotCount);
    }, 500); // Update every 500 milliseconds

    try {
        // Get the input text from the textarea
        const inputText = document.getElementById('inputTextExtract').value;

        if (!inputText) {
            alert("Please enter some text into the textarea");
            return;
        }

        // Chunk the input text
        const chunkedText = chunkText(inputText, MAX_CHUNK_SIZE, overlapSize);

        // Fetch the embeddings for the chunks
        const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

        // Get the key from the input field, or use the first sentence of the input text if no key was provided
        let key = document.getElementById('inputKeyExtract').value;
        if (!key) {
            // Extract the first sentence from the input text
            // This regex matches everything up to the first period, question mark, or exclamation mark
            const firstSentenceMatch = inputText.match(/[^.!?]+[.!?]/);
            key = firstSentenceMatch ? firstSentenceMatch[0] : inputText;
        }

        // Store the chunks and their embeddings in the database
        const success = await storeEmbeddingsAndChunksInDatabase(key, chunkedText, chunkedEmbeddings);

        chunkAndStoreButton.textContent = success ? "Store Chunks" : "Chunking Failed";

    } catch (error) {
        console.error(`Failed to chunk and store input:`, error); //1872
        chunkAndStoreButton.textContent = "Chunking Failed";
    } finally {
        // Stop the dot animation
        clearInterval(dotInterval);
    }
}

async function storeEmbeddingsAndChunksInDatabase(key, chunks, embeddings) {
    console.log(`Storing embeddings and text chunks for key: ${key}`);

    // Check if local embeddings are used
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;
    const source = useLocalEmbeddings ? 'local' : 'openai';

    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunkKey = `${key}_chunk_${i}`;
            const response = await fetch('http://localhost:4000/store-embedding-and-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: chunkKey,
                    embedding: embeddings[i],
                    text: chunks[i],
                    source: source  // attach the source tag
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to store chunk ${i} for key ${key}: ${response.statusText}`);
            }
        }

        // If no errors, refresh the key list
        await fetchAndDisplayAllKeys();

        // If no errors, return true to indicate success
        return true;
    } catch (error) {
        console.error(`Failed to store chunks and embeddings for key ${key}:`, error);
        throw error;
    }
}

async function fetchAndStoreWebPageContent(url) {
    try {
        const response = await fetch(`${CORS_PROXY}?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
            console.error(`Failed to fetch web page content for ${url}:`, response.statusText);
            return null;
        }

        const contentType = response.headers.get("content-type");
        const extractedTextResponse = await fetch(`${CORS_PROXY}/extract-text?url=${encodeURIComponent(url)}`);
        const text = await extractedTextResponse.text();

        if (typeof text !== "string") {
            console.warn(`Text type for ${url}: ${contentType}`);
            console.warn(`Text for ${url}:`, text);
            return null;
        }

        const chunkedText = chunkText(extractedText, MAX_CHUNK_SIZE, overlapSize);
        const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

        // Store the chunked embeddings and text in the database
        await storeEmbeddingsAndChunksInDatabase(url, chunkedText, chunkedEmbeddings);
    } catch (error) {
        console.error(`Failed to fetch web page content for ${url}:`, error);
        alert("An error occurred fetching the top-n relevant chunks of extracted webpage text. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
        return null;
    }
}

async function fetchAllStoredEmbeddings() {
    try {
        const response = await fetch(`http://localhost:4000/fetch-all-embeddings`);

        if (!response.ok) {
            console.error(`Failed to fetch stored embeddings:`, response.statusText);
            return null;
        }

        // Parse the response text as JSON
        const embeddings = await response.json();
        //console.log('Fetched all stored embeddings:', embeddings);
        return embeddings;

    } catch (error) {
        console.error(`Failed to fetch stored embeddings:`, error);
        alert("An error occurred fetching the top-n relevant chunks of extracted webpage text. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
        return null;
    }
}

function chunkText(text, maxLength, overlapSize) {
    const sentences = text.match(/[^.!?]+\s*[.!?]+|[^.!?]+$/g);  // Modified regex to preserve punctuation and spaces
    const chunks = [];
    let chunkWords = [];
    let chunkLength = 0;

    for (const sentence of sentences) {
        const words = sentence.split(/\s+/);

        for (const word of words) {
            // Add 1 for the space if not the first word in the chunk
            const wordLengthWithSpace = chunkLength === 0 ? word.length : word.length + 1;

            // Check if single word exceeds maxLength
            if (word.length > maxLength) {
                throw new Error(`Word length exceeds maxLength: ${word}`);
            }

            // Check if adding new word exceeds maxLength
            if (chunkLength + wordLengthWithSpace > maxLength) {
                chunks.push(chunkWords.join(' '));
                chunkWords = chunkWords.slice(-overlapSize);
                chunkLength = chunkWords.join(' ').length;
            }

            // Add the word to the current chunk
            if (chunkLength > 0) {
                chunkWords.push(' ' + word);
                chunkLength += wordLengthWithSpace;
            } else {
                chunkWords.push(word);
                chunkLength += word.length;
            }
        }
    }

    // Add the remaining chunk if it's not empty
    if (chunkWords.length > 0) {
        chunks.push(chunkWords.join(' '));
    }

    return chunks;
}

async function getRelevantChunks(searchQuery, searchResults) {
    const searchQueryEmbedding = await fetchEmbeddings(searchQuery);

    const allEmbeddings = await fetchAllStoredEmbeddings();
    if (!allEmbeddings) {
        console.error("No embeddings were fetched. Please check the server logs for more information.");
        return [];
    }

    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    const chunkEmbeddings = allEmbeddings.flatMap(embedding => {
        if (!useLocalEmbeddings && embedding.source === 'local') {
            return []; // Ignore local embeddings when checkbox is not checked
        } else if (useLocalEmbeddings && embedding.source !== 'local') {
            return []; // Ignore non-local embeddings when checkbox is checked
        }
        if (typeof embedding.chunks === 'string') {
            const result = {
                link: embedding.key,
                description: embedding.chunks
            };
            return [{
                result,
                embedding: embedding.embedding,
                source: embedding.source // Extract source here
            }];
        } else if (Array.isArray(embedding.chunks)) {
            return embedding.chunks.map(chunk => {
                const result = {
                    link: embedding.key,
                    description: chunk.text
                };
                return {
                    result,
                    embedding: chunk.embedding,
                    source: chunk.source // Extract source here
                };
            });
        } else {
            return [];
        }
    });

    // Calculate the cosine similarity between the search query embedding and each chunk embedding
    chunkEmbeddings.forEach(chunkEmbedding => {
        const embedding = chunkEmbedding.embedding;
        const source = chunkEmbedding.source; // Use extracted source

        if (embedding && embedding.length > 0) {
            let similarity = cosineSimilarity(
                searchQueryEmbedding,
                embedding
            );


            chunkEmbedding.similarity = similarity;
        } else {
            chunkEmbedding.similarity = 0;
        }
    });
    //console.log("Chunk embeddings with similarity:", chunkEmbeddings); //4551

    // Sort the chunks by their similarity scores
    chunkEmbeddings.sort((a, b) => b.similarity - a.similarity);
    console.log("Sorted chunk embeddings:", chunkEmbeddings);

    // Return the top N chunks or the total number of chunks if less than N
    const limit = Math.min(topN, chunkEmbeddings.length);
    const topNChunks = chunkEmbeddings
        .slice(0, limit)
        .map(chunkEmbedding => ({
            text: chunkEmbedding.result.description,
            source: chunkEmbedding.result.link,
            relevanceScore: chunkEmbedding.similarity
        }));
    console.log("Top N Chunks:", topNChunks);

    return topNChunks;
}

let overlapSize = document.getElementById('overlapSizeSlider').value;

document.getElementById('overlapSizeSlider').addEventListener('input', function (e) {
    overlapSize = Number(e.target.value);
    document.getElementById('overlapSizeDisplay').textContent = overlapSize;
});




async function fetchChunkedEmbeddings(textChunks, model = "text-embedding-ada-002") {
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    // Array to store the embeddings
    const chunkEmbeddings = [];

    // Loop through each chunk of text
    for (const chunk of textChunks) {

        // Check if local embeddings should be used
        if (useLocalEmbeddings && window.generateEmbeddings) {
            try {
                // This assumes that the local embedding model is initialized
                // and assigned to window.generateEmbeddings
                const output = await window.generateEmbeddings(chunk, {
                    pooling: 'mean',
                    normalize: true,
                });
                // Convert Float32Array to regular array
                chunkEmbeddings.push(Array.from(output.data));
            } catch (error) {
                console.error("Error generating local embeddings:", error);
                chunkEmbeddings.push([]);
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
                input: chunk,
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
                    chunkEmbeddings.push([]);
                    continue;
                }

                const data = await response.json();
                const embedding = data.data[0].embedding;

                chunkEmbeddings.push(embedding);
            } catch (error) {
                console.error("Error fetching embeddings:", error);
                chunkEmbeddings.push([]);
            }
        }
    }
    return chunkEmbeddings;
}

function createLinkNode(name = '', text = '', link = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    let t = document.createElement("input");
    t.setAttribute("type", "text");
    t.setAttribute("value", name);
    t.setAttribute("style", "background:none; ");
    t.classList.add("title-input");

    let a = document.createElement("a");
    a.setAttribute("href", link);
    a.setAttribute("target", "_blank");
    a.textContent = text;
    a.style.cssText = "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap; color: #bbb; transition: color 0.2s ease, background-color 0.2s ease; background-color: #222226; border-radius: 5px";

    a.addEventListener('mouseover', function () {
        this.style.color = '#888';
        this.style.backgroundColor = '#1a1a1d'; // Change background color on hover
    }, false);

    a.addEventListener('mouseout', function () {
        this.style.color = '#bbb';
        this.style.backgroundColor = '#222226'; // Reset background color when mouse leaves
    }, false);

    let linkWrapper = document.createElement("div");
    linkWrapper.style.width = "300px";
    linkWrapper.style.padding = "20px 0"; // Add vertical padding
    linkWrapper.appendChild(a);

    let iframeWrapper = document.createElement("div");
    iframeWrapper.style.width = "100%";
    iframeWrapper.style.height = "0";
    iframeWrapper.style.flexGrow = "1";
    iframeWrapper.style.flexShrink = "1";
    iframeWrapper.style.display = "none";
    iframeWrapper.style.boxSizing = "border-box";

    let iframe = document.createElement("iframe");
    iframe.setAttribute("src", "");
    iframe.setAttribute("style", "width: 100%; height: 100%; border: none; overflow: auto;");

    iframe.addEventListener("load", () => {
        const buttonHeight = button.offsetHeight + displayButton.offsetHeight + extractButton.offsetHeight;
        const minHeight = iframe.offsetHeight + buttonHeight + 35;
        const currentHeight = parseInt(windowDiv.style.height, 10);

        if (currentHeight < minHeight) {
            windowDiv.style.height = `${minHeight}px`;
        }
    });

    let button = document.createElement("button");
    button.textContent = "Load as iframe";
    button.classList.add("linkbuttons");

    button.addEventListener("click", () => {
        if (iframeWrapper.style.display === "none") {
            iframeWrapper.appendChild(iframe);
            linkWrapper.style.display = "none";
            iframeWrapper.style.display = "block";
            button.textContent = "Return to link";

            // Set the src attribute of the iframe here
            iframe.setAttribute("src", link);

            // Adjust the height of the iframeWrapper to accommodate buttons
            let availableHeight = windowDiv.offsetHeight - buttonsWrapper.offsetHeight;
            iframeWrapper.style.height = availableHeight + 'px';
        } else {
            linkWrapper.style.display = "block";
            iframeWrapper.style.display = "none";
            button.textContent = "Load as iframe";
            // Clear the src attribute of the iframe here
            iframe.setAttribute("src", "");
        }
    });

    let extractButton = document.createElement("button");
    extractButton.textContent = "Extract Text";
    extractButton.classList.add("linkbuttons");

    extractButton.addEventListener("click", function () {
        let dotCount = 0;

        // Start the dot animation
        const dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4; // Cycle dotCount between 0 and 3
            extractButton.textContent = "Extracting" + ".".repeat(dotCount);
        }, 500); // Update every 500 milliseconds

        setTimeout(async function () {
            try {
                // Send the link to the server for text extraction
                const response = await fetch('http://localhost:4000/proxy?url=' + encodeURIComponent(link));

                // Handle the server response
                if (response.ok) {
                    const extractedText = await response.text();
                    console.log('Extracted text:', extractedText);

                    // Chunk the extracted text
                    const chunkedText = chunkText(extractedText, MAX_CHUNK_SIZE, overlapSize);

                    // Fetch embeddings for the chunked text
                    const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

                    // Store the embeddings in the database along with the extracted text
                    await storeEmbeddingsAndChunksInDatabase(link, chunkedText, chunkedEmbeddings);

                    extractButton.textContent = "Extracted";
                } else {
                    console.error('Failed to extract text:', response.statusText);
                    extractButton.textContent = "Extract Failed";
                    alert("Failed to connect to the local server. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
                }
            } catch (error) {
                console.error('Error during extraction:', error);
                extractButton.textContent = "Extract Failed";
                alert("An error occurred during extraction. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
            } finally {
                // Stop the dot animation
                clearInterval(dotInterval);
            }
        }, 500);
    });

    let displayWrapper = document.createElement("div");
    displayWrapper.style.width = "100%";
    displayWrapper.style.height = "100%";
    displayWrapper.style.flexGrow = "1";
    displayWrapper.style.flexShrink = "1";
    displayWrapper.style.display = "none";
    displayWrapper.style.boxSizing = "border-box";

    let displayButton = document.createElement("button");
    displayButton.textContent = "Display Webpage";
    displayButton.classList.add("linkbuttons");

    displayButton.addEventListener("click", async function () {

        let displayIframe = displayWrapper.querySelector("iframe");

        if (displayIframe) {
            displayIframe.remove();
            displayButton.textContent = "Display Webpage";
            displayWrapper.style.display = "none";
            linkWrapper.style.display = "block";
        } else {
            // Iframe does not exist, so fetch the webpage content and create it
            const response = await fetch('http://localhost:4000/raw-proxy?url=' + encodeURIComponent(link));

            if (response.ok) {
                const webpageContent = await response.text();

                displayIframe = document.createElement("iframe");
                displayIframe.srcdoc = webpageContent;
                displayIframe.style.width = "100%";
                displayIframe.style.height = "100%";
                displayIframe.style.overflow = "auto";

                displayIframe.addEventListener("load", () => {
                    const buttonHeight = button.offsetHeight + displayButton.offsetHeight + extractButton.offsetHeight;
                    const minHeight = displayIframe.offsetHeight + buttonHeight + 35;
                    const currentHeight = parseInt(windowDiv.style.height, 10);

                    if (currentHeight < minHeight) {
                        windowDiv.style.height = `${minHeight}px`;
                    }
                });

                displayWrapper.appendChild(displayIframe);
                displayButton.textContent = "Close Webpage";
                displayWrapper.style.display = "block";
                linkWrapper.style.display = "none";

                let availableHeight = windowDiv.offsetHeight - buttonsWrapper.offsetHeight;
                displayWrapper.style.height = availableHeight + 'px';
            } else {
                console.error('Failed to fetch webpage content:', response.statusText);
                alert("An error occurred displaying the webpage through a proxy server. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
            }
        }
    });


    let node = addNodeAtNaturalScale(name, []);
    let windowDiv = node.content.querySelector(".window");

    let buttonsWrapper = document.createElement("div");
    buttonsWrapper.classList.add("buttons-wrapper");
    buttonsWrapper.style.order = "1";
    buttonsWrapper.appendChild(button);
    buttonsWrapper.appendChild(displayButton);
    buttonsWrapper.appendChild(extractButton);

    let contentWrapper = document.createElement("div");
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "column";
    contentWrapper.style.alignItems = "center";
    contentWrapper.style.height = "100%";

    contentWrapper.appendChild(linkWrapper);
    contentWrapper.appendChild(iframeWrapper);
    contentWrapper.appendChild(displayWrapper);
    contentWrapper.appendChild(buttonsWrapper);

    windowDiv.appendChild(contentWrapper);

    let minWidth = Math.max(linkWrapper.offsetWidth, contentWrapper.offsetWidth) + 5;
    let minHeight = Math.max(linkWrapper.offsetHeight, contentWrapper.offsetHeight) + 35;
    windowDiv.style.width = minWidth + "px";
    windowDiv.style.height = minHeight + "px";

    // Initialize the resize observer
    observeContentResize(windowDiv, iframeWrapper, displayWrapper);

    return node;
}

function observeContentResize(windowDiv, iframeWrapper, displayWrapper) {
    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const {
                width,
                height
            } = entry.contentRect;

            // Find the buttonsWrapper inside windowDiv
            const buttonsWrapper = windowDiv.querySelector(".buttons-wrapper");

            if (buttonsWrapper) {
                // Calculate the available height for the iframes
                let buttonsHeight = buttonsWrapper.offsetHeight || 0;
                let iframeHeight = Math.max(0, height - buttonsHeight - 50); // Subtract additional margin

                // Update the width and height of iframeWrapper and displayWrapper
                iframeWrapper.style.width = width + "px";
                iframeWrapper.style.height = iframeHeight + "px";
                displayWrapper.style.width = width + "px";
                displayWrapper.style.height = iframeHeight + "px";
            }
        }
    });

    resizeObserver.observe(windowDiv);
}

function createLinkElement(link, text) {
    const linkWrapper = document.createElement("div");
    linkWrapper.style.width = "300px";
    const a = document.createElement("a");
    a.setAttribute("href", link);
    a.setAttribute("target", "_blank");
    a.textContent = text;
    a.setAttribute("style", "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap;");
    linkWrapper.appendChild(a);
    return linkWrapper;
}

function displaySearchResults(searchResults) {
    searchResults.forEach((result, index) => {
        let title = `${result.title}`;
        let description = result.description.substring(0, 500) + "...";
        let link = result.link;

        let node = createLinkNode(title, description, link);

        htmlnodes_parent.appendChild(node.content);
        registernode(node);
        // Attach the node to the user's mouse
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
    });
}