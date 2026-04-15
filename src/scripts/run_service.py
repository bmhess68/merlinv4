from email_processor import CADEmailProcessor
import time
import schedule
import logging
from pathlib import Path
from dotenv import load_dotenv
import os

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.parent.parent
ENV_PATH = os.path.join(PROJECT_ROOT, '.env')

# Load environment variables
load_dotenv(ENV_PATH)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def check_emails_job():
    try:
        logging.info("Checking for new CAD emails...")
        processor = CADEmailProcessor()
        processor.check_emails()
    except Exception as e:
        logging.error(f"Error in check_emails_job: {e}")

def main():
    logging.info("Starting CAD email monitor service...")
    
    # Run immediately on startup
    check_emails_job()
    
    # Schedule to run every 30 seconds instead of every minute
    schedule.every(30).seconds.do(check_emails_job)
    
    # Keep the script running
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    main()