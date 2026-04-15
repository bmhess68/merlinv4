from email_processor import CADEmailProcessor
import os
from dotenv import load_dotenv

load_dotenv()

def test_connection():
    print("\n=== Starting Email Test ===")
    print(f"Email User: {os.getenv('EMAIL_USER')}")
    print(f"Email Server: {os.getenv('EMAIL_SERVER', 'imap.gmail.com')}")
    
    processor = CADEmailProcessor()
    processor.check_emails()
    
    print("=== Test Complete ===\n")

if __name__ == "__main__":
    test_connection()