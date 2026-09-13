import os
import json
import logging
import google.generativeai as genai
from typing import Optional, Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)

if settings.has_gemini:
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    # We use gemini-1.5-flash for speed and multimodal capabilities
    _model = genai.GenerativeModel('gemini-2.0-flash')
else:
    _model = None

async def generate_risk_explanation(features: Dict[str, Any], risk_level: str, confidence: float, rag_context: str = "") -> Optional[str]:
    """
    Generates a short, plain-language summary explaining the landslide risk.
    """
    if not _model:
        return None
        
    prompt = f"""
    You are an expert geologist and AI assistant for the LandWatch NER landslide early warning system.
    We just ran our ML model for a location in Northeast India and got these results:
    - Risk Level: {risk_level}
    - Model Confidence: {confidence*100:.1f}%
    
    Current conditions:
    - Rainfall Intensity: {features.get('rainfall_intensity_mm', 0)} mm/day
    - Slope Angle: {features.get('slope_angle', 0)} degrees
    - Soil Moisture: {features.get('soil_moisture', 0)*100:.1f}%
    - Seismic Activity: {features.get('seismic_activity', 0)} (Richter scale equivalent)
    
    {rag_context}

    Write a 2-3 sentence, plain-language explanation of WHY this risk level was assigned based on these conditions. 
    If RAG Context is provided, explicitly mention that these conditions have historically led to landslides here.
    Make it easy for a non-technical local authority or citizen to understand. Do not use markdown.
    """
    
    try:
        response = await _model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini API error during explanation generation: {e}")
        return None

async def analyze_landslide_image(image_path: str) -> Dict[str, Any]:
    """
    Analyzes an uploaded photo for visual signs of landslide risk (cracks, erosion).
    Returns a JSON structure with analysis and severity.
    """
    if not _model:
        return {"error": "Gemini API not configured", "severity": "Pending"}
        
    import PIL.Image
    
    try:
        img = PIL.Image.open(image_path)
    except Exception as e:
        logger.error(f"Could not open image for Gemini analysis: {e}")
        return {"error": "Invalid image file", "severity": "Pending"}
        
    prompt = """
    Analyze this image for signs of potential landslide risk or land instability.
    Look for:
    1. Soil cracks or fissures
    2. Significant soil erosion or exposed bare earth on slopes
    3. Abnormal water seepage on slopes
    4. Debris accumulation or fallen rocks
    
    Return ONLY a valid JSON object with exactly these two keys:
    "analysis": A 1-2 sentence description of what you see regarding land stability.
    "severity": One of these exact strings based on visual evidence: "Low", "Medium", "High", "Critical". If no risk is visible, use "Low".
    """
    
    try:
        response = await _model.generate_content_async([prompt, img])
        text = response.text.strip()
        
        # Clean up possible markdown formatting in the response
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        result = json.loads(text)
        
        # Validate severity
        if result.get("severity") not in ["Low", "Medium", "High", "Critical"]:
            result["severity"] = "Medium" # safe fallback
            
        return result
    except Exception as e:
        logger.error(f"Gemini API error during image analysis: {e}")
        return {"error": "Analysis failed", "severity": "Pending"}

async def analyze_landslide_image_bytes(image_bytes: bytes) -> Dict[str, Any]:
    """
    Analyzes an in-memory image (e.g. satellite tile) for visual signs of landslide risk.
    Returns a JSON structure with analysis and severity.
    """
    if not _model:
        return {"error": "Gemini API not configured", "severity": "Pending"}
        
    import io
    import PIL.Image
    
    try:
        img = PIL.Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        logger.error(f"Could not open image bytes for Gemini analysis: {e}")
        return {"error": "Invalid image bytes", "severity": "Pending"}
        
    prompt = """
    Analyze this satellite or drone imagery for signs of potential landslide risk or land instability.
    Look for:
    1. Visible soil cracks or fissures
    2. Significant soil erosion or exposed bare earth on slopes
    3. Abnormal water seepage on slopes
    4. Debris accumulation or fallen rocks
    
    Return ONLY a valid JSON object with exactly these two keys:
    "analysis": A 1-2 sentence description of what you see regarding land stability.
    "severity": One of these exact strings based on visual evidence: "Low", "Medium", "High", "Critical". If no risk is visible, use "Low".
    """
    
    try:
        response = await _model.generate_content_async([prompt, img])
        text = response.text.strip()
        
        # Clean up possible markdown formatting in the response
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        result = json.loads(text)
        
        # Validate severity
        if result.get("severity") not in ["Low", "Medium", "High", "Critical"]:
            result["severity"] = "Medium" # safe fallback
            
        return result
    except Exception as e:
        logger.error(f"Gemini API error during byte image analysis: {e}")
        return {"error": "Analysis failed", "severity": "Pending"}
