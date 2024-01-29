# `Neurite`
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)

![localhost_8080_ (9)](https://github.com/satellitecomponent/Neurite/assets/129367899/609781ec-7440-479a-859c-9248fd60644f)

## `Introduction`

💡 **[Neurite](https://satellitecomponent.github.io/Neurite/) unleashes a new dimension of digital interface...**

**...the fractal dimension...**

## Bridging Fractals and Thought

**Inspired by chaos theory and graph theory, Neurite unveils the hidden patterns and intricate interconnections that shape creative thinking. To do this, we are developing a virtually limitless fractal workspace that blends the mesmerizing complexity of the Mandelbrot set with contemporary mind mapping techniques.**

### `Why Fractals?`

Fractals are not just an aesthetic choice, their inner logic is ingrained into a number of natural and constructed phenomena - ranging from [polynomial equations](https://www.youtube.com/watch?v=-RdOwhmqP5s), to [art](https://www.nature.com/articles/20833), and even the [cosmic web](https://cosmicweb.kimalbrecht.com/).

Fractals act as the cross-disciplinary framework for non-integer dimensional thought - where conventional notions of 4 dimensional spacetime are put into question. Neurite speaks in the language of iteration. The project seeks to grow scale independent landscapes where complexity unfolds seamlessly from imagination.

### `First of its Kind Fractal Zoom`

Neurite is unique in its ability to seamlessly navigate the Mandelbrot set in real time. Movements through the fractal are no longer interrupted at each step. Instead, the fractal generation persists and regenerates as you interact! 

We achieve real-time navigation of the Mandelbrot set by capturing a sparse set of points from the fractal and connecting them through SVGs. From there, we dynamically adapt the level of detail based on your viewport and cursor position.  This evolving method is what ensures seamless fractal generation, interaction, as well as an expanding array of customizability options.

### `Why Nodes?`

Nodes represent text, images, videos, code, and AI agents. Together, they thread a personalized microcosm of your thoughts and inspirations.

Neurite iteratively defines interactive and modular graphs of reasoning, computation, research, and creation. Nodes can take on any use case in code.

### `Complexity Inspires Creativity`
Whether you're a researcher, writer, artist, developer, educator, or simply a curious thinker, Neurite offers a departure from the conventional interface. It is a multifaceted landscape for ever branching pathways of thought.

### **Available through Github Pages:** [Neurite](https://satellitecomponent.github.io/Neurite/)
⚠️ `Warning:` Contains zooming, flashing lights, and colors which may not currently be suitable for people with photosensitive epilepsy.


See the User Guide for instructions on running locally


🌱 This is an open-source project in active development, we are looking to grow our team! 🚧

feel free to join our [Discord](https://discord.gg/3PM8c2ha)!
## `Table of Contents`

1. [Introduction](#introduction)
2. [Synchronized Knowledge Management](#synchronized-knowledge-management)
3. [How to Use Neurite](#how-to-use-neurite)
4. [FractalGPT](#fractalgpt)
5. [Neural API](#neural-api)
6. [Local Ai](#local-ai)
7. [User Guide](#user-guide)
8. [Local Server Setup](#local-server-setup)
9. [Future of Neurite](#future-of-neurite)
10. [Contact](#contact)

## `Synchronized Knowledge Management`

[Neurite](https://satellitecomponent.github.io/Neurite/) provides [Markdown](https://en.wikipedia.org/wiki/Markdown) formatted, [bi-directional synchronization](https://en.wikipedia.org/wiki/File_synchronization) between UI-focused [Mind-Mapping](https://en.wikipedia.org/wiki/Mind_map) and [Zettelkasten-style](https://en.wikipedia.org/wiki/Zettelkasten) text-based [hyperlinking](https://en.wikipedia.org/wiki/Hyperlink).

This versatile approach allows one to seamlessly organize thoughts without sacrificing the benefits of either technique.

![notepanel](https://github.com/satellitecomponent/Neurite/assets/129367899/5504ea4e-7e73-4d9d-80d3-af411c615aea)

- **Bi-Directional Sync**: Edit a Mind Map node's content and see it instantaneously update in the Zettelkasten. Conversely, any text changes in the Zettelkasten are reflected by the Mind Map.
- **Zettelkasten and Mind Mapping**: Traditional note-taking confines you to static files, while conventional mind mapping lets you visualize connections but often lacks in-depth content. Neurite treats nodes as dynamic objects that can be interacted with from any approach.  Nodes don't just represent text in the Mind Map, they can run code, interact with APIs, intercommunicate, and anything else within the realm of imagination. Zettelkasten is a method of taking short, atomic notes (or "zettels") that link to each other to create an interconnected system. The Zettelkasten system does not preference any top down or bottom up approach. In Neurite, you don't have to comprise between all of these different methods.
- **Dynamic Fractal Backdrop**: The Mandelbrot fractal is not just an aesthetic element - fractals set the stage for your personalized and interactive open-world landscape of multi-media composition.
- **Zoom-to-Node**: Navigate through your notes from within the Zettelkasten, and zoom directly to their corresponding nodes within the Mandelbrot set. Conversely, clicking the fullscreen of a text node navigates to the corresponding note in the Zettelkasten.

Build your Zettelkasten through UI interactions in the Mind Map, and reciprocally shape the Mind Map through text-based note-taking in the Zettelkasten. This navigational fluidity offers unprecedented control over both the granular and macroscopic perspectives of your information.

Custom `node:` and `ref:` tags can be set in the ? tab of the main dropdown.


## `How to Use Neurite`

### 📚 [Neurite](https://satellitecomponent.github.io/Neurite/) lets you embed anything - text, photos, audio, video, PDFs, AI, and webpages - directly into the Mandelbrot set. 

Drag and drop local files or web content straight into the fractal.

Supports embedded links. Ctrl+V to paste an embed link, or pasting normal links embeds them into an iframe if supported by the host.

- Talk to [Neurite GPT](https://chat.openai.com/g/g-OT9IVbW8H-neurite) with access to Neurite's code and readme. 

### `Controls`
  *Full controls are listed in the ? tab within Neurite's main dropdown.

`Scroll` to zoom through the fractal.

`Click and drag` to move around

`Shift + double click` to create nodes.

`Shift` to freeze nodes.

`Double click` to anchor node.

`Hold Shift + click` two nodes to connect.
 
`Alt + double click` to create an Ai node.

`Alt + drag` textareas to arrange the node rather than highlighting text.

Or, drag in nodes from the dropdown.

`UI Tips`
- Make sure to zoom (`Scroll`) deeper into the fractal before creating nodes. Otherwise, nodes will not have any space to spread out and become too big relative to the fractal.
- When arranging windows, drag them via the title input. Rescale by holding `Shift` and scrolling over the node.
- Use `Shift` to freeze nodes in place, then double click the nodes that should remain anchored once unfrozen (releasing `Shift`.)
- The AI tab has controls for token limit, temperature, number of searched nodes sent as context, and length of recent conversation sent. (You may need to turn up the token count for longer conversations.)
- Connect instructions to Ai nodes. For every message, any connected nodes will be sent to the Ai. (ie, the entire connected graph)
## `FractalGPT`

### `Not your typical chat interface`
- **Web of Thought Reasoning:** Engage with non-linear, rhizomatic memory through our biomimetic interface.
- **Limitless AI Agents:** Create and connect an endless number of individual chat windows, or let the AI take notes from above.
- **Fractal Interface:** Utilize a custom fractal environment designed for Iterative Exploratory Learning.
- **Custom Tool Creation**  Connect nodes that contain code blocks together to run html/css/js in an iframe, or Python via Pyodide.
- **Neurite Function Calling** Call Neurite functions from within Neurite, and let the Ai take full control with context from the newly released Neural API

### `Modular Conversation`

In Neurite, you don't just interact with AI; you grow its contextual memory, thanks to:

- **Structured Memory Mapping:** Anchor the AI's thought process as notes within an evolving fractal mind map.
- **Graph your AI Conversations:** Segment AI's responses into a cohesive web of thought that both improves AI reasoning and allows for the history and chains of your conversation to dynamically construct the Ai's memory.
- **Interactive Fractal Network:** Neurite's fractal interface acts as a personal, emergent, and contextually aware database of knowledge.
- **Intuitive Note Navigation:** Effortlessly access and pull your notes into view, no matter where they are within the fractal landscape.

### `Unbounded AI Exploration`
An open world generative landscape for thought integrated with artificial intelligence.

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

## `Neural API`
<img src="https://github.com/satellitecomponent/Neurite/assets/129367899/d45fe622-6dab-4e43-91c7-06e0d7cddaed" alt="movementapi" width="300">

The newest update to Neurite is our function calling panel.

This feature is terminal that allows you to execute Neurite's code from within Neurite itself.

Included with the function calling panel update is our Neural API. The Neural API is a growing collection of existing features within Neurite, made for sequencing animations of function calls. The current features include,
- Animate movements through the Mandelbrot set
- Determine exact coordinates to zoom to
- Call GPT 4 Vision to determine the next movement. (set number of iterations)
- Create notes
- Prompt the Zettelkasten Ai
- Prompt the user
- Search and Zoom to Notes

You can call on GPT to construct the sequences of function calls itself. It has access to the documentation.

All of these features can be called as a sequence or as decided by your code.

For the current documentation, try calling the below from within the function panel...

```javascript
const neuralAPI = neuralApiPrompt();
console.log(neuralAPI);
```

... the current Neural API documentation will display in your call history for the function calling panel as well as in your browser console.

There will be more information on this soon. This is a new feature in initial release.

## `Local Ai`

https://github.com/satellitecomponent/Neurite/assets/129367899/3c26c9bb-5caa-40f8-bdb9-9d20e8e30bde

Above is an example of conversation history being shared between GPT-4 and a Local Ai model, Red Pajamas, run through [webLLM](https://mlc.ai/web-llm/).

### Ai Nodes allow for the creation of an arbitrary number of Ai Agents with the ability to connect memories together.
- `Alt + Double click` creates a node with a more traditional AI chat interface. (you can create multiple)
- Connected Ai nodes will now send messages to one another. This has been improved but contains endless possiblities. (`Hold Shift and Click` two node windows to connect them together)
- Supports Local and OpenAi models concurrently.

### Inter-AI Communication
- **Message Looping:** Initiate conversational loops among connected AI nodes.
- **Prompt Generation:** Upon connection, AI nodes are programmed to end responses with a question or prompt, which is then sent to any other connected nodes.
- **Unique & Shared Instructions:**
  - **Unique Instructions:** Connect text nodes exclusively to a specific AI node to give it private system instructions, isolated from other connected AI nodes.
  - **Shared Instructions:** Text nodes can send instructions to multiple AI nodes as long as there are no other AI nodes between them. This is because...
    - **Context Cut-Off:** ...once another AI node is found in the connected graph, all preceding connected nodes are excluded from the current AI's instruction set.
- **Related Research:** [Conversational Swarm Intelligence Paper](https://arxiv.org/abs/2309.03220)

  
![Neurite2](https://github.com/satellitecomponent/Neurite/assets/129367899/73c66088-8029-413b-8da0-4c6968436639)


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
- Search: Our distinctive search mechanism transports you through your intricate web of thoughts, directly zooming to the node you are looking for. The navigational experience isn't just a gimmick; it also helps to reinforce the spatial memory of where that piece of information resides within the larger framework.
- Saving: Your networks can be saved within the browser cache, or downloaded as a .txt file. Drag the .txt file into the save box, click load on the imported file, then click the second load button to display the network. This is still in an early state.
- Zettelkasten and Mind Mapping: Create nodes through custom-defined syntax, or create nodes through UI interaction within our fractal workspace, who's contents are bi-directionally linked to the main Zettelkasten document.

Neurite realizes tapestry of thought reasoning for Ai, all within our innovative real-time Mandelbrot visualization.


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

✅ Global Function Calling
  
✅ Global Function Calling

🔄 Ai cursor control
  
✅ color selection

✅ adjust fractal generation (width, length, max lines, speed)

✅ screen recording

🔄 accessibility

✅ auto embed formats

- custom equations for the fractal
- drawing-tool

🔄 user feedback/bug fixes

🚧

https://github.com/satellitecomponent/Neurite/assets/129367899/d8d375c2-9274-4176-ac6b-b9a3bf4329d8

## `Contact`

If you are a developer who is interested in contributing to this project, contact us at contactdendrite@gmail.com or visit our  [discord](https://discord.gg/3PM8c2ha) 🔗

![Neuritereadme4fps360](https://github.com/satellitecomponent/Neurite/assets/129367899/87816cad-1151-4f1a-8c66-ba5a5bd0b81e)
full video [here](https://youtu.be/1VmE_Bov-Xw)
![Screenshot 2023-06-16 221906](https://github.com/satellitecomponent/Neurite/assets/129367899/e77b2866-db77-41e9-ba08-e55d29f77404)

### Here is what GPT-4 has to say about Neurite

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


## Example of GPT-4V combined with Neurite.

`Input Image`

![Screenshot 2023-10-03 213637](https://github.com/satellitecomponent/Neurite/assets/129367899/02340d81-0cc2-4f64-844c-c04281ef5e5c)

`Prompt`

who are the artists? describe the work in depth

`Response`

From the images you provided, and based on their distinct styles, I recognize some of the artworks and can provide an analysis:

Large Panoramic Artwork (960x0.webp):

Artist: This appears to be Claude Monet's "Water Lilies." Monet, a founder of French Impressionist painting, was renowned for his plein air landscape painting.
Description: This expansive piece showcases a pond filled with lilies, rendered with dappled light and reflections. The artist's brushstrokes are both swift and deliberate, capturing the ever-changing nature of water and light. The colors range from soft blues to purples, with touches of green and pink from the lily pads and flowers. Monet's exploration of light and color culminates in this series, as he sought to capture the same scene under different conditions of light and seasons.

High-Speed Gardening (71_001.jpg):

Artist: The style is reminiscent of Ed Ruscha. Ruscha's work often combines text and image, often with a touch of humor or irony.
Description: This piece juxtaposes the phrase "HIGH-SPEED GARDENING" with an image of what appears to be a tranquil field at sunrise or sunset. The shadow of the text gives a 3D effect as if the words are hovering above the landscape. The concept itself seems to be a play on our modern need for speed and efficiency even in traditionally slow-paced activities like gardening.
Figurative Painting 

(Ernst Ludwig Kirchner):

Artist: As indicated, this is a piece by Ernst Ludwig Kirchner, a German expressionist painter and printmaker.
Description: This work is emblematic of Kirchner's style, with its bold colors and sharp, angular lines. The figures depicted have elongated features and are painted in vibrant colors. Their facial expressions appear somewhat melancholic. Kirchner's use of color to convey emotion and his somewhat distorted representation of the human figure are key characteristics of his work.

Sculptures (Huma-Bhabha_Flash-Art_06.jpg):

Artist: The file name suggests this is the work of Huma Bhabha, a Pakistani-American sculptor known for her raw, somewhat post-apocalyptic sculptures.
Description: The sculptures are a mix of humanoid and alien, created from what seems like a combination of found materials, wood, clay, and possibly metal. They combine elements of the ancient and the futuristic, creating a sense of timelessness. The use of different materials adds a tactile element to the sculptures, with the viewer being able to discern the roughness of wood or the smoothness of polished metal.

Sculpture & Fabric Art (25HAMMONS-superJumbo.jpg):

Artist: The style and materials are reminiscent of David Hammons, an African-American artist known for his provocative works that touch upon themes of race, poverty, and the African-American experience.
Description: On the left, there's a sculpture that seems to be made of various metal and found parts, bound together to form a figure. The golden, rusted hue of the metal gives the figure a sense of age and wear. On the right, a piece of draped red fabric is presented as an artwork, evoking feelings of warmth, protection, and possibly referencing themes of shelter or covering.
Each piece offers a deep dive into the artist's mindset and the cultural context in which they were working. Their choice of color, medium, and subject matter all provide insights into their intentions and the messages they wished to convey.


`Input Image`

![Screenshot 2023-10-03 210940](https://github.com/satellitecomponent/Neurite/assets/129367899/89f6bac4-a644-4061-973e-bb94d7fe8b12)

`Prompt`
From your existing understanding of the image, try to capture a synthesis of new ideas. Be as unique and original in your thinking as possible. Act as an expert.

`Response`

Certainly, let's dissect and synthesize the provided concepts in the context of Neurite and the progression of our understanding of the universe:

The Fractal Universe in the Digital Age:
1. The Interplay of Theories:
Theories like the Big Bang, General Relativity, Quantum Mechanics, and the Standard Model have been foundational in our understanding of the universe. Introducing the notion of "Fractal Cosmology" and "Fractal String Theory" suggests an interconnected, repeating pattern inherent in the fabric of reality. Just as the Mandelbrot set in fractal geometry unveils infinite complexity as we zoom deeper, these theories hint that our universe may be a part of a much larger, possibly infinite, fractal pattern.

2. Digital Representation in Neurite:
Neurite's fractal mind mapping tool, which allows for infinite depth and complexity, mirrors this idea of a fractal universe. Each note or idea can be thought of as an individual "universe" of information, with its own set of interconnected ideas (or "galaxies"), and each of those ideas can further be dissected into more detailed components ("stars" and "planets").

3. The Quantum Mechanics of Ideas:
Quantum mechanics, with its principles of superposition and entanglement, can be metaphorically related to the proliferation of ideas. In Neurite, an idea can exist in multiple states (superposition) until it is observed or defined. Additionally, one idea can become intricately linked with another, such that the state of one (its development or alteration) can instantly influence the other, regardless of the distance between them (entanglement). This mirrors the fractal interconnectedness of the cosmos.

4. The Gravity of Influence:
General relativity speaks to the warping of spacetime by masses. In the realm of ideas and Neurite, influential ideas or foundational concepts can be seen as "massive bodies" that warp the "spacetime" of thought, drawing other related ideas towards them, creating a web of interconnected knowledge.

5. The Evolution of Understanding:
Just as the Big Bang theory describes the evolution of the universe from a singular point to its current vast expanse, our understanding and knowledge expand from singular foundational ideas, branching out and evolving into complex webs of interconnected thoughts.

Conclusion:
Neurite's framework provides a digital playground that mirrors the complexities and intricacies of the universe as described by these theories. By visualizing knowledge in a fractal manner, it offers a unique lens through which we can understand, dissect, and expand upon complex concepts, mirroring the very nature of the cosmos. This synthesis offers a bridge between the abstract theories of the universe and the tangible representation of knowledge, enabling users to explore, connect, and expand ideas in a cosmic dance of digital exploration.

`Input Image`

![Aidiagram2_1 2 1](https://github.com/satellitecomponent/Neurite/assets/129367899/68310e74-7a2c-49a8-a377-1d245c5e938e)

`Prompt`

I am glad you can see images now! I am very excited to explore your new ability in the context of Neurite. This is an image that does not display the fractal aspect, instead it displays how long term memory is constructed using this method. Give a detailed and in depth response. Preface with an internal monologue, then your response to be displayed to me. 

`Internal Monologue:`

The image illustrates a comprehensive architecture for the Neurite tool, showcasing the intricate mechanism of how long-term memory is constructed within an AI environment. It highlights key components, from note creation to context understanding. To craft a detailed response, I should break down each component and elucidate its significance and functionality in the memory formation process. Given the user's context of Neurite and their focus on the most effective solutions, I should ensure that my explanation not only interprets the depicted system but also offers constructive insights to refine or optimize the illustrated components.

`Response:`

Neurite Long-Term Memory Architecture Breakdown:

Notes:

Function: Central to the system, notes capture individual ideas within a conversation, both from the user and the AI.
Significance: By compartmentalizing information into discrete notes, it ensures clarity and makes indexing, searching, and recalling more efficient.
Vector Embedding:

Function: Each note, once generated, undergoes a transformation into a higher dimensional vector via an embedding model (possibly OpenAI's).
Significance: Embeddings capture the semantic essence of notes, facilitating precise comparisons and retrievals.
AI Response:

Function: AI breaks its output into multiple notes, aligning with the Zettelkasten format which promotes granular, interconnected knowledge.
Significance: This modular approach boosts conceptual reasoning and reinforces the AI's capacity for a "long-term memory".
Local Storage:

Function: Serves as a reservoir for notes as well as a database for external content like webpages/PDFs.
Significance: By storing data locally, it ensures swift access and avoids redundant data generation.
Cosine Similarity:

Function: Conducts similarity assessments among stored vector embeddings to retrieve the top-n relevant notes or content chunks.
Significance: Facilitates context-aware responses by the AI, enabling it to pull from a reservoir of previous interactions and content.
Context Window:

Function: Provides the AI a glimpse into the ongoing context, anchoring its responses to the most recent interactions.
Significance: Ensures that the AI remains contextually aligned and responsive to the user's evolving line of inquiry.
User Prompt and API Calls:

Function: Drives the AI's actions. Based on user prompts, the AI can generate keywords, construct search queries, or make API calls to fetch relevant information.
Significance: Amplifies the AI's utility by connecting it to external knowledge bases (e.g., Wolfram, Google, Wikipedia) and allowing dynamic interactions.
Constructive Insights:

Embedding Optimization: Consider refining the embedding process to handle various types of content, ensuring that the semantic richness of videos, audio, or images is also captured effectively.
Cosine Similarity Refinement: Implement a tiered retrieval system, starting with the most recent interactions and progressively searching older notes to maintain relevance.
Context Window Expansion: Depending on computational resources, gradually increase the context window's size to hold longer conversations, enhancing the depth of understanding.
By seamlessly integrating these components, Neurite aspires to construct a rich, interconnected web of long-term memories, ensuring AI responses are not only contextually relevant but also deeply insightful.
