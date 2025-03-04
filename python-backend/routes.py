import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
router = APIRouter()
@router.websocket("/")
async def video_streaming(fe_websocket: WebSocket):
    candidate_id = 12

    await fe_websocket.accept()

    chunks = 0
    try:
        video_file_path = os.path.join("/media/chaitanya/New Volume/REACT-Projects/video-recording-app/recordings", "i_video.webm")
        with open(video_file_path, "wb") as video_fh:
            try:
                while True:
                    message = await fe_websocket.receive()

                    if "text" in message and message["text"] == "TRANSFER_COMPLETE":
                        break
                    elif "bytes" in message:
                        candidate_video = message["bytes"]
                        if not candidate_video:
                            continue
                        video_fh.write(candidate_video)

                        chunks += 1

                    else:
                        continue
            except WebSocketDisconnect:
                pass
            except Exception as e:
                pass
            video_fh.flush()
    except (OSError, IOError, PermissionError) as e:
        pass
    except Exception as e:
        pass
    if chunks > 0:
        pass
    else:
        print("Else")