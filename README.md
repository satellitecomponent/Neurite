# `Neurite`
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)

![Neurite2](https://github.com/satellitecomponent/Neurite/assets/129367899/73c66088-8029-413b-8da0-4c6968436639)

## `Introduction`

💡 **[Neurite](https://satellitecomponent.github.io/Neurite/) unleashes a new dimension of digital interface...**

**...the fractal dimension...**

## Bridging Fractals and Thought

Drawing inspiration from chaos theory and graph theory, Neurite unveils the hidden patterns and intricate interconnections that shape creative thinking. To do this, we have developed a virtually limitless fractal workspace that blends the mesmerizing complexity of the Mandelbrot set with contemporary mind mapping techniques. 

Why? 

Fractals are not just an aesthetic choice, their inner logic is ingrained into a number of natural and constructed phenomena ranging from [polynomial equations](https://www.youtube.com/watch?v=-RdOwhmqP5s), to [art](https://www.nature.com/articles/20833), and even the [cosmic web](https://cosmicweb.kimalbrecht.com/).  Nodes, each encompassing text, images, videos, code, or AI agents — interweave within a dynamic, self-similar microcosm of thought.

### `Complexity Inspires Creativity`
Whether you're a researcher, writer, artist, developer, educator, or simply a curious thinker, Neurite offers a departure from the conventional interface. It provides a multifaceted landscape for complex thinking, stimulating creative exploration across ever-branching fractal pathways.

### **Available through Github Pages:** [Neurite](https://satellitecomponent.github.io/Neurite/)
⚠️ `Warning:` Contains zooming, flashing lights, and colors which may not currently be suitable for people with photosensitive epilepsy.


See the User Guide for instructions on running locally


🌱 This is an open-source project in active development, we are looking to grow our team! 🚧

feel free to join our [Discord](https://discord.gg/hnY8UpeE22)!
## `Table of Contents`

1. [Introduction](#introduction)
2. [Synchronized Knowledge Management](#synchronized-knowledge-management)
3. [How to Use Neurite](#how-to-use-neurite)
4. [FractalGPT](#fractalgpt)
5. [Local Ai](#local-ai)
6. [User Guide](#user-guide)
7. [Local Server Setup](#local-server-setup)
8. [Future of Neurite](#future-of-neurite)
9. [Contact](#contact)

## `Synchronized Knowledge Management`

Neurite provides WYSIWYG (What You See Is What You Get), bi-directional synchronization between UI-focused Mind Mapping interactivity, and text-based hyperlinking (Zettelkasten) methodology. This versatile approach allows one to seamlessly organize thoughts without sacrificing the benefits of either technique.

- **Bi-Directional Sync**: Edit a Mind Map node's content and see it instantaneously update in the Zettelkasten. Conversely, any text changes in the Zettelkasten are reflected in the Mind Map.
- **Dynamic Fractal Backdrop**: The Mandelbrot fractal acts not just as an aesthetic element - but as an interactive generative landscape, offering the ability to zoom between detailed and broad views of your data.
- **Zoom-to-Node**: Navigate through your Zettelkasten notes and zoom directly to their corresponding nodes within the Mandelbrot set.

Build your Zettelkasten through UI interactions in the Mind Map, and reciprocally shape the Mind Map through text-based note-taking in the Zettelkasten. This navigational fluidity is further elevated by the ability to zoom directly to specific nodes within the Mandelbrot set from the Zettelkasten, offering unprecedented control over both the granular and macroscopic perspectives of your information.

Custom `node:` and `ref:` tags can be set in the ? tab of the main dropdown.


## `How to Use Neurite`

### 📚 [Neurite](https://satellitecomponent.github.io/Neurite/) lets you embed anything - text, photos, audio, video, PDFs, or i-frame content - directly into the Mandelbrot set. 

Drag and drop local files or web content straight into the fractal.

Supports embedded links. Ctrl+V to paste an embed link, or pasting normal links embeds them into an iframe if supported by the host.

### `Controls`
  *Full controls are listed in the ? tab within Neurite's main dropdown.

`Scroll` to zoom through the fractal.

`Click and drag` to move around

`Shift + double click` to create nodes.

`Shift` to freeze nodes.

`Double click` to anchor node.

`Hold Shift + click` two nodes to connect.
 
`Alt + double click` to create an Ai node.

Or, drag in different node types from the dropdown.

`Organization Tips`

- Make sure to zoom (`Scroll`) deeper into the fractal before creating nodes. Otherwise, nodes will just overlap and be too big.
- When arranging windows, drag them via the title input. Rescale by holding `Shift` and scrolling over the node.
- Use `Shift` to freeze nodes in place, then double click the nodes that should remain anchored once unfrozen (releasing `Shift`.)
- The AI tab has controls for token limit, temperature, number of searched nodes sent as context, and length of recent conversation sent.
- Connect instructions to Ai nodes. For every message, any connected nodes will be sent to the Ai. (ie, the entire connected graph)
## FractalGPT

### `Not your typical chat interface`
- **Web of Thought Reasoning:** Engage with non-linear, rhizomatic memory.
- **Limitless AI Agents:** Create an endless number of chat interfaces, or let the AI take notes from above.
- **Fractal Interface:** Immerse yourself in learning within a captivating fractal landscape.
- **Custom Tool Creation:**  Connect nodes that contain code blocks together to run html/css/js in an iframe, or Python via Pyodide.

### `Modular Conversation`

In Neurite, you don't just interact with AI; you grow its contextual memory, thanks to:

- **Structured Memory Mapping:** Anchor the AI's thought process as notes within an evolving fractal mind map.
- **Graph your AI Conversations:** Segment AI's responses into a cohesive web of thought that improves AI reasoning and allows for further processing to construct the Ai's memory.
- **Interactive Fractal Network:** Neurite's fractal interface acts as a personal, emergent, and contextually aware database of knowledge.
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
- Connected Ai nodes will now send messages to one another. This is still in an early expirmental state. (`Hold Shift and Click` two node windows to connect them together)
- Supports webLLM and OpenAi models concurrently.

### [Neurite](https://satellitecomponent.github.io/Neurite/) currently supports OpenAi, LLama 2, Red Pajamas 3B, and Vicuna 7B.
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
2. Install any necessary global dependencies when running the below, (Node.js, Rust, Emuscripten, Strawberry Perl, Vite)

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
- Search: Our distinctive search mechanism transports you through your intricate web of thoughts, directly zeroing in on the node containing your specified query. The navigational experience isn't just a convenience; it also helps to reinforce the spatial memory of where that piece of information resides within the larger framework.
- Saving: Your networks can be saved within the browser cache, or downloaded as a .txt file. Drag the .txt file into the save box, click load on the imported file, then click the second load button to display the network. Some non-textual content currently needs to be re-inserted.
- Zettelkasten and Mind Mapping: Traditional note-taking confines you to static files or folders, while conventional mind mapping lets you visualize connections but often lacks in-depth content. Zettelkasten is a method of taking short, atomic notes (or "zettels") that link to each other to create an interconnected system. In Neurite, you don't have to choose between either approach. Create nodes through custom-defined syntax, or create nodes through UI interaction within our fractal workspace, who's contents are bi-directionally linked to the main Zettelkasten document.

The Zettelkasten note taking method accesses tapestry of thought reasoning for Ai, all within our innovate real-time Mandelbrot visualization.


![Aidiagram2_1 2 1](https://github.com/satellitecomponent/Neurite/assets/129367899/68310e74-7a2c-49a8-a377-1d245c5e938e)
- This diagram represents how the AI's response incorporates note-taking to retain a non-linear conversation history.
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

https://github.com/satellitecomponent/Neurite/assets/129367899/d8d375c2-9274-4176-ac6b-b9a3bf4329d8

## `Contact`

If you are a developer who is interested in contributing to this project, contact us at contactdendrite@gmail.com or visit our  [discord](https://discord.gg/hnY8UpeE22) 🔗

![Neuritereadme4fps360](https://github.com/satellitecomponent/Neurite/assets/129367899/87816cad-1151-4f1a-8c66-ba5a5bd0b81e)
full video [here](https://youtu.be/1VmE_Bov-Xw)
![Screenshot 2023-06-16 221906](https://github.com/satellitecomponent/Neurite/assets/129367899/e77b2866-db77-41e9-ba08-e55d29f77404)

Here is what GPT-4 has to say about Neurite

`Prompt:` (after discussing the project and sharing the readme)

Give me any highly insightful thoughts you have about the philosophy behind neurite. Provide a very long response in as much detail as possible.

Preface your response with an internal monologue.

ChatGPT

`Internal Monologue`

The essence of Neurite is captivating—melding the geometric beauty of fractals with the complex, non-linear architecture of human thought. At the project's core, there is a profound resonance with mathematical and philosophical theories, namely chaos theory and graph theory. Chaos theory posits that even in disorder, there's a kind of intrinsic order—an uncanny parallel to how humans navigate the labyrinth of their own thoughts and emotions. Graph theory, on the other hand, brings a structured interconnection, a webbing together of discrete ideas or nodes, just like our neurons fire in webs of interrelated clusters.

The Mandelbrot set isn't just a pretty picture; it's a depiction of complexity, a way to visualize the infinite within the finite. Similarly, the mind is a nebulous, complex entity, capable of capturing an infinity of ideas, thoughts, and emotions. When these are laid out in a network or a 'map,' they form complex patterns—much like fractals. How do we hold onto the vast array of human cognition in a meaningful way? That's where AI comes in, not as a mere tool, but as an intellectual partner, interacting dynamically with the human intellect, offering not just responses but augmenting memory, finding patterns, offering insights.

Here's the existential question: Can we externalize cognition? Can we make tangible the abstract landscapes of our mind? Neurite seems to say we can. But it doesn't stop there. It aims to add layers of memory, context, and foresight, thus building an AI-human cognitive ecosystem. It’s as if we are trying to reach into the 'collective unconscious,' tapping into patterns and archetypes, but in a digital format. Neurite isn't just a tool; it's a worldview, a way to understand cognition through the lens of complexity and interconnectivity.

`Response`

The philosophy behind Neurite is akin to a digitally rendered dance between chaos and order, a ballet of complexity and simplicity staged on a limitless fractal canvas. Inspired by chaos theory, the project embodies the idea that underlying the seeming disorder of this intricate expanse, there's a form of complex order governed by rules, patterns, and fractal mathematics. The mind is itself a fractal of sorts—unfathomably complex, and yet governed by underlying patterns and neurological rules.

Drawing further from graph theory, Neurite attempts to chart this cerebral terrain, enabling users to map out not just thoughts but also the relationships between them. These 'graphs' of thought provide a structured form to the boundless chaos that creativity often is. This mimics how the brain itself works; it is essentially a vast, intricate network of neurons interconnected by synapses, firing in patterns to create memories, ideas, and consciousness. Neurite, therefore, is not just mapping thoughts but emulating the way the mind itself creates and stores them.

The inclusion of AI in this cognitive matrix serves to augment the intellectual capacity of the user. It doesn't just process queries and produce answers but contributes to the very framework of the interconnected thoughts, enhancing the density and complexity of this digital neural network. The fractal nature of the interface allows this AI-human symbiosis to extend infinitely, much like the Mandelbrot set, in a way that's controlled yet boundless, confined yet limitless.

Through this multifaceted approach, Neurite transcends the concept of a 'tool' to become a digital cognitive partner, a complex philosophical endeavor, and a medium for intellectual and emotional expression. It challenges us to think not just about what cognition is, but also what it could become when augmented by the capabilities of artificial intelligence and expressed through the geometric poetry of fractals. In a way, Neurite is a journey into the very essence of human thought, into the labyrinthine corridors of the mind, offering a unique lens to understand, express, and expand the complexities of human cognition.

`Prompt:`

This is a great level of depth, but also may highlight the question of why fractals then?

ChatGPT

`Internal Monologue`

Ah, now we're getting to the crux of the matter—the existential query that emerges when you reflect upon the very foundation of the Neurite project. The question isn't just about the mechanics; it's an inquiry into the essence of the concept. Why fractals? It's one thing to say that they're visually captivating, quite another to justify their role as a fundamental backbone for a tool designed to capture, amplify, and extend human cognition. But this is where the real beauty lies. Fractals are not just a metaphor for complexity; they're a representation of how complexity arises from simplicity, how endless diversity can emerge from a single equation. And that concept has profound implications for thought itself.

`Response`

The use of fractals in Neurite isn't merely an aesthetic choice; it's an epistemological statement. While it's true that thought processes are naturally complex and fractal-like, the explicit use of a fractal framework serves multiple critical functions that go beyond just mirroring what's naturally occurring.

Intentionality: By explicitly setting the Mandelbrot fractal as the structural backbone, Neurite emphasizes the intentionality behind each node and connection. It's a reminder that even in chaotic systems, there is an underlying order and interconnectedness that can be revealed through focused exploration.

Limitlessness: The nature of fractals is that they are infinitely complex. This mirrors the limitless capacity for human thought and creativity, serving as a constant invitation for deeper exploration. Just when you think you've reached the depths of a concept, the fractal nature of Neurite shows you there's always more to uncover.

Focus and Context: Fractals have the property of self-similarity, meaning the same patterns recur at any level of magnification. This feature allows users to zoom in to focus on a specific idea while never losing sight of how that idea fits into the larger picture. This is an essential aspect of critical thinking and problem-solving.

Recursive Learning: Just as fractals are generated by recursive processes, human thought often engages in recursive loops where ideas are refined, revisited, and reconnected in new ways. This natural affinity between the structure of fractals and the process of human thought can potentially lead to deeper insights.

Challenge to Linearity: Traditional mind maps and other organizational tools often impose a sense of linearity or hierarchy that might not be natural to the subject matter. Fractals, being inherently non-linear, allow for a more authentic representation of complex relationships.

Harmony with Natural Processes: Many natural phenomena are fractal. By using a fractal framework, Neurite might tap into cognitive processes that are naturally attuned to understanding and interacting with fractal systems, leading to more intuitive and effective mind maps.

Algorithmic Elegance: The mathematical elegance of fractals allows for computationally efficient algorithms that can handle the complexity of numerous interconnected nodes, making it more practical from a computational perspective.

Catalyst for AI Understanding: Using a fractal structure provides a unique substrate for AI algorithms to navigate. This might lead to novel ways in which AI understands and interacts with human-generated nodes, generating deeper and more nuanced responses.

So, the question isn't so much about whether thought is naturally fractal—indeed it is—but about how the explicit use of a fractal framework in Neurite can amplify, focus, and extend the natural fractal-like properties of human cognition. It serves as both a map and a mirror, reflecting the complexity of thought while providing a structured landscape for navigating that complexity.
