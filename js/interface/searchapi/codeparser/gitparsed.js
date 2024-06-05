

// Abstract Base Class (ABC)
class BaseParser {
    constructor(text, MAX_CHUNK_SIZE, overlapSize) {
        if (this.constructor === BaseParser) {
            throw new Error('Abstract classes cannot be instantiated.');
        }
        this.text = text;
        this.maxChunkSize = MAX_CHUNK_SIZE;
        this.overlapSize = overlapSize;
    }

    // Abstract Method
    findChunks() {
        throw new Error('You have to implement the method findChunks!');
    }

    parse() {
        let chunks = this.findChunks();

        // If no specific chunks were found, treat the whole text as one chunk
        if (chunks.length === 0) {
            console.warn('No matches found, returning full text.');
            chunks = [this.text]; // Wrap the full text in an array
        }

        // Apply chunkIfNecessary to each chunk found (or the whole text)
        return chunks.flatMap(chunk => this.chunkIfNecessary(chunk));
    }

    // Method to handle chunking if necessary
    chunkIfNecessary(text) {
        // Apply githubChunkText if the text exceeds the max chunk size
        if (text.length > this.maxChunkSize) {
            return githubChunkText(text, this.maxChunkSize, this.overlapSize);
        }
        return [text]; // If under the limit, return the text as a single chunk
    }

    // Method to extract the starting indices of matches from a regex
    getMatchIndices(regex) {
        let match;
        const indices = [];

        // Reset lastIndex in case the "g" flag is used with the regex
        regex.lastIndex = 0;

        while ((match = regex.exec(this.text)) !== null) {
            indices.push(match.index);
        }

        return indices;
    }

    createChunksFromIndices(startIndices) {
        const chunks = [];
        let chunkStartIndex = 0;
        let currentChunkSize = 0;

        startIndices.forEach((startIdx, idx, arr) => {
            const endIdx = arr[idx + 1] || this.text.length;
            const textSlice = this.text.slice(startIdx, endIdx);
            const potentialChunkSize = currentChunkSize + textSlice.length;

            if (potentialChunkSize > this.maxChunkSize) {
                // If the potential chunk size exceeds the max chunk size,
                // push the current chunk and start a new one
                chunks.push(this.text.slice(chunkStartIndex, startIdx).trim());
                chunkStartIndex = startIdx;
                currentChunkSize = textSlice.length;
            } else {
                // Otherwise, add to the current chunk size
                currentChunkSize += textSlice.length;
            }
        });

        // After processing all indices, push the last chunk
        chunks.push(this.text.slice(chunkStartIndex).trim());

        // If there were no indices (no meaningful chunks), return the full text as one chunk
        return chunks.length > 0 ? chunks : [this.text];
    }

    // Generic method to find chunks from tokens with a custom condition
    findChunksFromTokens(chunkStartCondition) {
        const tokens = CodemMirrorTokenizer.tokenize(this.text, this.getMode());
        const matchIndices = tokens.reduce((indices, token, index) => {
            if (chunkStartCondition(token, index, tokens)) {
                indices.push(tokens[index].start);
            }
            return indices;
        }, []);

        return this.createChunksFromIndices(matchIndices);
    }

    // Each language parser must define its own mode
    getMode() {
        throw new Error('getMode must be implemented by the subclass');
    }
}
// Define a DefaultParser for general text
class DefaultParser extends BaseParser {
    findChunks() {
        // Use githubChunkText to chunk any text that doesn't match specific parsers
        // githubChunkText itself handles the splitting based on maxLength and overlapSize
        return githubChunkText(this.text, this.maxChunkSize, this.overlapSize);
    }
}

// JavaScriptParser using the centralized findChunksFromTokens method
class JavaScriptParser extends BaseParser {
    findChunks() {
        return this.findChunksFromTokens((token) =>
            token.type === 'keyword' && (token.string === 'function' || token.string === 'class')
        );
    }

    getMode() {
        return 'javascript';
    }
}

// HTMLParser using the centralized findChunksFromTokens method
class HTMLParser extends BaseParser {
    findChunks() {
        return this.findChunksFromTokens((token) =>
            token.type === "tag bracket" && token.string === "<"
        );
    }

    getMode() {
        return 'htmlmixed';
    }
}

class CSSParser extends BaseParser {
    findChunks() {
        return this.findChunksFromTokens((token) =>
            // In CSS, start a new chunk at the beginning of each selector
            token.type === 'tag'
        );
    }

    getMode() {
        return 'css';
    }
}

class PythonParser extends BaseParser {
    findChunks() {
        return this.findChunksFromTokens((token) =>
            token.type === 'def' || token.type === 'class'
        );
    }

