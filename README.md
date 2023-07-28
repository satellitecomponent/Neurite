⚠️ Warning: Contains zooming, flashing lights, and colors which may not currently be suitable for people with photosensitive epilepsy.
# Neurite

https://github.com/satellitecomponent/Neurite/assets/129367899/d8d375c2-9274-4176-ac6b-b9a3bf4329d8



## Introduction


💡 **Neurite unleashes a new dimension of digital interface...**


**...the fractal dimension.**




### **Available through Github Pages:** [Neurite](https://satellitecomponent.github.io/Neurite/)

See User Guide for instructions on running locally


🌱 This is an open-source project in early alpha, we are looking to grow our team! 🚧

feel free to visit our [Discord](https://discord.gg/hnY8UpeE22)!
## Table of Contents

1. [Introduction](#introduction)
2. [How to Use Neurite](#how-to-use-neurite)
3. [FractalGPT](#fractalgpt)
4. [Local Ai](#local-ai)
5. [Local Server Setup](#local-server-setup)
6. [User Guide](#user-guide)
7. [Future of Neurite](#future-of-neurite)
8. [Contact](#contact)

## How to Use Neurite

### 📚 [Neurite](https://satellitecomponent.github.io/Neurite/) lets you embed anything - text, photos, audio, video, PDFs, or i-frame content - into the Mandelbrot set. 

Drag and drop local files or web content straight into the fractal 

Supports embedded links. Ctrl+V to paste an embed link

### Controls
  *Full controls are listed in the ? tab.

**Shift + double click** to create nodes.

**Shift** to freeze nodes.

**Double click** to anchor node.

**Hold Shift + click** two nodes to connect.


## FractalGPT

### **Not your typical chat interface.**
- Web of thought reasoning.

### Mind mapping through Neurite enables long-term memory for LLMs. 

To interact with the AI, you will need an OpenAi API key, or you can install a local Ai directly in browser!

- The LLM’s responses format themselves into notes and connections within the fractal mind map, leading to an emergent graph structure that represents the AI’s memory.
- Breaking up the AI's output into a chain of thought reasoning is one of a number of methods that correlate to improved Ai response.
- Mind mapping combined with a fractal interface goes beyond chain of thought reasoning to produce an interactive fractal web of thought.
- Our Zettelkasten parsing method combined with vector embedding search allows for arbitrary time-distance memory. (Long term memory for conversation with Ai)
- The Mandelbrot set acts as the terrain for your mind-map to grow into an interconnected tapestry of multimedia!

https://github.com/satellitecomponent/Neurite/assets/129367899/ddcfe933-84d1-422d-98b5-adb291c2f6f8


### Neurite supports the following Ai features

1. Auto Mode
2. Node based memory combined with vector embed retrieval that enables long term conversation memory for LLMs.
3. HTML/JS and In-browser Python (pyodide) environment for directly rendering GPT's code output.
4. Web Search (requires Google programmable search api key and search engine id)
(to search without an API key, send a url within the prompt input and the webpage will display without going through Google.)
5. Webpage and PDF text extraction. 
6. Wikipedia Summaries (Requires setting up the 'wiki-server' found in the repo)
7. Wolfram Alpha Results. (Requires an API key and setting up the 'wolfram-server' in the repo)

All API keys can be input through the Ai tab of the menu dropdown.

## Local Ai

https://github.com/satellitecomponent/Neurite/assets/129367899/3c26c9bb-5caa-40f8-bdb9-9d20e8e30bde

Above is an example of conversation history being shared between GPT-4 and a Local Ai model, Red Pajamas, run through [webLLM](https://mlc.ai/web-llm/).

### Ai Nodes allow for the creation of an arbitrary number of Ai Agents that can connect together.
- **Alt + Double click** creates a node with a more traditional AI chat interface. (you can create multiple)
- The AI node will retain context from any other text or AI nodes that connect to it. (**Hold Shift + Click** two node windows to connect them together)
- This means the ability to connect multiple chat interfaces together, and the ability to retain textual memories without having to re-copy and re-paste them every time.
- Supports webLLM and OpenAi models concurrently.

### [Neurite](https://satellitecomponent.github.io/Neurite/) currently supports OpenAi, Red Pajamas 3B, and Vicuna 7B.
- webLLM runs Ai models directly in browser on the GPU or CPU.
- We are also running an embeddings model locally through [Transformers.js](https://www.npmjs.com/package/@xenova/transformers) for local webpage/pdf extraction.
- This is an early implementation.

See [webLLM's](https://mlc.ai/web-llm/) documentation for how to run the models on your GPU.

## Local Server Setup

### Download Localhost Servers [here](https://minhaskamal.github.io/DownGit/#/home?url=https://github.com/satellitecomponent/Neurite/tree/main/Localhost%20Servers).

### The servers enable plugin integration for webpage/pdf text extraction, Wolfram Alpha, and Wikipedia.
- The Wikipedia, Wolfram, and web scrape servers require Python and Node.js
- The readme in the Locahost Servers folder explains how to run all of the servers at once.
- Without any servers running, Wolfram, Wiki, and Webpage extractions will not function.
- All servers can be run with one command. Download the Localhost Servers folder, or find it in your cloned directory. Once navigated to the Localhost Servers folder in your command line, run node start_servers.js. This will run all of the servers at once. The servers work with our Github pages host of Neurite, or any other way you locally access the interface.

In the '?' tab, the AI HOW-TO checkbox will send a context message to the AI that allows it to answer questions about Neurite.


https://github.com/satellitecomponent/Neurite/assets/129367899/3174af42-3f8c-44a3-8402-8c38a84eb3b1

Above is an example of combining the Wolfram Alpha API with GPT-4. 

Wolfram, Wikipedia, and Webpage/PDF vector database plugins are accessed through the localhost servers.
## User Guide
### To run Neurite locally,
either:  
1. Clone the repository  
2. Open the index.html file in your browser (note: local AI features will not be enabled)  

Or, to enable local AI features without using our Github pages host above:  
1. Navigate to the cloned directory in your terminal (either main or local-ai branch)
2. Install any global dependencies if getting errors when running the below,

```
npm install
npm run build
npm run start
```

- Search: Enter a search query to locate windows containing that text. A list of search results will display to the left of the menu. Click on a search result to zoom your view window to where the window is positioned and scaled within the Mandelbrot set (fractal).
- Saving: Saving is currently a work-in-progress. Your networks will can be saved in the browser cache, or downloaded as a .txt file. Drag the .txt file into the save box, click load on the imported file in the save box, then click the second load button to display the network. Non-textual content currently needs to be re-inserted.
- Zettelkasten: The Zettelkasten method enables nodes to be created by typing into the main text area. The AI follows this format to create and connect its responses together. This allows for a tree of thought reasoning process within the Mandelbrot set.


![Aidiagram2_1 2 1](https://github.com/satellitecomponent/Neurite/assets/129367899/68310e74-7a2c-49a8-a377-1d245c5e938e)
- This diagram represents how the AI's response incorperates note-taking to retain a non-linear conversation history.
- We feed both the recent conversation as well as any matched notes that are not already in the recent conversation as part of the context message to the Ai.
- This means retaining relevant information from any part of the conversation regardless of the Ai's context window size.
- Still, advancements in context window size only further enable Neurite's performance.

## Future of Neurite


### [Neurite](https://satellitecomponent.github.io/Neurite/) is a recursive environment for generating ideas. As we are in the middle of a rapid acceleration in AI development, new tools to visualize and organize information are ever more necessary. The project is an experimental attempt to navigate this emergent technological landscape.

🚧

✅ webLLM 
- webLLM localhost

✅ local embeddings 
- VR
- deeper zoom
- improved fractal integration/visualization
  
✅ color selection

✅ adjust width, length, max lines, speed

✅ screen recording
- accessibility
- auto embed formats
- custom equations for the fractal
- drawing-tool
- user feedback/bug fixes

🚧


## Contact

If you are a developer who is interested in contributing to this project, contact us at contactdendrite@gmail.com or visit our  [discord](https://discord.gg/hnY8UpeE22) 🔗

![Neuritereadme4fps360](https://github.com/satellitecomponent/Neurite/assets/129367899/87816cad-1151-4f1a-8c66-ba5a5bd0b81e)
full video [here](https://youtu.be/1VmE_Bov-Xw)
![Screenshot 2023-06-16 221906](https://github.com/satellitecomponent/Neurite/assets/129367899/e77b2866-db77-41e9-ba08-e55d29f77404)
