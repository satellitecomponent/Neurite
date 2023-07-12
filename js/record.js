let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];

async function captureScreenshot() {
    // Capture the media stream of the screen
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 }
    });

    // Create a video element to receive the stream
    const video = document.createElement('video');
    video.style.display = 'none';
    video.srcObject = mediaStream;
    video.autoplay = true;

    // Wait for the video to start playing
    await new Promise((resolve) => video.onplaying = resolve);

    // Create a canvas to capture a frame from the video
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = video.videoWidth * dpr;
    canvas.height = video.videoHeight * dpr;
    canvas.style.width = `${video.videoWidth}px`;
    canvas.style.height = `${video.videoHeight}px`;

    // Ensure all drawing operations are scaled
    context.scale(dpr, dpr);

    // Draw a frame onto the canvas
    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    // Stop all tracks in the media stream to end it
    mediaStream.getTracks().forEach(track => track.stop());

    // Create an img element with the data from the canvas
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png', 1.0); // The second argument adjusts the output image quality from 0.0 to 1.0. 
    img.style.width = '800px';  // Adjust as needed
    img.style.height = 'auto';  // This will maintain aspect ratio

    // Create a node with the image
    const content = [img];
    const scale = 1; // You can adjust the scale as needed
    const node = windowify("Screenshot", content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
    htmlnodes_parent.appendChild(node.content);
    registernode(node);
    node.followingMouse = 1;
    node.draw();
    node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
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
                    document.getElementById('recordButton').textContent = 'Record';
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

        // Start recording
        mediaRecorder.start();
    } catch (error) {
        // The user canceled the screen sharing prompt
        console.log('Screen sharing canceled');
        document.getElementById('recordButton').textContent = 'Record';
    }
}

function handleBlob(blob) {
    // Create a URL that represents the blob
    const url = URL.createObjectURL(blob);

    // Create a video element to play the blob
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.style.width = '800px';  // Adjust as needed
    video.style.height = 'auto';  // This will maintain aspect ratio

    // Create a node with the video
    const content = [video];
    const scale = 1; // You can adjust the scale as needed
    const node = windowify("Recorded Video", content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
    htmlnodes_parent.appendChild(node.content);
    registernode(node);
    node.followingMouse = 1;
    node.draw();
    node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
}

async function stopRecording() {
    // Stop the media recorder and close the media stream
    mediaRecorder.stop();
    mediaStream.getTracks().forEach(track => track.stop());
}

document.getElementById('screenshotButton').addEventListener('click', captureScreenshot);
document.getElementById('recordButton').addEventListener('click', () => {
    // If we're currently recording, stop recording
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
        document.getElementById('recordButton').textContent = 'Record';
    }
    // Otherwise, start a new recording
    else {
        startRecording();
        document.getElementById('recordButton').textContent = '\u275A\u275A'; // Double Vertical Bar unicode
    }
});