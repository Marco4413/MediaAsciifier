
/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement|HTMLVideoElement} frame
 * @param {String} brightnessTable
 * @param {Number} scaledWidth
 * @returns {String}
 */
const AsciifyFrame = (canvas, frame, brightnessTable, scaledWidth = 1000, sampleSize = 4) => {
    let frameWidth, frameHeight;
    if (frame.tagName === "VIDEO")
        frameWidth = frame.videoWidth, frameHeight = frame.videoHeight;
    else frameWidth = frame.width, frameHeight = frame.height;
    if (frameWidth <= 0 || frameHeight <= 0) return "Warning: Invalid Input Size.";

    const aspectRatio = frameHeight / frameWidth;
    canvas.width = scaledWidth;
    canvas.height = aspectRatio * canvas.width / 2;
    if (canvas.width <= 0 || canvas.height <= 0) return "Warning: Invalid Output Size.";

    const ctx = canvas.getContext("2d");
    ctx.drawImage(frame, 0, 0, frameWidth, frameHeight, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let result = "";
    for (let y = 0; y < imageData.height; y += sampleSize) {
        for (let x = 0; x < imageData.width; x += sampleSize) {
            const baseIndex = (imageData.width * y + x) * 4;

            let averageColor = 0, pixels = 0;
            for (let sy = 0; sy < sampleSize && y + sy < imageData.height; sy++) {
                for (let sx = 0; sx < sampleSize && x + sx < imageData.width; sx++) {
                    pixels++;

                    const fullIndex = baseIndex + sampleSize * sy + sx;
                    averageColor += (
                        imageData.data[ fullIndex ] +
                        imageData.data[fullIndex+1] +
                        imageData.data[fullIndex+2]
                    ) / 3;
                }
            }

            if (pixels > 0) averageColor /= pixels;
            const asciiChar = brightnessTable[
                Math.round((1 - averageColor / 255) * (brightnessTable.length - 1))
            ];

            result += asciiChar;
        }
        result += "\n";
    }

    return result;
};

/**
 * @template {HTMLElement} T
 * @param {T} el
 * @param {(el: T) => Void} setter
 * @returns {T}
 */
const AddChangeEventListener = (el, setter) => {
    el.addEventListener("change", () => setter(el));
    setter(el);
    return el;
};

window.addEventListener("load", () => {
    /** @type {HTMLImageElement} */
    const inputImage = document.getElementById("input-image");
    /** @type {HTMLVideoElement} */
    const inputVideo = document.getElementById("input-video");
    
    const outputAscii = document.getElementById("output-ascii");
    const canvas = document.createElement("canvas");
    
    /** @type {HTMLImageElement|HTMLVideoElement} */
    let srcMedia = null, newMedia = true, slowMedia = false;

    /** @type {HTMLSpanElement} */
    const slowMediaFlag = document.getElementById("slow-media-flag");
    const FlagMedia = (_newMedia = true, _slowMedia = false) => {
        if (_slowMedia !== slowMedia) slowMediaFlag.innerText = _slowMedia ? "🟠 Media is slow." : "🟢";
        newMedia = _newMedia;
        slowMedia = _slowMedia;
    };

    slowMediaFlag.addEventListener("click", () => {
        FlagMedia(false, false);
    });

    /** @param {Object} source */
    const SetMedia = (source, isImage = true) => {
        if (isImage) {
            inputImage.classList.remove("hidden");
            inputVideo.classList.add("hidden");
            inputVideo.pause();
            inputImage.src = source;
            srcMedia = inputImage;
        } else {
            inputImage.classList.add("hidden");
            inputVideo.classList.remove("hidden");
            if (typeof source === "string") {
                inputVideo.src = source;
                inputVideo.srcObject = null;
            } else {
                inputVideo.src = "";
                inputVideo.srcObject = source;
            }
            srcMedia = inputVideo;
        } FlagMedia();
    };

    FlagMedia();

    inputVideo.addEventListener("seeked", () => {
        FlagMedia();
    });

    inputVideo.addEventListener("play", () => {
        FlagMedia();
    });

    let slowMediaTime = 0;
    AddChangeEventListener(
        document.getElementById("slow-media-time"),
        el => {
            if (Number.isNaN(el.valueAsNumber) || el.valueAsNumber <= 0)
                el.value = "1";
            slowMediaTime = el.valueAsNumber * 1e3;
            FlagMedia();
        }
    );

    let brightnessTable = "";
    AddChangeEventListener(
        document.getElementById("brightness-table"),
        el => {
            brightnessTable = el.value;
            FlagMedia();
        }
    );

    let scaledWidth = 0;
    AddChangeEventListener(
        document.getElementById("output-scaled-width"),
        el => {
            if (Number.isNaN(el.valueAsNumber) || el.valueAsNumber <= 0)
                el.value = "1";
            scaledWidth = el.valueAsNumber;
            FlagMedia();
        }
    );

    let sampleSize = 1;
    AddChangeEventListener(
        document.getElementById("output-sample-size"),
        el => {
            if (Number.isNaN(el.valueAsNumber) || el.valueAsNumber <= 0)
                el.value = "1";
            sampleSize = el.valueAsNumber;
            FlagMedia();
        }
    );

    AddChangeEventListener(
        document.getElementById("output-font-size"),
        el => outputAscii.style.fontSize = el.value
    );

    const mediaReader = new FileReader();
    mediaReader.addEventListener("load", ev => {
        const result = ev.target.result;
        SetMedia(result, result.startsWith("data:image"));
    });

    /** @type {HTMLInputElement} */
    const sourceFilePicker = document.getElementById("source-media");
    sourceFilePicker.addEventListener("input", ev => {
        const files = ev.target.files;
        if (files == null || files[0] == null) return;
        mediaReader.readAsDataURL(files[0]);
    });

    /** @type {MediaStream} */
    let currentMediaStream = null;
    const SetMediaStream = stream => {
        if (currentMediaStream != null) {
            const track = currentMediaStream.getVideoTracks()[0];
            if (track != null) track.stop();
        } currentMediaStream = stream;
        
        sourceFilePicker.value = null;
        if (stream != null) {
            const track = currentMediaStream.getVideoTracks()[0];
            if (track != null) track.addEventListener("ended", () => {
                currentMediaStream = null;
                SetMedia(null, false);
            });
        }
        
        SetMedia(stream, false);
    };

    /** @type {HTMLButtonElement} */
    const screenCapture = document.getElementById("screen-capture");
    screenCapture.addEventListener("click", async () => {
        SetMediaStream(await navigator.mediaDevices.getDisplayMedia({ "audio": false, "video": true }));
    });

    /** @type {HTMLButtonElement} */
    const webcamCapture = document.getElementById("webcam-capture");
    webcamCapture.addEventListener("click", async () => {
        SetMediaStream(await navigator.mediaDevices.getUserMedia({ "audio": false, "video": true }));
    });

    let lastFrameTime = Date.now();
    const UpdateOutput = () => {
        const currentFrameTime = Date.now();
        if (srcMedia != null && (!slowMedia) && (newMedia || srcMedia.tagName === "VIDEO" && !srcMedia.paused)) {
            outputAscii.innerText = AsciifyFrame(
                canvas, srcMedia,
                brightnessTable,
                scaledWidth, sampleSize
            );

            if (newMedia) newMedia = false;

            const deltaTime = currentFrameTime - lastFrameTime;
            FlagMedia(false, deltaTime > slowMediaTime);
            if (slowMedia) console.warn(`WARN: Media is slow to process, a single frame took ${deltaTime}ms, stopping any loop.`)
        }

        lastFrameTime = currentFrameTime;
        requestAnimationFrame(UpdateOutput);
    };

    UpdateOutput();
});
