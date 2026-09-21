import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from ..config import settings
from ..database import SmsLogModel, AsyncSessionLocal

logger = logging.getLogger(__name__)

async def send_critical_alert_sms(location: str, risk_score: float):
    """
    Sends an SMS alert using Twilio to the configured TEST_SMS_NUMBERS.
    Fails gracefully if Twilio is not configured or limits are reached.
    """
    if not settings.has_twilio:
        logger.info("Twilio SMS is not configured. Skipping SMS alert.")
        return

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    except Exception as e:
        logger.warning(f"Failed to initialize Twilio client: {e}")
        return

    message_body = (
        f"AI-Based Risk Monitoring NER Alert: Critical landslide risk detected near {location}. "
        f"Risk: {risk_score * 100:.1f}%. "
        f"Please avoid the area and follow local authority guidance."
    )

    test_numbers = [num.strip() for num in settings.TEST_SMS_NUMBERS.split(",") if num.strip()]
    if not test_numbers:
        logger.warning("No TEST_SMS_NUMBERS configured for SMS alerts.")
        return

    
    async with AsyncSessionLocal() as db:
        for number in test_numbers:
            status = "pending"
            try:
                message = client.messages.create(
                    body=message_body,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=number
                )
                status = "sent"
                logger.info(f"SMS sent to {number}: {message.sid}")
            except Exception as e:
                status = "failed"
                logger.warning(f"Twilio SMS failed to {number}: {e}")
            
            # Log to DB
            sms_log = SmsLogModel(
                recipient=number,
                message=message_body,
                status=status,
                timestamp=datetime.now(timezone.utc)
            )
            db.add(sms_log)
        
        await db.commit()
