import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db, PublicReportModel
from app.schemas import ReportResponse, ReportStatusUpdate
from app.services.gemini_service import analyze_landslide_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Public Reporting"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _extract_gps_from_exif(image_path: str):
    """Extracts GPS coordinates from image EXIF using piexif."""
    try:
        import piexif
        from PIL import Image
        
        exif_dict = piexif.load(image_path)
        if "GPS" in exif_dict and exif_dict["GPS"]:
            gps = exif_dict["GPS"]
            
            def convert_to_degrees(value):
                d = float(value[0][0]) / float(value[0][1])
                m = float(value[1][0]) / float(value[1][1])
                s = float(value[2][0]) / float(value[2][1])
                return d + (m / 60.0) + (s / 3600.0)
                
            lat = convert_to_degrees(gps[piexif.GPSIFD.GPSLatitude])
            if gps[piexif.GPSIFD.GPSLatitudeRef] != b'N':
                lat = -lat
                
            lon = convert_to_degrees(gps[piexif.GPSIFD.GPSLongitude])
            if gps[piexif.GPSIFD.GPSLongitudeRef] != b'E':
                lon = -lon
                
            return lat, lon
    except Exception as e:
        logger.debug(f"Could not extract EXIF GPS: {e}")
    return None, None


@router.post("/upload", response_model=ReportResponse)
async def upload_report(
    image: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    location_name: Optional[str] = Form("Unknown"),
    db: AsyncSession = Depends(get_db)
):
    """
    Public upload endpoint for crowdsourced landslide reporting.
    Requires multipart/form-data.
    """
    # 1. Save file locally
    ext = image.filename.split('.')[-1] if '.' in image.filename else 'jpg'
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as f:
        content = await image.read()
        f.write(content)
        
    # 2. Extract EXIF GPS if available
    exif_lat, exif_lon = _extract_gps_from_exif(filepath)
    has_exif = False
    
    if exif_lat is not None and exif_lon is not None:
        final_lat, final_lon = exif_lat, exif_lon
        has_exif = True
    else:
        # Fallback to manual coordinates if EXIF stripped
        final_lat, final_lon = lat, lon
        
    # 3. Analyze with Gemini Vision
    analysis_result = await analyze_landslide_image(filepath)
    
    # 4. Save to DB
    now = datetime.now(timezone.utc)
    report = PublicReportModel(
        image_path=filename,  # Just serve the filename statically
        lat=final_lat,
        lon=final_lon,
        location_name=location_name,
        has_exif_gps=has_exif,
        gemini_analysis=analysis_result.get("analysis"),
        severity=analysis_result.get("severity", "Pending"),
        status="pending",
        timestamp=now
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    
    return report


@router.get("", response_model=List[ReportResponse])
async def list_reports(db: AsyncSession = Depends(get_db)):
    """Admin endpoint to list all crowdsourced reports."""
    stmt = select(PublicReportModel).order_by(PublicReportModel.timestamp.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/{report_id}/status", response_model=ReportResponse)
async def update_report_status(
    report_id: int, 
    update: ReportStatusUpdate, 
    db: AsyncSession = Depends(get_db)
):
    """Admin endpoint to verify or reject a report."""
    stmt = select(PublicReportModel).where(PublicReportModel.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(404, "Report not found")
        
    if update.status not in ["verified", "rejected", "pending"]:
        raise HTTPException(400, "Invalid status")
        
    report.status = update.status
    await db.commit()
    await db.refresh(report)
    return report
