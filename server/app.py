"""
API endpoints for uploading an audio file and responding with Transcription, 
Annotations, and Narrative.
"""

import os
from time import sleep
from pathlib import Path

import requests
from requests.exceptions import (
    RequestException,
    HTTPError,
    ConnectionError,
    Timeout,
    RetryError,
)
from dotenv import load_dotenv
from flask import Flask, Request, request

from kaju_module.openAI_flask import getTheStuffFromTheAI

app = Flask(__name__)

load_dotenv()
app.config["GLADIA_API_KEY"] = os.getenv("GLADIA_API_KEY")

BASE_DIR = Path(__file__).parent
AUDIO_DIR = BASE_DIR / "audio"

# keep audio file path as Path object
app.config["uploaded_audio_path"] = None


@app.post("/upload")
def upload():
    """
    Receive the uploaded audio file, save it, and confirm that it was saved,
    before responding with 'success'.
    """
    if "audio-file" not in request.files:
        return {
            "success": False,
            "msg": "Missing form field 'audio-file'. No file was uploaded.",
        }

    file = request.files["audio-file"]
    uploaded_audio_path = AUDIO_DIR / (file.filename or "audio_file.webm")
    app.config["uploaded_audio_path"] = uploaded_audio_path
    file.save(uploaded_audio_path)

    if not uploaded_audio_path.exists():
        return {
            "success": False,
            "msg": "There was a problem saving the file to the server. Try uploading again.",
        }

    return {"success": True, "msg": f"Received upload of file: '{file.filename}'."}


@app.route("/result")
def result():
    """
    Respond with Transcription, Annotations, and Narrative in JSON.
    * Make Gladia API calls to get the Transcription.
    * Use [TEMP NAME] <kaju_module> to send the Transcription to AI and receive
    Annotations and Narrative.
    """

    uploaded_audio_path = app.config["uploaded_audio_path"]
    assert uploaded_audio_path and uploaded_audio_path.exists()

    audio_url = None
    upload_resp_json = None
    try:
        upload_resp_json = gladia_upload(uploaded_audio_path)
        assert upload_resp_json
        print("Upload response with File ID:", upload_resp_json)
        audio_url = upload_resp_json.get("audio_url")
        assert audio_url
    except Exception as e:
        msg = f"An error occurred when uploading the audio to Gladia: {e}"
        print(f"ERROR: {msg}")
        return {"error": msg}

    transcript_headers = {
        "x-gladia-key": app.config["GLADIA_API_KEY"],
        "Content-Type": "application/json",
    }

    result_url = None
    try:
        start_transcript_resp_json = gladia_start_transcript(
            audio_url, transcript_headers
        )
        assert start_transcript_resp_json
        print("Post Response:", start_transcript_resp_json)
        result_url = start_transcript_resp_json.get("result_url")
        assert result_url
    except Exception as e:
        msg = f"An error occurred when initializing the transcript with Gladia: {e}" 
        print(f"ERROR: {msg}")
        return {"error": msg}
    
    gladia_result = None
    try:
        gladia_result = gladia_poll_for_result(result_url, transcript_headers)
    except Exception as e:
        msg = f"An error occurred when polling Gladia for the completed transcription."
        print(f"ERROR: {msg}")
        return {"error": msg}

    print("Transcription result:", gladia_result)

    # IAN: handle error -- if not result: ...
    transcript = gladia_result["transcription"]["full_transcript"]
    annotations, narrative = getTheStuffFromTheAI(transcript)

    print("- End of work")

    return {
        "error": None,
        "status": "done",
        "transcript": transcript,
        "annotations": annotations,
        "narrative": narrative,
    }


def gladia_upload(uploaded_audio_path):
    print("- Uploading file to Gladia...")
    headers = {
        "x-gladia-key": app.config["GLADIA_API_KEY"],
        "accept": "application/json",
    }
    with open(uploaded_audio_path, "rb") as f:
        file_content = f.read()
    file = (
        "audio",
        (
            uploaded_audio_path.name,
            file_content,
            "audio/" + uploaded_audio_path.suffix[1:],
        ),
    )
    RETRIES = 5
    for attempt in range(RETRIES):
        response = None
        try:
            response = requests.post(
                "https://api.gladia.io/v2/upload/",
                headers=headers,
                files=[file],
                timeout=10,
            )
            response.raise_for_status()  # raise if bad status code
            resp_json = response.json()
            return resp_json
        except (Timeout, ConnectionError) as e:
            print(e)
            sleep(2)
            continue
        except HTTPError as e:
            # for now, assume we cannot recover from a bad response
            raise e
        except Exception as e:
            # what other kinds of errors can be thrown?
            raise e
    raise RetryError


def gladia_start_transcript(audio_url, transcript_headers):
    print("- Initializing Gladia transcription...")
    req_json = {
        "audio_url": audio_url,
        "diarization": True,
    }
    RETRIES = 5
    for attempt in range(RETRIES):
        response = None
        try:
            response = requests.post(
                "https://api.gladia.io/v2/transcription/",
                headers=transcript_headers,
                json=req_json,
                timeout=5,
            )
            response.raise_for_status()
            resp_json = response.json()
            return resp_json
        except (Timeout, ConnectionError) as e:
            print(e)
            sleep(2)
            continue
        except HTTPError as e:
            # for now, assume we cannot recover from a bad response
            raise e
        except Exception as e:
            # what other kinds of errors can be thrown?
            raise e
    raise RetryError


def gladia_poll_for_result(result_url, transcript_headers):
    print("- Polling for results...")
    SLEEP_SEC = 2
    TIMEOUT_SEC = 180  # try for about 3 minutes (longer if retry on status: error)
    RETRIES = TIMEOUT_SEC // SLEEP_SEC
    for attempt in range(RETRIES):
        try:
            response = requests.get(
                result_url,
                headers=transcript_headers,
                timeout=SLEEP_SEC,
            )
            response.raise_for_status()
            resp_json = response.json()
            status = resp_json.get("status")
            print("- Transcription status:", status)
            if status in ("queued", "processing"):
                sleep(SLEEP_SEC)
                continue
            if status == "done":
                print("- Transcription done: \n")
                return resp_json.get("result")
            if status == "error":
                # TODO: retry on status: error? if so, use a separate retry count
                raise Exception(f"Gladia returned 'status: error'. Response: {resp_json}.")
        except (Timeout, ConnectionError) as e:
            print(e)
            print("- Retrying...")
            sleep(2)
            continue
        except HTTPError as e:
            # for now, assume we cannot recover from a bad response
            raise e
        except Exception as e:
            # what other kinds of errors can be thrown?
            raise e
    raise RetryError


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)


"""
Under what conditions will each request fail?

UPLOAD
    - timeout - try again
    - no api key / bad url

START TRANSCRIPT
    - timeout - try again
    - audio file corrupted at any point in the flow
    - no api key / bad url

POLL FOR RESULT
    - timeout - try again
    - no api key / bad url

"""
