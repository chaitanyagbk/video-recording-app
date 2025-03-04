const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const cors = require('cors');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Ensure recording directories exist
const chunksDir = path.join(__dirname, 'recordings', 'chunks');
const outputDir = path.join(__dirname, 'recordings', 'output');

if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Create a unique identifier for this recording session
  const sessionId = Date.now().toString();
  const sessionDir = path.join(chunksDir, sessionId);
  
  // Create directory for this session's chunks
  fs.mkdirSync(sessionDir, { recursive: true });
  
  let chunkCounter = 0;
  
  ws.on('message', (message) => {
    try {
      // Check if this is a control message (like RECORDING_COMPLETE)
      if (message instanceof Buffer) {
        // This is a video chunk
        const chunkFilename = path.join(sessionDir, `chunk_${chunkCounter.toString().padStart(6, '0')}.webm`);
        fs.writeFileSync(chunkFilename, message);
        chunkCounter++;
      } else {
        // Try to parse as JSON control message
        const controlMessage = JSON.parse(message.toString());
        
        if (controlMessage.type === 'RECORDING_COMPLETE') {
          console.log('Recording complete, merging chunks...');
          mergeVideoChunks(sessionId, sessionDir);
        }
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    // If the connection closes before receiving RECORDING_COMPLETE, 
    // still try to merge the chunks
    if (chunkCounter > 0) {
      mergeVideoChunks(sessionId, sessionDir);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Function to merge video chunks using FFmpeg
function mergeVideoChunks(sessionId, chunksDirectory) {
  const chunks = fs.readdirSync(chunksDirectory)
    .filter(file => file.startsWith('chunk_') && file.endsWith('.webm'))
    .sort(); // Ensure correct order
  
  if (chunks.length === 0) {
    console.error('No chunks found to merge');
    return;
  }

  // Dynamically build the concat command
  const concatInput = chunks.map(chunk => path.join(chunksDirectory, chunk)).join('|');
  
  // Output file path
  const outputFilePath = path.join(outputDir, `recording_${sessionId}.webm`);

  // FFmpeg command using concat method
  const ffmpegCommand = `ffmpeg -i "concat:${concatInput}" -c copy "${outputFilePath}"`;

  exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error merging video chunks: ${error.message}`);
      return;
    }

    if (stderr) {
      console.log(`FFmpeg stderr: ${stderr}`);
    }

    console.log(`Successfully merged video chunks into ${outputFilePath}`);
  });
}


// Simple status endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Serve the final recordings for download
app.use('/recordings', express.static(outputDir));

// Get recordings list
app.get('/api/recordings', (req, res) => {
  try {
    const files = fs.readdirSync(outputDir)
      .filter(file => file.endsWith('.webm'))
      .map(file => ({
        name: file,
        url: `/recordings/${file}`,
        createdAt: fs.statSync(path.join(outputDir, file)).birthtime
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}`);
});