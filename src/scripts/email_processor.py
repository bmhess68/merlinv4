import email
import imaplib
import re
from datetime import datetime, timedelta
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
import pytz

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Get the project root directory (2 levels up from scripts folder)
PROJECT_ROOT = Path(__file__).parent.parent.parent
ENV_PATH = os.path.join(PROJECT_ROOT, '.env')

# Load environment variables from the correct path
load_dotenv(ENV_PATH)

class CADEmailProcessor:
    def __init__(self):
        self.email_user = os.getenv('EMAIL_USER')
        self.email_pass = os.getenv('EMAIL_PASSWORD')
        self.email_server = os.getenv('EMAIL_SERVER', 'imap.gmail.com')
        
        # Updated database configuration
        self.db_config = {
            'dbname': 'incidentdb',
            'user': 'wcpd',
            'password': os.getenv('DB_PASSWORD'),
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432')
        }

    def parse_cad_message(self, message_text):
        try:
            # Join all lines and clean up extra whitespace
            message_lines = message_text.strip().split('\n')
            full_message = ' '.join(line.strip() for line in message_lines)
            
            logging.info(f"Processed message content:")
            logging.info(full_message)
            
            # Updated pattern to capture full event number including dash and numbers
            pattern = r"""
                ([^,]+),\s*                     # Street
                ([^,]+),\s*                     # City
                Cross:\s*([^,]+),\s*            # Cross street
                Type:([^,]+),\s*                # Type
                Time\s+out:\s*(\d{2}:\d{2}:\d{2})\s*Area:\s*([^,]+),\s*  # Time and Area
                Alarm\s+lev:\s*(\d+),\s*        # Alarm level
                Comments:\s*([^,]+),\s*         # Comments
                ([^,]+),\s*                     # Contact
                http://maps\.google\.com/\?q=(\d+\.\d+),(-\d+\.\d+),\s*   # Lat/Lon
                Event\s+Number:\s*(\w+[-\d]*)   # Event number - updated to include dash and numbers
            """
            
            match = re.match(pattern, full_message, re.VERBOSE | re.IGNORECASE)
            if not match:
                logging.error("Message format doesn't match expected pattern")
                logging.error(f"Processed message: {full_message}")
                parts = full_message.split(',')
                logging.error("Message parts:")
                for i, part in enumerate(parts):
                    logging.error(f"Part {i}: {part.strip()}")
                return None

            # Extract all groups
            groups = match.groups()
            
            cad_data = {
                'address': f"{groups[0]}, {groups[1]}".strip(),
                'cross_street': groups[2].strip(),
                'call_type': groups[3].strip(),
                'time_out': datetime.combine(datetime.now().date(), 
                                           datetime.strptime(groups[4], '%H:%M:%S').time()),
                'area': groups[5].strip(),
                'alarm_level': int(groups[6]),
                'comments': groups[7].strip(),
                'contact': groups[8].strip(),
                'latitude': float(groups[9]),
                'longitude': float(groups[10]),
                'event_number': groups[11].strip(),
                'expires_at': datetime.now() + timedelta(minutes=30)
            }
            
            logging.info(f"Successfully parsed data: {cad_data}")
            return cad_data
            
        except Exception as e:
            logging.error(f"Error parsing CAD message: {e}")
            logging.error(f"Message text: {message_text}")
            return None

    def save_to_database(self, cad_data):
        try:
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Check if event already exists
                    cur.execute("SELECT id FROM cad_alerts WHERE event_number = %s", 
                              (cad_data['event_number'],))
                    if cur.fetchone():
                        logging.info(f"Event {cad_data['event_number']} already exists in database")
                        return None

                    query = """
                        INSERT INTO cad_alerts (
                            address, cross_street, call_type, time_out, 
                            area, alarm_level, comments, contact,
                            latitude, longitude, event_number, expires_at
                        ) VALUES (
                            %(address)s, %(cross_street)s, %(call_type)s, %(time_out)s,
                            %(area)s, %(alarm_level)s, %(comments)s, %(contact)s,
                            %(latitude)s, %(longitude)s, %(event_number)s, %(expires_at)s
                        )
                        RETURNING id;
                    """
                    cur.execute(query, cad_data)
                    result = cur.fetchone()
                    conn.commit()
                    logging.info(f"Saved CAD alert with ID: {result['id']}")
                    return result['id']
        except Exception as e:
            logging.error(f"Database error saving event: {e}")
            return None

    def decode_email_content(self, email_message):
        try:
            if email_message.is_multipart():
                for part in email_message.walk():
                    if part.get_content_type() == "text/plain":
                        try:
                            return part.get_payload(decode=True).decode('utf-8')
                        except UnicodeDecodeError:
                            try:
                                return part.get_payload(decode=True).decode('latin-1')
                            except:
                                logging.error("Failed to decode message")
                                return None
            else:
                try:
                    return email_message.get_payload(decode=True).decode('utf-8')
                except UnicodeDecodeError:
                    try:
                        return email_message.get_payload(decode=True).decode('latin-1')
                    except:
                        logging.error("Failed to decode message")
                        return None
        except Exception as e:
            logging.error(f"Error decoding email: {e}")
            return None

    def check_emails(self):
        try:
            logging.info("Checking for new CAD emails...")
            logging.info("Connecting to email server...")
            mail = imaplib.IMAP4_SSL(self.email_server)
            mail.login(self.email_user, self.email_pass)
            mail.select('inbox')

            # Get date in EST/EDT timezone
            eastern = pytz.timezone('America/New_York')
            local_date = datetime.now(eastern)
            search_date = local_date.strftime("%d-%b-%Y")
            
            logging.info(f"Searching for messages since {search_date} (Eastern Time)...")
            search_criteria = f'(SINCE "{search_date}")'
            logging.info(f"Search criteria: {search_criteria}")
            
            _, messages = mail.search(None, search_criteria)
            
            if not messages[0]:
                logging.info("No messages found")
                return

            for msg_num in messages[0].split():
                try:
                    _, msg_data = mail.fetch(msg_num, '(RFC822)')
                    email_body = msg_data[0][1]
                    email_message = email.message_from_bytes(email_body)
                    
                    message_text = self.decode_email_content(email_message)
                    if message_text:
                        logging.info("Raw message content:")
                        logging.info(message_text)
                        cad_data = self.parse_cad_message(message_text)
                        if cad_data:
                            self.save_to_database(cad_data)
                            logging.info(f"Successfully processed CAD alert: {cad_data['event_number']}")
                        else:
                            logging.info("Message did not match CAD format. Check regex pattern.")

                except Exception as e:
                    logging.error(f"Error processing message {msg_num}: {e}")

            mail.close()
            mail.logout()
            logging.info("Email check completed")

        except Exception as e:
            logging.error(f"Error checking emails: {e}")
