const wolframmessage = `Based off the user message, arrive at a valid query to Wolfram Alpha.
- Quotation marks delimit the Wolfram Query that is extracted from your response.
- Ensure the query will return a relevant result from Wolfram. (If the user message is not a valid Wolfram Query, reformulate until it is.)
- Utilize Wolfram Syntax or formats known to be valid.
- Display your reasoning.`

let wolframCallCounter = 0;

async function fetchWolfram(message, isAINode = false, node = null, wolframContext = "") {
    let wolframAlphaResult = "not-enabled";
    let wolframAlphaTextResult = "";

    // Initialize recentcontext based on node or default zettelkasten logic
    const recentcontext = wolframContext || getLastPromptsAndResponses(2, 300);

    if (!isAINode) {
        // Increment the Wolfram call counter
        wolframCallCounter++;

        // Insert the tag and unique title to the note-input 
        myCodeMirror.replaceRange(`${tagValues.nodeTag} Wolfram ${wolframCallCounter}\n`, CodeMirror.Pos(myCodeMirror.lastLine()));
    }

    let messages = [
        {
            role: "system",
            content: `${wolframmessage}`
        },
        {
            role: "user",
            content: `${message} Wolfram Query`,
        }
    ];

    // Only add the recentcontext message if it is not empty
    if (recentcontext.trim() !== "") {
        messages.splice(1, 0, {
            role: "system",
            content: `Conversation history; \n ${recentcontext},`
        });
    }

    let fullResponse;
    if (isAINode && node) {
        fullResponse = await callchatLLMnode(messages, node, true);  // calling the LLM node version

        // Add a line break to node.aiResponseDiv after the call is complete
        node.aiResponseDiv.innerHTML += '<br />';
    } else {
        fullResponse = await callchatAPI(messages, true);  // existing call
    }

    // The regular expression to match text between quotation marks
    const regex = /"([^"]*)"/g;

    let reformulatedQuery = "";
    let matches = [];
    let match;

    // While loop to get all matches
    while ((match = regex.exec(fullResponse)) !== null) {
        matches.push(match[1]);
    }

    // Get the last match, i.e., the reformulated query
    if (matches.length > 0) {
        reformulatedQuery = matches[matches.length - 1];
    }
    console.log("reformulated query", reformulatedQuery);
    console.log("matches", matches);
    let preface = fullResponse.replace(`"${reformulatedQuery}"`, "").trim();

    // Append an additional new line
    myCodeMirror.replaceRange(`\n\n`, CodeMirror.Pos(myCodeMirror.lastLine()));

    console.log("Preface:", preface);
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