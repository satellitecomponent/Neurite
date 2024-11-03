let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];

async function captureScreenToBase64() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = Html.new.video();
    video.srcObject = stream;
    video.autoplay = true;
    video.style.display = 'none';

    return new Promise((resolve, reject) => {
        On.loadedmetadata(video, (e)=>{
            const canvas = Html.new.canvas();
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

            // Stop all tracks in the media stream to end it
            stream.getTracks().forEach(track => track.stop());

            resolve(canvas.toDataURL('image/png', 1.0));
        });

        video.onerror = (err) => {
            Logger.err("In capturing video:", err);
            reject(err);
        };
    });
}

async function captureScreenshot() {
    try {
        const base64Image = await captureScreenToBase64();

        const img = new Image();
        img.src = base64Image;
        img.style.width = '800px';
        img.style.height = 'auto';

        img.onload = function () {
            const node = createImageNode(img, "Screenshot");
            htmlnodes_parent.appendChild(node.content);
            node.followingMouse = 1;
            node.draw();
            node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
        };
    } catch (err) {
        Logger.err(err)
    }
}

function handleDataAvailable(event) {
    // If there's video data to record, add it to our array
    if (event.data.size > 0) {
        recordedChunks.push(event.data);
    }
}

async function startRecording() {
    try {
        // Capture the media stream of the screen
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1920, height: 1080 }
        });

        // If user stops sharing their screen, change record button back to "Record"
        mediaStream.getTracks().forEach(track => {
            track.onended = () => {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    stopRecording();
                    Elem.byId('recordButton').textContent = 'Record';
                }
            };
        });

        // Use the MediaRecorder API to record the stream
        mediaRecorder = new MediaRecorder(mediaStream);

        // Handle the dataavailable event, to capture each recorded chunk
        mediaRecorder.ondataavailable = handleDataAvailable;

        // When the recorder is stopped, create and handle the blob
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            handleBlob(blob);

            // Reset recorded chunks for next recording
            recordedChunks = [];
        };

        mediaRecorder.start();
    } catch (err) {
        Logger.info("Screen sharing canceled");
        Elem.byId('recordButton').textContent = 'Record';
    }
}

function handleBlob(blob) {
    // Create a URL that represents the blob
    const url = URL.createObjectURL(blob);

    // Create a video element to play the blob
    const video = Html.new.video();
    video.src = url;
    video.controls = true;
    video.style.width = '800px';  // Adjust as needed
    video.style.height = 'auto';  // This will maintain aspect ratio

    // Create a download link for the video
    const link = Html.make.a(url);
    link.download = "neuriterecord.webm";

    // Set fixed width and height for the button to create a square around the SVG
    const linkStyle = link.style;
    linkStyle.width = "40px";  // Width of the SVG + some padding
    linkStyle.height = "40px";
    linkStyle.display = "flex";  // Use flexbox to center the SVG
    linkStyle.alignItems = "center";
    linkStyle.justifyContent = "center";
    linkStyle.borderRadius = "5px";  // Optional rounded corners
    linkStyle.transition = "background-color 0.2s";  // Smooth transition for hover and active states
    linkStyle.cursor = "pointer";  // Indicate it's clickable

    const setBackColor = Elem.setBackgroundColor;
    On.mouseover(link, setBackColor.bind(link, '#e6e6e6')); // lighter
    On.mouseout(link, setBackColor.bind(link, '')); // reset
    On.mousedown(link, setBackColor.bind(link, '#cccccc')); // middle
    On.mouseup(link, setBackColor.bind(link, '#e6e6e6')); // back to lighter

    // Clone the SVG from the HTML
    const downloadSVG = document.querySelector('#download-icon').cloneNode(true);
    downloadSVG.style.display = "inline";  // Make the cloned SVG visible

    // Append the SVG to the download link and set link styles
    link.appendChild(downloadSVG);
    linkStyle.textDecoration = "none"; // to remove underline
    linkStyle.color = "#000";  // Set color for SVG

    // Update the content array to include both the video and download link
    const content = [video, link];
    const scale = 1; // You can adjust the scale as needed
    const node = windowify("Recorded Video", content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
    htmlnodes_parent.appendChild(node.content);
    Graph.registerNode(node);
    node.followingMouse = 1;
    node.draw();
    node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
}

async function stopRecording() {
    // Stop the media recorder and close the media stream
    mediaRecorder.stop();
    mediaStream.getTracks().forEach(track => track.stop());
}

//screenshot button moved to neuralapi.js
On.click(Elem.byId('recordButton'), (e)=>{
    if (mediaRecorder?.state === 'recording') {
        stopRecording();
        Elem.byId('recordButton').textContent = 'Record';
    } else {
        startRecording();
        Elem.byId('recordButton').textContent = '\u275A\u275A'; // Double Vertical Bar unicode
    }
});
