import React, { useState, useRef, useEffect } from 'react';
import './VideoRecorder.css';

const VideoRecorder: React.FC = () => {
  const [recording, setRecording] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const chunks = useRef<Blob[]>([]);
  const socketUrl = 'ws://localhost:5000';

  useEffect(() => {
    async function setupCamera(): Promise<void> {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        setStream(videoStream);

        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        alert('Failed to access camera and microphone. Please check permissions.');
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  const startRecording = (): void => {
    if (!stream) {
      alert('Camera stream not available');
      return;
    }

    const ws = new WebSocket(socketUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 1000000
      });

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          console.log('Chunk size:', event.data.size);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        }
      };
      

      recorder.start(1000);

      setMediaRecorder(recorder);
      setSocket(ws);
      setRecording(true);
    };

    ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
      alert('WebSocket connection error. Ensure the server is running.');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };
  };

  const stopRecording = (): void => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'RECORDING_COMPLETE' }));
        socket.close();
      }

      setRecording(false);
      setMediaRecorder(null);
      setSocket(null);
      chunks.current = [];
    }
  };

  return (
    <div className="video-recorder-container">
      <div className="video-preview">
        <video ref={videoRef} autoPlay muted playsInline />
      </div>

      <div className="controls">
        {!recording ? (
          <button className="start-button" onClick={startRecording}>
            Start Recording
          </button>
        ) : (
          <button className="stop-button" onClick={stopRecording}>
            Stop Recording
          </button>
        )}
      </div>

      {recording && <div className="recording-indicator">Recording in progress...</div>}
    </div>
  );
};

export default VideoRecorder;
