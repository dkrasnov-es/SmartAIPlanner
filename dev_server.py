import os
from flask import Flask, request, jsonify, send_from_directory
import requests

# Set environment variables directly
os.environ.setdefault('GEMINI_API_KEY', 'AIzaSyBExK5OPJytLpj1-IKCqgzZPrWzpMjK1ds')
os.environ.setdefault('GEMINI_MODEL', 'gemini-1.5-flash')

app = Flask(__name__, static_folder='.', static_url_path='')


@app.route('/')
def root():
    return send_from_directory('.', 'index.html')


@app.route('/api/gemini', methods=['POST'])
def api_gemini():
    data = request.get_json(silent=True) or {}
    goal = (data.get('goal') or '').strip()
    prompt = (data.get('prompt') or '').strip()
    if not goal and not prompt:
        return jsonify(error='Missing goal or prompt'), 400

    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify(error='Server missing GEMINI_API_KEY env var'), 500

    final_prompt = prompt or f"Break down this goal into 3–5 achievable tasks: {goal}. Return either a bullet list or a JSON array of strings."

    # Use latest generally-available model; can override with GEMINI_MODEL env var
    model = os.environ.get('GEMINI_MODEL', 'gemini-1.5-flash')
    url = f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": final_prompt}
                ]
            }
        ]
    }
    try:
        resp = requests.post(url, json=payload, timeout=30)
        # Log upstream response for debugging
        try:
            print('\n[Gemini upstream]', resp.status_code, resp.text[:500])
        except Exception:
            pass
        resp.raise_for_status()
        body = resp.json()
        text = (
            (body.get('candidates') or [{}])[0]
            .get('content', {})
            .get('parts', [{}])[0]
            .get('text', '')
        )
        return jsonify(text=text)
    except requests.HTTPError as e:
        status = getattr(e.response, 'status_code', 502) or 502
        details = getattr(e.response, 'text', '')
        return jsonify(error=f"Upstream error {status}", details=details), status
    except Exception as e:
        return jsonify(error=str(e)), 500


if __name__ == '__main__':
    # Runs on http://127.0.0.1:8080
    app.run(host='127.0.0.1', port=8080, debug=False)