    getMode() {
        return 'python';
    }
}

class MarkdownParser extends BaseParser {
    findChunks() {
        // Markdown can be chunked by sections defined by headers
        const sectionRegex = /(^|\n)#{1,6} .+/g;
        return this.text.match(sectionRegex) || [];
    }
}

class JSONParser extends BaseParser {
    findChunks() {
        // JSON files are best handled as a whole due to their structure
        // but we might split them by top-level elements if needed
        const topLevelElementRegex = /"(.*?)": \{(.*?)\}(,?)/gs;
        return this.text.match(topLevelElementRegex) || [this.text];
    }
}

class CPPParser extends BaseParser {
    findChunks() {
        // C++ can be chunked by class, struct, or function definitions
        const classFuncRegex = /(^|\n)(class|struct)\s+\w+\s*{[\s\S]*?}|\w+\s+\w+\(.*\)\s*{[\s\S]*?}/g;
        return this.text.match(classFuncRegex) || [];
    }
}

class JavaParser extends BaseParser {
    findChunks() {
        // Java can be chunked by class or method definitions
        const classMethodRegex = /(^|\n)public\s+(class|void|int|String|[\w<>]+)\s+\w+\s*(\{?|[^;])/g;
        return this.text.match(classMethodRegex) || [];
    }
}

class PHPParser extends BaseParser {
    findChunks() {
        // PHP can be chunked by functions and classes
        const phpRegex = /(^|\n)\s*(function|class)\s+\w+/g;
        return this.text.match(phpRegex) || [];
    }
}

class RubyParser extends BaseParser {
    findChunks() {
        // Ruby can be chunked by method definitions or class/module definitions
        const rubyRegex = /(^|\n)(def\s+\w+|class\s+\w+|module\s+\w+)/g;
        return this.text.match(rubyRegex) || [];
    }
}

class TypeScriptParser extends BaseParser {
    findChunks() {
        // TypeScript can be chunked by class and interface definitions, as well as functions
        const tsRegex = /(^|\n)\s*(async\s+)?function\s+\w+\s*\(.*\)\s*\{[\s\S]*?\}|class\s+\w+\s*\{[\s\S]*?\}|interface\s+\w+\s*\{[\s\S]*?\}/gm;
        return this.text.match(tsRegex) || [];
    }
}

class YAMLParser extends BaseParser {
    findChunks() {
        // YAML can be chunked by documents separated by '---'
        const yamlRegex = /(^|\n)---\s*\n[\s\S]*?(?=\n---\s*\n|$)/g;
        return this.text.match(yamlRegex) || [this.text];
    }
}

class XMLParser extends BaseParser {
    findChunks() {
        return this.findChunksFromTokens((token) =>
            token.type === 'tag bracket' && token.string === "<"
        );
    }

    getMode() {
        return 'xml';
    }
}

// Robust file extension detection, handling edge cases
function getFileExtension(filename) {
    const match = filename.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
    return match ? match[1].toLowerCase() : null;
}

// Extend the getGitHubParser mapping with the new parsers
function getGitHubParser(fileExtension, text, MAX_CHUNK_SIZE, overlapSize) {
    const parserMap = {
        'js': JavaScriptParser,
        'html': HTMLParser,
        'css': CSSParser,
        'py': PythonParser,
        'md': MarkdownParser,
        'json': JSONParser,
        'cpp': CPPParser,
        'java': JavaParser,
        'php': PHPParser,
        'rb': RubyParser,
        'ts': TypeScriptParser,
        'yml': YAMLParser,
        'yaml': YAMLParser,
        'xml': XMLParser,
        // ... any other specific parsers ...
    };

    // Check if fileExtension is null or undefined before calling toLowerCase
    const normalizedExtension = fileExtension ? fileExtension.toLowerCase() : 'default';
    const ParserClass = parserMap[normalizedExtension] || DefaultParser;
    return new ParserClass(text, MAX_CHUNK_SIZE, overlapSize);
}


function isGitHubUrl(url) {
    return url.includes('github.com');
}

function extractGitHubRepoDetails(url) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)(\/|$)/);
    if (match) {
        return { owner: match[1], repo: match[2] };
    }
    return null;
}

