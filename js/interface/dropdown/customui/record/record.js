const Recorder = {
    blobOptions: { type: 'video/webm' },
    mediaStream: null,
    mediaRecorder: null,
    recordedChunks: [],

    async captureScreenToBase64(){
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

                this.endStream(stream);

                resolve(canvas.toDataURL('image/png', 1.0));
            });

            video.onerror = (err) => {
                Logger.err("In capturing video:", err);
                reject(err);
            };
        });
    },

    async captureScreenToImage(){
        try {
            const base64Image = await this.captureScreenToBase64();

            const img = new Image();
            img.src = base64Image;
            img.style.width = '800px';
            img.style.height = 'auto';

            img.onload = function () {
                const node = NodeView.addForImage(img, "Screenshot");
                Graph.appendNode(node);
                node.followingMouse = 1;
                node.draw();
                node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
            };
        } catch (err) {
            Logger.err(err)
        }
    },

    onDataAvailable(e){
        if (e.data.size > 0) Recorder.recordedChunks.push(e.data)
    },
    onStop(){
        const blob = new Blob(Recorder.recordedChunks, Recorder.blobOptions);
        Recorder.handleBlob(blob);
        Recorder.recordedChunks = []; // Reset between recordings
    },

    async startRecording(){
        try {
            // Capture the media stream of the screen
            this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1920, height: 1080 }
            });

            // If user stops sharing their screen, change record button back to "Record"
            this.mediaStream.getTracks().forEach(track => {
                track.onended = () => {
                    if (this.mediaRecorder?.state === 'recording') {
                        this.stopRecording();
                        Elem.byId('recordButton').textContent = "Record";
                    }
                };
            });

            this.mediaRecorder = new MediaRecorder(this.mediaStream);
            this.mediaRecorder.ondataavailable = this.onDataAvailable;
            this.mediaRecorder.onstop = this.onStop;
            this.mediaRecorder.start();
        } catch (err) {
            Logger.info("Screen sharing canceled");
            Elem.byId('recordButton').textContent = "Record";
        }
    },

    handleBlob(blob){
        const url = URL.createObjectURL(blob);

        const video = Html.new.video();
        video.src = url;
        video.controls = true;
        video.style.width = '800px';
        video.style.height = 'auto'; // maintain aspect ratio

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

        const downloadSVG = Elem.deepClone(Elem.byId('download-icon'));
        downloadSVG.style.display = "inline";  // Make visible

        link.appendChild(downloadSVG);
        linkStyle.textDecoration = "none"; // to remove underline
        linkStyle.color = "#000";  // Set color for SVG

        const content = [video, link];
        const node = new Node();
        NodeView.windowify("Recorded Video", content, node);
        Graph.appendNode(node);
        Graph.addNode(node);
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
    },

    stopRecording(){
        this.mediaRecorder.stop();
        this.endStream(this.mediaStream);
    },
    endStream(stream){
        // Stop all tracks in the stream to end it
        stream.getTracks().forEach( (track)=>track.stop() )
    },

    init(){
        //screenshot button moved to neuralapi.js
        On.click(Elem.byId('recordButton'), this.onRecordButtonClicked)
    },

    onRecordButtonClicked(e){
        const button = e.currentTarget;
        if (Recorder.mediaRecorder?.state === 'recording') {
            Recorder.stopRecording();
            button.textContent = "Record";
        } else {
            Recorder.startRecording();
            button.textContent = '\u275A\u275A'; // Double Vertical Bar unicode
        }
    }
}
