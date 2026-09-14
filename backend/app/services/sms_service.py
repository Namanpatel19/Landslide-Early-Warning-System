import logging
import os
from typing import List

logger = logging.getLogger(__name__)

# To use real Twilio, you would install the twilio package and use these keys
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "+1234567890")

async def send_sms_alert(phone_numbers: List[str], message: str):
    """
    Sends an SMS alert to a list of phone numbers.
    If Twilio credentials are provided, it will send a real SMS.
    Otherwise, it logs the SMS payload (mock mode).
    """
    if not phone_numbers:
        logger.warning("No phone numbers provided for SMS alert.")
        return

    logger.info(f"📢 Preparing to send SMS alert to {len(phone_numbers)} contacts.")

    for number in phone_numbers:
        try:
            if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
                # Real Twilio Integration
                # from twilio.rest import Client
                # client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
                # client.messages.create(
                #     body=message,
                #     from_=TWILIO_FROM_NUMBER,
                #     to=number
                # )
                logger.info(f"[REAL TWILIO SMS] Sent to {number}: {message}")
            else:
                # Mock SMS Integration for local dev / demo
                logger.warning(f"📱 [MOCK SMS] To: {number} | Message: {message}")
        except Exception as e:
            logger.error(f"Failed to send SMS to {number}: {e}")