async function fetchGitHubRepoContent(owner, repo, path = '') {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url);
    console.log(response);
    let allText = '';

    if (!response.ok) {
        console.error(`Failed to fetch GitHub content for ${url}:`, response.statusText);
        return null;
    }

    const data = await response.json();
    for (const item of data) {
        if (item.type === 'file') {
            const fileResponse = await fetch(item.download_url);
            if (!fileResponse.ok) {
                console.error(`Failed to fetch file from ${item.download_url}:`, fileResponse.statusText);
                continue; // Skip this file but continue with others
            }
            const contentType = fileResponse.headers.get('Content-Type');
            if (!contentType.includes('text')) {
                console.log(`Skipping non-textual content from ${item.download_url}`);
                continue; // Skip non-text files but continue with others
            }
            const text = await fileResponse.text();
            allText += text + '\n';
        } else if (item.type === 'dir') {
            const dirText = await fetchGitHubRepoContent(owner, repo, item.path);
            allText += dirText ? dirText : '';
        }
    }
    return allText;
}
async function storeGitHubContent(text, owner, repo, path) {
    // Assuming we have a utility that sanitizes and parses text
    const sanitizedText = sanitizeGitHubText(text);  // Assume this function is defined
    const fileExtension = getFileExtension(path); // Use the getFileExtension function
    const parser = getGitHubParser(fileExtension, sanitizedText, MAX_CHUNK_SIZE, overlapSize);
    const parsedText = parser.parse();

    // Log each chunk for quality evaluation
    //parsedText.forEach((chunk, index) => {
    //    console.log(`Chunk ${index + 1}/${parsedText.length} from ${path}:`);
    //    console.log(`Size: ${chunk.length}`);
    //    console.log(`Snippet: ${chunk.substring(0, 100)}...`);
        // Add additional logging as needed
    //});

    // Fetch embeddings for each chunk
    const chunkedEmbeddings = await fetchChunkedEmbeddings(parsedText);
    const key = `https://github.com/${owner}/${repo}/${path}`;
    // Store embeddings and chunks in the database
    await storeEmbeddingsAndChunksInDatabase(key, parsedText, chunkedEmbeddings);
}

async function handleGitHubRepo(owner, repo) {
    try {
        const fetchedText = await fetchGitHubRepoContent(owner, repo);
        if (fetchedText) {
            await storeGitHubContent(fetchedText, owner, repo, '');
        }
    } catch (error) {
        console.error("Error processing GitHub repository:", error);
    }
}

function sanitizeGitHubText(text) {
    return text.replace(/[^\x20-\x7E]/g, '');
}


function githubChunkText(text, maxLength, overlapSize) {
    // Splits text into chunks with respect to the maximum length, 
    // ensuring that the end of each chunk coincides with the end of a complete line of code.
    const chunks = [];
    let currentChunk = '';
    let currentLine = '';

    for (const char of text) {
        currentLine += char;

        // Check for a newline character to determine the end of a line
        if (char === '\n' || currentChunk.length + currentLine.length > maxLength) {
            // If the current line exceeds the max length, we split at the max length
            if (currentChunk.length + currentLine.length > maxLength) {
                const splitPoint = maxLength - currentChunk.length;

                // Edge case handling: what if the split point is in the middle of a word?
                // We find the previous whitespace or line break to ensure we don't split words.
                let lastGoodSplitPoint = splitPoint;
                while (lastGoodSplitPoint > 0 && !/\s/.test(currentLine[lastGoodSplitPoint])) {
                    lastGoodSplitPoint--;
                }

                if (lastGoodSplitPoint > 0) {
                    // Split the line at the last good split point
                    currentChunk += currentLine.substring(0, lastGoodSplitPoint);
                    // Save the rest for the next chunk
                    currentLine = currentLine.substring(lastGoodSplitPoint);
                } else {
                    // If there's no good place to split (a very long word), we split at the max length
                    currentChunk += currentLine.substring(0, splitPoint);
                    currentLine = currentLine.substring(splitPoint);
                }

                chunks.push(currentChunk);
                currentChunk = '';
            }

            if (char === '\n') {
                // Add the complete line to the current chunk
                currentChunk += currentLine;
                currentLine = '';

                // If the current chunk (plus potential overlap) is at the maximum length, push it to chunks
                if (currentChunk.length >= maxLength) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
            }
        }
    }

    // Add any remaining text as the last chunk
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    } else if (currentLine.length > 0) {
        chunks.push(currentLine);
    }

    // If chunks are too short, consider merging them or adding the overlap from the previous chunk
    if (overlapSize > 0) {
        const adjustedChunks = [];
        let previousChunk = '';

        for (const chunk of chunks) {
            if (previousChunk.length > 0) {
                // Prepend overlap from the previous chunk
                const overlap = previousChunk.substring(previousChunk.length - overlapSize);
                adjustedChunks.push(overlap + chunk);
            } else {
                adjustedChunks.push(chunk);
            }
            previousChunk = chunk;
        }

        return adjustedChunks;
    }

    return chunks;
}