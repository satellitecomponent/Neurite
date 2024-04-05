##  Neurite Start Interface


Currently, the script is configured to run the following servers:

webscrape, a Node.js server for web scraping located in the webscrape directory

wikisearch, a Node.js for wiki searching located in the wikisearch directory

wolfram-alpha, a Node.js server interfacing with Wolfram Alpha located in the wolfram-alpha directory

and now,

ai-proxy, a Node.js server for handling api calls between Neurite's js interface and local or cloud hosted large langauge models.

and,

automation, a Node.js server for running Neurite via Playwright, currently used for a headless browser option as well as for taking automated screenshots of Neurite.

# Prerequisites

Before running the script, make sure you have the following installed:

Node.js

npm


# Usage

To start all servers (besides automation.js), run the start_servers.js script with Node.js by...

...navigating to the LocalHost servers folder in the command line and running...

```bash
npm run start
```

to include the Playwright script add the flag, neurite

```bash
npm run start neurite
```


The Node.js servers will run npm install before starting, ensuring all dependencies are installed. If the dependencies are already installed and up-to-date, npm install will not reinstall them.

The one exception is the automation server which requires you to install playwright manually.

navigate to the automation folder in your CLI and run

```bash
npm i
```

then, follow the steps to install playwright.

 From there, `npm run start neurite` will work.
