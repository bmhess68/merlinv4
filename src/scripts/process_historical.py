from email_processor import CADEmailProcessor

def process_historical():
    print("Starting historical email processing...")
    processor = CADEmailProcessor()
    # Process last 7 days of emails
    processor.process_historical_emails(days_back=7)

if __name__ == "__main__":
    process_historical()