![Screenshot 2023-06-16 221906](https://github.com/satellitecomponent/Neurite/assets/129367899/e77b2866-db77-41e9-ba08-e55d29f77404)

# Neurite

⚠️ Warning: Neurite contains zooming, flashing lights, and colors which may not be suitable for people with photosensitive epilepsy.

**Available here:** [Neurite](https://satellitecomponent.github.io/Neurite/)

## Table of Contents

1. [Introduction](#introduction)
2. [How to Use Neurite](#how-to-use-neurite)
3. [FractalGPT](#fractalgpt)
4. [Local Ai](#local-ai)
5. [Local Server Setup](#local-server-setup)
6. [User Guide](#user-guide)
7. [Future of Neurite](#future-of-neurite)
8. [Contact](#contact)

## Introduction


💡 **Neurite unleashes a new dimension of digital interface...**


**...the fractal dimension.**


🌱 This is an open-source project in early alpha, we are looking to grow our team! 🚧

join us on [discord](https://discord.gg/hnY8UpeE22)!

## How to Use Neurite

📚 [Neurite](https://satellitecomponent.github.io/Neurite/) lets you embed anything - text, photos, audio, video, PDFs, or i-frame content - onto a rendering of the Mandelbrot set. You can either drag and drop files from your local system or paste embed links straight onto the fractal. Make sure to use an embed link.

The controls are listed in the ? tab.


Shift + double click to create nodes.

Shift to freeze nodes.

Double click nodes to anchor.

Shift + click nodes to connect.


## FractalGPT
🕸️🕷️

**Not your typical chat interface.**
- Web of thought reasoning.

Mind mapping through Neurite enables long-term memory for LLMs. 

To interact with the AI, you will need an OpenAi API key. (webLLM support currently on the dev branch.)

- The LLM’s responses format themselves into notes and connections within the fractal mind map, leading to an emergent graph structure that represents the AI’s memory.
- Breaking up the AI's output into a chain of thought reasoning is one of a number of methods that correlate to improved Ai response.
- Mind mapping combined with a fractal interface goes beyond chain of thought reasoning to produce a fractal web of thought.
- A Zettelkasten parsing method combined with vector embedding search allows for arbitrary time-distance memory. (Long term memory for conversation with Ai)
- The Mandelbrot set acts as the terrain for your mind-map to grow into an interconnected tapestry.


Neurite currently enables the following Ai capabilities.

1. Auto Mode
2. Node based memory combined with vector embed retrieval enables long term conversation memory for LLMs.
3. HTML/JS and In-browser Python (pyodide) environment for directly rendering GPT's code output.
4. Web Search (requires Google programmable search api key and search engine id)
(to search without an API key, send a url within the prompt input and the webpage will display without going through Google.)
5. Webpage and PDF text extraction. 
6. Wikipedia Summaries (Requires setting up the 'wiki-server' found in the repo)
7. Wolfram Alpha Results. (Requires an API key and setting up the 'wolfram-server' in the repo)

All API keys can be input through the Ai tab of the menu dropdown.



## Local Ai
![Screenshot 2023-07-06 101637](https://github.com/satellitecomponent/Neurite/assets/129367899/4705ddbd-5b20-4e8b-b18e-d8c33ff93a69)
Above is an example of conversation history being shared between GPT-3.5-turbo and a Local Ai model, Red Pajamas, run through [webLLM](https://mlc.ai/web-llm/).
- Alt + Double click creates a node with a more traditional AI chat interface. (you can create multiple)
- The AI node will retain context from any other text or AI nodes that connect to it.
- This means the ability to connect multiple chat interfaces together, and the ability to retain textual memories without having to re-copy and re-paste them every time.
- Supports webLLM and OpenAi models concurrently.

[Neurite](https://satellitecomponent.github.io/Neurite/) currently supports Red Pajamas 3B, and Vicuna 7B.
- webLLM runs Ai models directly in browser on the GPU or CPU.
- We are also running an embeddings model locally through [Transformers.js](https://www.npmjs.com/package/@xenova/transformers) for local webpage/pdf extraction.
- This is an early implementation.

See [webLLM's](https://mlc.ai/web-llm/) documentation for how to run the models on your GPU.

## Local Server Setup

Download Localhost Servers [here](https://minhaskamal.github.io/DownGit/#/home?url=https://github.com/satellitecomponent/Neurite/tree/main/Localhost%20Servers) through Downgit.io 

The servers enable webpage/pdf text extraction, Wolfram Alpha (api key required), and Wikipedia.
- The Wikipedia, Wolfram, and web scrape servers require Python and Node.js
- The readme in the Locahost Servers folder explains how to run all of the servers at once.
- Without any servers running, Wolfram, Wiki, and Webpage extractions will not function.
- All servers can be run with one command. Download the Localhost Servers folder, or find it in your cloned directory. Once navigated to the Localhost Servers folder in your command line, run node start_servers.js. This will run all of the servers at once. The servers work with our Github pages host of Neurite, or any other way you locally access the interface.

In the '?' tab, the AI HOW-TO checkbox will send a context message to the AI that allows it to answer questions about Neurite.

## User Guide
- Search: Enter a search query to locate windows containing that text. A list of search results will display to the left of the menu. Click on a search result to zoom your view window to where the window is positioned and scaled within the Mandelbrot set (fractal).
- Saving: Saving is currently a work-in-progress. Text windows and connections between windows can be saved via the Save tab. Non-textual content currently needs to be re-inserted.
- Zettelkasten: The Zettelkasten method enables nodes to be created by typing into the main text area. The AI follows this format to create and connect its responses together. This allows for a tree of thought reasoning process within the Mandelbrot set.


![Aidiagram2_1 2 1](https://github.com/satellitecomponent/Neurite/assets/129367899/68310e74-7a2c-49a8-a377-1d245c5e938e)
- This diagram represents how the AI's response incorperates note-taking to retain a non-linear conversation history.
- We feed both the recent conversation as well as any matched notes that are not already in the recent conversation as part of the context message to the Ai.
- This means retaining relevant information from any part of the conversation regardless of the Ai's context window size.
- Still, advancements in context window size only further enable Neurite's performance.

## Future of Neurite


[Neurite](https://satellitecomponent.github.io/Neurite/) is a recursive environment for generating ideas. As we are in the middle of a rapid acceleration in AI development, new tools to visualize and organize information are ever more necessary. This project is an experimental approach to this emergent technological landscape.

🚧 
✅ webLLM 
- webLLM localhost
✅ local embeddings 
- VR
- deeper zoom
- improved fractal integration/visualization
- color selection
- customizability/accessibility
- auto embed formats
- custom equations for the fractal
- drawing-tool
- user feedback/bug fixes

🚧


## Contact

If you are a developer who is interested in contributing to this project, contact us at contactdendrite@gmail.com or visit our  [discord](https://discord.gg/hnY8UpeE22) 🔗
