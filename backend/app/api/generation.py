"""
Music generation endpoints.
"""
from fastapi import APIRouter, HTTPException
from uuid import uuid4
from datetime import datetime

from ..models import (
    GenerationRequest,
    GenerationJob,
    GenerationStatus,
    GenerationStage,
    MusicParameters
)
from ..services.generation_service import GenerationService

router = APIRouter()

# In-memory job storage (would use Redis/database in production)
active_jobs = {}

# Generation service instance
generation_service = GenerationService()


@router.post("/generate", response_model=GenerationJob)
async def start_generation(request: GenerationRequest):
    """
    Start a music generation job.

    Args:
        request: Generation parameters

    Returns:
        GenerationJob with job_id for tracking
    """
    # Create job
    job_id = str(uuid4())
    job = GenerationJob(
        job_id=job_id,
        status=GenerationStatus.PENDING,
        stage=GenerationStage.INITIALIZING,
        progress=0,
        message="Job created",
        parameters=request.parameters,
        created_at=datetime.now()
    )

    # Store job
    active_jobs[job_id] = job

    # Start generation asynchronously (fire and forget)
    # Note: In production, use background tasks or Celery
    import asyncio
    asyncio.create_task(_run_generation(job_id, request.parameters))

    return job


@router.get("/generate/{job_id}/status", response_model=GenerationJob)
async def get_generation_status(job_id: str):
    """
    Get the status of a generation job.

    Args:
        job_id: Job identifier

    Returns:
        Current job status
    """
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return active_jobs[job_id]


@router.get("/generate/{job_id}/result")
async def get_generation_result(job_id: str):
    """
    Get the result of a completed generation job.

    Args:
        job_id: Job identifier

    Returns:
        File metadata and download URL
    """
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = active_jobs[job_id]

    if job.status != GenerationStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed yet. Current status: {job.status}"
        )

    return job.result


async def _run_generation(job_id: str, parameters: MusicParameters):
    """
    Run generation in background and update job status.

    Args:
        job_id: Job identifier
        parameters: Generation parameters
    """
    job = active_jobs[job_id]

    # Update job to in_progress
    job.status = GenerationStatus.IN_PROGRESS
    job.stage = GenerationStage.GENERATING
    job.progress = 10

    # Progress callback
    async def progress_callback(stage: str, progress: int, message: str):
        job.stage = GenerationStage(stage)
        job.progress = progress
        job.message = message

    try:
        # Generate music
        result, error = await generation_service.generate(parameters, progress_callback)

        if result:
            # Success
            job.status = GenerationStatus.COMPLETED
            job.stage = GenerationStage.COMPLETE
            job.progress = 100
            job.message = "Generation completed successfully"
            job.result = result
            job.completed_at = datetime.now()
        else:
            # Failure
            job.status = GenerationStatus.FAILED
            job.stage = GenerationStage.ERROR
            job.error = error or "Unknown error"
            job.message = f"Generation failed: {job.error}"
            job.completed_at = datetime.now()

    except Exception as e:
        # Exception
        job.status = GenerationStatus.FAILED
        job.stage = GenerationStage.ERROR
        job.error = str(e)
        job.message = f"Generation error: {str(e)}"
        job.completed_at = datetime.now()
