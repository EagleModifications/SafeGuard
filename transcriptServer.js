const express = require("express");
const serveIndex = require("serve-index");
const path = require("path");

function startTranscriptServer() {
    const app = express();
    const transcriptsPath = path.join(__dirname, "transcripts");

    // Serve transcript files
    app.use("/transcripts", express.static(transcriptsPath));

    // Enable directory listing
    app.use("/transcripts", serveIndex(transcriptsPath, { icons: true }));

    const PORT = 3001;
    app.listen(PORT, () => {
        console.log(`📄 Transcript server running at http://localhost:${PORT}/transcripts/`);
    });
}

module.exports = startTranscriptServer;
