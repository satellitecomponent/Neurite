# `Neurite`
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)

https://github.com/satellitecomponent/Neurite/assets/129367899/d8d375c2-9274-4176-ac6b-b9a3bf4329d8


## `Introduction`

💡 **[Neurite](https://satellitecomponent.github.io/Neurite/) unleashes a new dimension of digital interface...**

**...the fractal dimension...**

## Bridging Fractals and Thought

Drawing inspiration from chaos theory, Neurite unveils the hidden patterns and intricate interconnections that shape the fabric of creative thinking. Within our virtually limitless fractal workspace, we blend the mesmerizing complexity of the Mandelbrot set with contemporary mind-mapping technique.  Nodes, each encompassing text, images, videos, code snippets, or AI agents — all interact in a dynamic, self-similar tapestry of thought.

### `Complexity Inspires Creativity`
Whether you're a researcher, writer, developer, innovator, educator, or simply a curious thinker, Neurite offers a departure from the conventional interface. It provides a multifaceted landscape for complex thinking, stimulating your creative exploration through ever-branching fractal pathways.

### **Available through Github Pages:** [Neurite](https://satellitecomponent.github.io/Neurite/)
⚠️ `Warning:` Contains zooming, flashing lights, and colors which may not currently be suitable for people with photosensitive epilepsy.


See the User Guide for instructions on running locally


🌱 This is an open-source project in active development, we are looking to grow our team! 🚧

feel free to join our [Discord](https://discord.gg/hnY8UpeE22)!
## `Table of Contents`

1. [Introduction](#introduction)
2. [How to Use Neurite](#how-to-use-neurite)
3. [FractalGPT](#fractalgpt)
4. [Local Ai](#local-ai)
5. [User Guide](#user-guide)
6. [Local Server Setup](#local-server-setup)
7. [Future of Neurite](#future-of-neurite)
8. [Contact](#contact)

## `How to Use Neurite`

### 📚 [Neurite](https://satellitecomponent.github.io/Neurite/) lets you embed anything - text, photos, audio, video, PDFs, or i-frame content - directly into the Mandelbrot set. 

Drag and drop local files or web content straight into the fractal.

Supports embedded links. Ctrl+V to paste an embed link, or not embeddded links will be converted.

### `Controls`
  *Full controls are listed in the ? tab.

`Shift + double click` to create nodes.

`Shift` to freeze nodes.

`Double click` to anchor node.

`Hold Shift + click` two nodes to connect.
 
`Alt + double click` to create an Ai node.

Or, drag in different node types from the dropdown.


## FractalGPT

### `Not your typical chat interface`
- **Web of Thought Reasoning:** Engage with non-linear, rhizomatic memory.
- **Limitless AI Agents:** Create an endless number of chat interfaces, or let the AI take notes from above.
- **Fractal Interface:** Immerse yourself in learning within a captivating fractal landscape.
- **Custom Tool Creation:** Craft personalized tools that resonate with your intellectual pursuits.

### `Modular Conversation`

In Neurite, you don't just interact with AI; you grow its contextual memory, thanks to:

- **Structured Memory Mapping:** Anchor the AI's evolving thought process as notes within an evolving fractal mind map.
- **Enhanced AI Response:** Segment AI's output into a cohesive chain of thought that improves AI reasoning.
- **Interactive Fractal Thought Network:** Utilize our fractal interface to create a personal, emergent, and contextually aware database of knowledge.
- **Intuitive Note Navigation:** Effortlessly access and pull your notes into view, no matter where they are within the fractal landscape.

### `Unbounded AI Exploration`
An open world generative landscape for thought integrated with cutting edge artificial intelligence.

Connect to the AI using an OpenAI API key or from directly within your browser via [webLLM](https://mlc.ai/web-llm/). Let the Mandelbrot set shape the endless topology for your mind-map, guiding it into an interconnected tapestry of thoughts, references, and creativity.

https://github.com/satellitecomponent/Neurite/assets/129367899/ddcfe933-84d1-422d-98b5-adb291c2f6f8


### Neurite Supports the Following AI Plugins:

- **Auto Mode**: Enable the AI to recursively generate its own prompts.
- **Node-Based Memory**: Utilize long-term recall through our vector-embedded search of your notes and conversation. (Experimental forgetting mode in the ? tab)
- **Direct Rendering Environments**:
  - **HTML/JS**: Render GPT's code output directly. Connected nodes bundle together any HTML/CSS/JS codeblocks or editors.
  - **Python ([Pyodide](https://github.com/pyodide/pyodide))**: Execute Python code directly within the browser.
- **Web Search**: Utilize the Google programmable search API to retrieve webpages that can be sent as context to the AI.
- **Webpage and PDF Text Extraction**: Leverage a local vector database to extend the AI's context window.
- **Wikipedia Results**: Retrieve the top 3 Wikipedia results or shuffle through the top 20.
- **Wolfram Alpha Results**: Experience our unique implementation of integrating Wolfram with AI.

All API keys can be input through the AI tab in the menu dropdown.

## `Local Ai`

https://github.com/satellitecomponent/Neurite/assets/129367899/3c26c9bb-5caa-40f8-bdb9-9d20e8e30bde

Above is an example of conversation history being shared between GPT-4 and a Local Ai model, Red Pajamas, run through [webLLM](https://mlc.ai/web-llm/).

### Ai Nodes allow for the creation of an arbitrary number of Ai Agents with the ability to connect memories together.
- `Alt + Double click` creates a node with a more traditional AI chat interface. (you can create multiple)
- The AI node will retain context from any other text or AI nodes that connect to it. (`Hold Shift and Click` two node windows to connect them together)
- This means the ability to inteface multiple chat wimdows together, and the ability to retain textual memories without having to re-copy and re-paste them every time.
- Supports webLLM and OpenAi models concurrently.

### [Neurite](https://satellitecomponent.github.io/Neurite/) currently supports OpenAi, Red Pajamas 3B, and Vicuna 7B.
- webLLM runs Ai models directly in browser on the GPU or CPU.
- We are also running an embeddings model locally through [Transformers.js](https://www.npmjs.com/package/@xenova/transformers) for local webpage/pdf extraction.
- This is an early implementation.

See [webLLM's](https://mlc.ai/web-llm/) documentation for how to run the models on your GPU.

https://github.com/satellitecomponent/Neurite/assets/129367899/3174af42-3f8c-44a3-8402-8c38a84eb3b1

Above is an example of combining the Wolfram Alpha API with GPT-4. 

Wolfram, Wikipedia, and Webpage/PDF vector database plugins are accessed through the localhost servers.
## `User Guide`
### To run Neurite locally,
either:  
1. Clone the repository  
2. Open the index.html file in your browser (note: local AI features will not be enabled)  

Or, to enable local AI features without using our Github pages host above:  
1. Navigate to the cloned directory in your terminal (either main or local-ai branch)
2. Install any necessary global dependencies when running the below, (Node.js, Rust, Embscripten, Strawberry Perl, Vite)

```
npm install
npm run build
npm run start
```

## `Local Server Setup`

### Download Localhost Servers [here](https://minhaskamal.github.io/DownGit/#/home?url=https://github.com/satellitecomponent/Neurite/tree/main/Localhost%20Servers).

### The servers enable plugin integration for webpage/pdf text extraction, Wolfram Alpha, and Wikipedia.
- Our Wikipedia, Wolfram, and web scrape servers require Python and Node.js
- Without any servers running, Wolfram, Wiki, and Webpage extractions will not function.
- All servers can be run with one command. Download the Localhost Servers folder, or find it in your cloned directory. Once navigated to the Localhost Servers folder in your command line, run
```
  node start_servers.js
```
This will run all of the servers at once. They'll work on our Github pages host of Neurite, or any other way you locally access the interface.

In the '?' tab, the AI HOW-TO checkbox will send a context message to the AI that allows it to answer questions about Neurite.


### `Notes`
- Search: Enter a search query to locate windows containing that text. The search results display to the left of the menu. Click on a search result to zoom your view to where the corresponding window is positioned within the fractal.
- Saving: Saving is currently a work-in-progress. Your networks will can be saved in the browser cache, or downloaded as a .txt file. Drag the .txt file into the save box, click load on the imported file in the save box, then click the second load button to display the network. Non-textual content currently needs to be re-inserted.
- Zettelkasten: The Zettelkasten method enables nodes to be created by typing into the main text area. The AI follows this format to create and connect its response.

The Zettelkasten note taking method accesses tapestry of thought reasoning for Ai, all within our innovate real-time Mandelbrot visualization.


![Aidiagram2_1 2 1](https://github.com/satellitecomponent/Neurite/assets/129367899/68310e74-7a2c-49a8-a377-1d245c5e938e)
- This diagram represents how the AI's response incorperates note-taking to retain a non-linear conversation history.
- We feed both the recent conversation as well as any matched notes that are not already in the recent conversation as part of the context message to the Ai.
- This means retaining relevant information from any part of the conversation regardless of the Ai's context window size.
- Still, advancements in context window size only further enable Neurite's performance.

## `Future of Neurite`


### [Neurite](https://satellitecomponent.github.io/Neurite/) is a recursive environment for generating ideas. The project combines fractals, mind-mapping, and ai to enable an experimental, yet powerful playground for research, code generation, writing, learning, and visualizing thought.

🚧 `Neurite is in active development.` 🚧 

✅ webLLM 

🔄 python LLM localhost

✅ local embeddings 
- VR
- deeper fractal zoom

🔄 Ai cursor control
  
✅ color selection

✅ adjust width, length, max lines, speed

✅ screen recording

🔄 accessibility

✅ auto embed formats

- custom equations for the fractal
- drawing-tool

🔄 user feedback/bug fixes

🚧


## `Contact`

If you are a developer who is interested in contributing to this project, contact us at contactdendrite@gmail.com or visit our  [discord](https://discord.gg/hnY8UpeE22) 🔗

![Neuritereadme4fps360](https://github.com/satellitecomponent/Neurite/assets/129367899/87816cad-1151-4f1a-8c66-ba5a5bd0b81e)
full video [here](https://youtu.be/1VmE_Bov-Xw)
![Screenshot 2023-06-16 221906](https://github.com/satellitecomponent/Neurite/assets/129367899/e77b2866-db77-41e9-ba08-e55d29f77404)
