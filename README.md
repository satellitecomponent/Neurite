![Screenshot 2023-06-16 221906](https://github.com/satellitecomponent/Neurite/assets/129367899/e77b2866-db77-41e9-ba08-e55d29f77404)
# Neurite

⚠️ Warning: Neurite contains zooming, flashing lights, and colors which may not be suitable for people with photosensitive epilepsy.

**Available here:** [Neurite](https://satellitecomponent.github.io/Neurite/)

## Table of Contents

1. [Introduction](#introduction)
2. [How to Use Neurite](#how-to-use-neurite)
3. [FractalGPT](#fractalgpt)
4. [Local Server Setup](#local-server-setup)
5. [User Guide](#user-guide)
6. [Future of Neurite](#future-of-neurite)
7. [Contact](#contact)

## Introduction


💡 Neurite unleashes a new dimension of digital interfacing... 


...the fractal dimension....


🌱 this is an open-source project in early alpha, we are looking to grow our team! 🚧

join us on [discord](https://discord.gg/hnY8UpeE22)!

## How to Use Neurite

📚 Neurite lets you embed anything - text, photos, audio, video, PDFs, or i-frame content - onto a rendering of the Mandelbrot set. You can either drag and drop files from your local system or paste embed links straight onto the fractal. Make sure to use an embed link.

The controls are listed in the ? tab. Shift + double click to create nodes.

(Dragging nodes can require some practice. Make sure to drag nodes by clicking on the actual window element outside of the textarea or buttons. Hold shift to freeze all nodes, and double click to anchor)

## FractalGP
🕸️🕷️

- Not your typical chat interface.
- Web of thought reasoning.

Mind mapping through Neurite enables long-term memory for LLMs. 

To interact with the AI, you will need an OpenAi API key. (webLLM support currently on the dev branch.)

- The LLM’s responses format themselves into notes and connections within the fractal mind map, leading to an emergent graph structure that represents the AI’s memory.
- Breaking up the AI's output into a chain of thought reasoning is one of a number of methods that correlate to improved Ai response.
- Mind mapping combined with a fractal interface levels up chain of thought reasoning into a fractal web of thought.
- The Zettelkasten parsing method combined with vector embedding search allows for arbitrary time-distance memory. (Long term memory for notes)
- The Mandelbrot set acts as the terrain for your mind-map to grow into an interconnected tapestry.


The AI currently has the following capabilities... 

1. Auto Mode
2. Node based memory combined with vector embed retrieval for long term conversation memory.
3. HTML/JS and In-browser Python (pyodide) environment for directly rendering GPT's code output.
4. Web Search (requires Google programmable search api key and search engine id)
(to search without an API key, send a url within the prompt input and the webpage will display without going through Google.)
5. Webpage and PDF text extraction. (requires setting up the 'scrape' local-host server found in the repo)
6. Wikipedia Summaries (Requires setting up the 'wiki-server' found in the repo)
7. Wolfram Alpha Results. (Requires an API key and setting up the 'wolfram-server' in the repo)

All API keys can be input through the Ai tab of the menu dropdown.

We have recently included an AI node functionality.
Alt + Double click creates a node with a more traditional AI chat interface. (you can create multiple)
The AI node will retain context from any other text or AI nodes that are connected to it. This means the ability to connect multiple chat interfaces together.

![Aidiagram2_1 2 1](https://github.com/satellitecomponent/Neurite/assets/129367899/68310e74-7a2c-49a8-a377-1d245c5e938e)
- This diagram represents how the AI's response incorperates note-taking to extend its memory context for each user prompt.

## Local Server Setup
- To set up the Wikipedia, Wolfram, and web scrape servers, you will require Python and Node.js. The readme in the Locahost Servers folder explains how to run them all at once.
- Without any servers running, Wolfram, Wiki, and Webpage extractions will not function.
- All servers can be run with one command. Dowload the Locahost Servers folder, or find it in your cloned directory. Once navigated to the Localhost Servers folder in your command line, run node start_servers.js. This will run all of the servers at once. The servers work with our Github pages host of Neurite, or any other way you locally access the interface.

In the '?' tab, the AI HOW-TO checkbox will send a context message to the AI that allows it to answer questions about Neurite.

## User Guide
- Search: Enter a search query to locate windows containing that text. A list of search results will display to the left of the menu. Click on a search result to zoom your view window to where the window is positioned and scaled within the Mandelbrot set (fractal).
- Saving: Saving is currently a work-in-progress. Text windows and connections between windows can be saved via the Settings tab. Non-textual content currently needs to be re-inserted.
- Zettelkasten: The Zettelkasten method enables nodes to be created by typing into the main text area. The AI follows this format to create and connect its responses together. This allows for a tree of thought reasoning process within the Mandelbrot set.

## Future of Neurite


Neurite is a recursive environment for generating ideas. As we are in the middle of a rapid acceleration in AI development, new tools to visualize and organize information are ever more necessary. Neurite is an experimental approach to this newfound technological landscape.

🚧 
- webLLM (see the dev branch)
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
