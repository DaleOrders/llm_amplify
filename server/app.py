import os
from time import sleep # from Gladia
from pathlib import Path
#import wave

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request

# import LLM module
from kaju_module.openAI_flask import getTheStuffFromTheAI


load_dotenv()

app = Flask(__name__)

BASE_DIR = Path(__file__).parent

AUDIO_DIR = BASE_DIR / 'audio'

uploaded_audio_path: Path | None = None


@app.post('/upload') # IAN: change to @app.post
def upload():
    if 'audio-file' not in request.files:
        return {
            'success': False, 
            'msg': "Missing form field 'audio-file'. No file was uploaded."
        }
    
    file = request.files['audio-file']
    global uploaded_audio_path
    uploaded_audio_path = AUDIO_DIR / (file.filename or 'audio_file.webm')
    file.save(uploaded_audio_path)

    if not uploaded_audio_path.exists():
        return {
            'success': False, 
            'msg': "There was a problem saving the file to the server. Try uploading again."
        }

    return {
        'success': True,
        'msg': f"Received upload of file: '{file.filename}'."
    }


@app.route('/result')
def result():
    GLADIA_API_KEY = os.getenv("GLADIA_API_KEY")

    # from gladia <get result>
    def make_request(url, headers, method="GET", data=None, files=None):
        if method == "POST":
            response = requests.post(url, headers=headers, json=data, files=files)
        else:
            response = requests.get(url, headers=headers)
        return response.json()

    print(os.getcwd())

    global uploaded_audio_path
    if not uploaded_audio_path or not uploaded_audio_path.exists():
        raise Exception("Cannot find uploaded audio.")  # IAN: fail in this case -- must have the audio file

    with open(uploaded_audio_path, "rb") as f:  # Open the file
        file_content = f.read()  # Read the content of the file

    upload_headers = {
        "x-gladia-key": GLADIA_API_KEY,
        "accept": "application/json",
    }
    
    file_extension = uploaded_audio_path.suffix
    files = [("audio", (uploaded_audio_path.as_posix(), file_content, "audio/" + file_extension[1:]))]

    print("- Uploading file to Gladia...")
    upload_response = make_request(
        "https://api.gladia.io/v2/upload/", upload_headers, "POST", files=files
    )
    print("Upload response with File ID:", upload_response)
    audio_url = upload_response.get("audio_url")

    data = {
        "audio_url": audio_url,
        "diarization": True,
    }
    # You can also send an URL directly without uploading it. Make sure it's the direct link and publicly accessible.
    # For any parameters, please see: https://docs.gladia.io/api-reference/pre-recorded-flow

    fetch_result_headers = {
        "x-gladia-key": GLADIA_API_KEY,
        "Content-Type": "application/json",
    }

    print("- Sending request to Gladia API...")
    post_response = make_request(
        "https://api.gladia.io/v2/transcription/", fetch_result_headers, "POST", data=data
    )

    print("Post response with Transcription ID:", post_response)
    result_url = post_response.get("result_url")

    # IAN: handle error -- if not result_url:...

    result = None
    while True:
        print("Polling for results...")
        poll_response = make_request(result_url, fetch_result_headers)

        status = poll_response.get("status")
        if status == "done":
            print("- Transcription done: \n")
            result = poll_response.get("result")
            print(result)
            break
        elif status == "error":
            print("- Transcription failed")
            print(poll_response)
            return { 'status': 'failed' }
        else:
            print("- Transcription status:", status)
        sleep(1)

    # IAN: handle error -- if not result: ...
    transcript = result['transcription']['full_transcript']
    annotations, narrative = getTheStuffFromTheAI(transcript)

    print("- End of work")

    return {
        'status': 'done',
        'transcript': transcript,
        'annotations': annotations,
        'narrative': narrative
    }


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)