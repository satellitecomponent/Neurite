# Neurite FAQ

## Concept & Design

#### Q. What is the purpose of the fractal interface?

> Neurite is my attempt to realize a "living" digital garden. More than a trick or some dodgy theory, fractal mathematics underpins countless patterns foundational to the world and our understanding of it. From financial analysis, to fractal antenna, cancer research, and art, there are few disciplines which can escape its influence. Software principled around fractal mathematics is fundamentally committed to iterative development, explorative thinking, and interdisciplinary connection.

#### Q. Is Neurite meant to be a personal knowledge manager, a creative whiteboard, a browser, or something else?

> It's all of the above, and something entirely new... The point isn't to create yet another note-taking app in a sea of clones. Neurite is a creative tool. It enables the creative workflow. The goal is to avoid prescriptive software in order to never feel locked into an interface again.



#### Q. What is the long-term goal or roadmap for Neurite?

> In many ways, Neurite has already grown beyond my original vision. Still, there's an endless array of exciting ideas ahead. Right now, my focus is on documentation and refining the user experience based on community feedback. In the long term, I plan to continue to grow Neurite into a fully fledged creative-suite.

#### Q. Why does Neurite give users so much freedom compared to more constrained Zettelkasten tools?

> Because I’m tired of feeling constrained by the software I use. Too many platforms rely on artificial barriers and manipulative tactics designed to monetize users. I specifically built Neurite to avoid all that.

## AI & Node Logic

#### Q. How does Ai memory work in Neurite?

> Ai memory is specific to which context you are asking questions from. In Neurite, there are three contexts.
1. When prompting an Ai from the Notes tab, it retrieves relevant notes from the current graph. Neurite enables long term memory by allowing the Ai to view notes regardless of when or where they are. It also remembers a short term memory of recent notes in the currently open archive. [Our page on Zettelkasten.](/wiki/zettelkasten/)
2. For Ai nodes, their context is built from their title (name), any custom instructions you've set, their recent chat history, and most importantly, any nodes which are connected to them. This includes text nodes, link nodes, messages from other Ai nodes, and memory nodes which they create during multi-agent chat. [Our page on Ai agents in Neurite.](/wiki/agents/)
3. When talking to an Ai from the Neural API, it is being instructed to write arbitrary code that interacts with Neurite in some way. As a result, the Ai has to be fed documentation related to the internal workings of Neurite, example use of the Neural API, as well as any available telemetry from the current fractal and graph state. The Ai also has access a few of the most recent task executions and their associated logs/errors. [Our page on the Neural API.](/wiki/neural-api/)

#### Q. Can I attach files or text to AI nodes?

> Attaching a link node to an Ai node allows the Ai to read the link's text. If the document is not already in your vector database, Neurite will ask you to confirm the import for that link or pdf, then continue with the prompt to the Ai. Text nodes are directly sent in full.

#### Q. How do I get the Ai to read documents in my vector database?

> Either connect a link node to an ai node, or check the data checkbox found in the context section of the Ai tab for the Notes Ai, or the settings panel for an Ai node. When using the data checkbox, the Ai will read all documents that have their visibility icon enabled. Find the list of documents in your vector store and toggle their visibility by clicking the "vector-db" button in the Ai tab context section.

#### Q. Can AI agents guide conversations between other agents?

> Neurite functions as a multi-agent chat interface. To create a team of agents, or any conversation context, create and connect multiple Ai nodes. They will send messages to one another after an initial prompt to a single connected Ai node.

#### Q. Is Neurite good for long-form writing with context?

> Part of the reason I built Neurite was to have an agentic memory architecture I knew I could trust both inside and out. Memory and visualized context management is something I still find to be lacking in many of today's Ai systems. Neurite's graph based approach builds more meaningful and persistent context by not letting you get lost in the linear scroll of a traditional chat interface. Instead, Neurite helps you build a non-linear approach to context management for Ai.

## Interface & Navigation

#### Q. Can I turn off fractal zoom or use a flat layout?

> The Julia set fractal has no physics simulation, and turning max-lines to 0, or the exponent to 1 will disable any lines from visually generating. Soon a gravity slider and fractal off option will be included.

#### Q. How do I find offscreen or missing nodes?

> The magnifying glass icon in the Notes tab searches through any notes in the current graph. Clicking on search results or highlighted note titles will zoom your view to their location within the graph.

#### Q. How do I interact with nodes?

> See the [controls guide](/wiki/controls/).

## Setup & Storage

#### Q. How do I run Neurite locally?

> [Neurite Desktop](/wiki/neurite-desktop/)

#### Q. How do I connect to OpenAi, Anthropic, Groq, or local models like Ollama or GPT4All etc.?

> Neurite acts as an interface for any OpenAi compatible endpoint. To use cloud hosted models API keys can be set as an environment variable or through the Ai tab in the API dropdown. The `.env` file is found at `localhost_servers/ai-proxy/.env`

#### Q. What are the Localhost Servers?

> They are a number of node.js servers essential to Neurite's complete functionality. Think of it as a growing collection of APIs, Databases, Proxies, and Model Context Protocols that run alongside Neurite. The desktop version manages and updates them for you (on desktop localhost_servers is found in `appdata/roaming/neurite-electron/servers/`). You may still want to run the servers manually, for example when using [neurite.network](https://neurite.network).

#### Q. Where is my data stored?

> Neurite saves as a downloadable graph. Click "save as..." then click  "↓ (down arrow)" to download the graph as a text file. Each save includes your graph data as well as any fractal configuration.

#### Q. Where is my vector database stored?

> The vector DB itself (`database.db`) is stored inside the Localhost Servers at:  
`localhost_servers/webscrape/database.db`  
Currently, it persists independently of the saved graphs.

## Integration & Workflow

#### Q. How do I import notes from Obsidian or other PKMs?

> Open the web based version of your PKM as a link node within Neurite. Otherwise, drag files from your filesystem, or from within a file node in Neurite.

#### Q. Where can I find docs or community support?

> Visit [our about page](/wiki/about/), or join our [Discord](https://discord.gg/NymeSwK9TH).

