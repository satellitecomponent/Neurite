WebScrapeEmbeddings Server
Overview
This is a Node.js server that is designed to scrape text from web pages and PDF documents, save the text to a SQLite in-memory database, and also handle storage and retrieval of associated text embeddings.

Getting Started
Requirements
Node.js (v14.0.0 or above)
npm (usually comes with Node.js)
Installing Dependencies
This application depends on several Node.js libraries, all of which are listed in the package.json file. To install these dependencies, navigate to the directory containing the package.json file and run the following command:


npm install
Running the Server
To start the server, navigate to the directory containing the index.js file and run the following command:

npm start
The server will start running on localhost:4000 or the port set in your environment variables.

Usage
Once the server is running, it exposes several endpoints:

GET /raw-proxy?url=<URL>: Fetches the raw HTML from the specified URL.
GET /proxy?url=<URL>: Fetches and returns the visible text from a webpage or the text from a PDF document at the specified URL.
POST /store-embedding-and-text: Accepts a JSON body with the fields key (the URL), embedding (the associated embedding), and text (the extracted text), and stores them in the database.
GET /fetch-embedding?key=<key>: Returns the stored embedding associated with the specified key.
GET /fetch-web-page-text?url=<URL>: Returns the stored text associated with the specified URL.
GET /fetch-all-embeddings: Returns all stored embeddings and their associated URLs and text.
GET /fetch-all: Returns all records in the embeddings and webpage_text database tables.
Troubleshooting
If you encounter any issues while setting up or running the server, please check if you've followed all the instructions correctly. If the problem persists, feel free to open an issue on this repository.