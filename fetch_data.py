import requests
import hashlib
import json
from flask import Flask, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import pytz
from datetime import datetime, timedelta
import threading
import time
import os
import sys

# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Zello API Configuration
ZELLO_NETWORK_URL = "https://westchesterputnamrtc.zellowork.com"
ZELLO_API_KEY = "YEKOOGRL2C6W3VSV1OP7TH6KJM4JIPSH"
ZELLO_USERNAME = "kmccarrick"
ZELLO_PASSWORD = "Wcpd#1145/3061"

# Bounding Box Coordinates
northeast = (43.3, -70.7)
southwest = (39.5, -82.8)

# Global variable to track the last successful update
last_update_time = datetime.now()

def get_token():
    url = f"{ZELLO_NETWORK_URL}/user/gettoken"
    headers = {'Content-Type': 'application/json', 'X-Auth-Token': ZELLO_API_KEY}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        response_data = response.json()
        if response_data.get('status') == 'OK':
            return response_data.get('token'), response_data.get('sid')
        else:
            raise Exception(f"Failed to get token: {response_data.get('status')} ({response_data.get('code')})")
    except requests.RequestException as e:
        logger.error(f"Network error while getting token: {str(e)}")
        raise

def login(token, sid):
    url = f"{ZELLO_NETWORK_URL}/user/login?sid={sid}"
    headers = {'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Token': ZELLO_API_KEY}
    password_hash = hashlib.md5(ZELLO_PASSWORD.encode('utf-8')).hexdigest()
    auth_password = hashlib.md5((password_hash + token + ZELLO_API_KEY).encode('utf-8')).hexdigest()
    data = {'username': ZELLO_USERNAME, 'password': auth_password}
    try:
        response = requests.post(url, headers=headers, data=data)
        response.raise_for_status()
        response_data = response.json()
        if response_data.get('status') == 'OK':
            return sid
        else:
            raise Exception(f"Failed to log in: {response_data.get('status')} ({response_data.get('code')})")
    except requests.RequestException as e:
        logger.error(f"Network error while logging in: {str(e)}")
        raise

def get_location_data(session_id):
    url = (f"{ZELLO_NETWORK_URL}/location/get?sid={session_id}"
           f"&northeast[]={northeast[0]}&northeast[]={northeast[1]}"
           f"&southwest[]={southwest[0]}&southwest[]={southwest[1]}"
           f"&filter=none")
    headers = {'Content-Type': 'application/json', 'X-Auth-Token': ZELLO_API_KEY}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        response_data = response.json()
        if response_data.get('status') == 'OK':
            logger.info(f"Retrieved {response_data.get('total', 0)} locations from Zello API")
            return response_data['locations']
        else:
            raise Exception(f"Failed to get location data: {response_data.get('status')} ({response_data.get('code')})")
    except requests.RequestException as e:
        logger.error(f"Network error while getting location data: {str(e)}")
        raise

def filter_last_24_hours(locations):
    current_time = int(time.time())
    twenty_four_hours_ago = current_time - (24 * 60 * 60)
    filtered = [loc for loc in locations if loc.get('lastReport', 0) >= twenty_four_hours_ago]
    logger.info(f"Filtered {len(filtered)} locations from the last 24 hours out of {len(locations)} total")
    return filtered

def create_geojson(location_data):
    features = []
    for location in location_data:
        lat = location.get('latitude')
        lon = location.get('longitude')
        if lat is not None and lon is not None:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]
                },
                "properties": {
                    "displayName": location.get('displayName', 'Unknown'),
                    "heading": location.get('heading', 0)
                }
            })
    return {
        "type": "FeatureCollection",
        "features": features
    }

def update_locations():
    global last_update_time
    retry_count = 0
    max_retries = 3
    
    while retry_count < max_retries:
        try:
            logger.info("Starting location update...")
            token, sid = get_token()
            logger.debug("Token obtained successfully")
            session_id = login(token, sid)
            logger.debug("Logged in successfully")
            location_data = get_location_data(session_id)
            filtered_data = filter_last_24_hours(location_data)
            geojson_data = create_geojson(filtered_data)

            # Send the full data in a single request
            logger.info(f"Sending {len(geojson_data['features'])} features to server")
            response = requests.post('http://localhost:3000/update-locations', json=geojson_data)
            response.raise_for_status()
            logger.info("Location data updated successfully on server")
            
            # Update the last successful update time
            last_update_time = datetime.now()
            break  # Success, exit the retry loop
            
        except requests.exceptions.ConnectionError as e:
            retry_count += 1
            logger.warning(f"Connection error (attempt {retry_count}/{max_retries}): {str(e)}")
            if retry_count < max_retries:
                time.sleep(5)  # Wait before retrying
            else:
                logger.error("Max retries exceeded. Could not connect to server.")
        except Exception as e:
            logger.error(f"Failed to update location data: {str(e)}")
            break  # For non-connection errors, don't retry

def watchdog():
    global last_update_time
    while True:
        time.sleep(120)  # Check every 30 seconds
        if (datetime.now() - last_update_time) > timedelta(seconds=30):
            logger.error("No updates for 30 seconds. Restarting the script.")
            os.execv(sys.executable, ['python'] + sys.argv)  # Restart the script

# Setup Scheduler
scheduler = BackgroundScheduler(timezone=pytz.UTC)
scheduler.add_job(update_locations, 'interval', seconds=2, max_instances=1, coalesce=True, misfire_grace_time=None)
scheduler.start()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "last_update": last_update_time.isoformat()}), 200

def run_flask():
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    # Start the Flask app in a separate thread
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    # Start the watchdog in a separate thread
    watchdog_thread = threading.Thread(target=watchdog, daemon=True)
    watchdog_thread.start()

    try:
        # Keep the main thread alive and run update_locations once immediately
        update_locations()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        scheduler.shutdown()
