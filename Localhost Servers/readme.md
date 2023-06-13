This project includes a script that spawns multiple servers based on their respective start commands. This enables you to manage and run multiple servers in different directories from a central location.

Servers
Currently, the script is configured to run the following servers:

A Node.js server for web scraping located in the webscrape directory
A Python script for wiki searching located in the wikisearch directory
A Node.js server interfacing with Wolfram Alpha located in the wolfram-alpha directory
Prerequisites
Before running the script, make sure you have the following installed:

Node.js
npm
Python

Usage
To start all servers, run the start_servers.js script with Node.js:

Navigate to the LocalHost servers folder in the command line.

node start_servers.js
This will spawn each server in its own subprocess and they will run concurrently. Output from each server's stdout and stderr will be logged to the console.

The Node.js servers will run npm install before starting, ensuring all dependencies are installed. If the dependencies are already installed and up-to-date, npm install will not reinstall them.
